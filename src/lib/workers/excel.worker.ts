// lib/workers/excel.worker.ts
// Este worker procesa archivos Excel en segundo plano para no bloquear la UI

import * as XLSX from 'xlsx';

interface WorkerMessage {
  type: 'PARSE_EXCEL' | 'VALIDATE_ROWS';
  payload: {
    fileData?: ArrayBuffer;
    rows?: any[];
    startRow?: number;
    endRow?: number;
  };
}

interface WorkerResponse {
  type: 'PARSE_RESULT' | 'VALIDATE_RESULT' | 'ERROR' | 'PROGRESS';
  payload?: {
    data?: any[];
    errors?: string[];
    validRows?: any[];
    progress?: number;
    totalRows?: number;
    message?: string;
  };
}

self.onmessage = async (e: MessageEvent<WorkerMessage>) => {
  const { type, payload } = e.data;

  try {
    if (type === 'PARSE_EXCEL' && payload.fileData) {
      const workbook = XLSX.read(payload.fileData, { type: 'array' });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      
      // Convertir a JSON con header: 1 para procesar fila por fila
      const rawData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 }) as any[][];
      
      if (rawData.length < 2) {
        throw new Error('El archivo no contiene datos suficientes (mínimo encabezado + 1 fila)');
      }

      const headers = rawData[0];
      const rows: any[] = [];
      
      // Procesar en chunks para no bloquear
      const CHUNK_SIZE = 100;
      for (let i = 1; i < rawData.length; i += CHUNK_SIZE) {
        const chunk = rawData.slice(i, i + CHUNK_SIZE);
        
        chunk.forEach((row, idx) => {
          if (row.some(cell => cell !== undefined && cell !== '')) {
            const rowObj: any = {};
            headers.forEach((header, colIndex) => {
              rowObj[header] = row[colIndex];
            });
            rowObj._rowIndex = i + idx; // Para referencia de errores
            rows.push(rowObj);
          }
        });

        // Reportar progreso cada chunk
        if (i % 500 === 0) {
          self.postMessage({
            type: 'PROGRESS',
            payload: { 
              progress: Math.round((i / rawData.length) * 100),
              totalRows: rawData.length - 1 
            }
          } as WorkerResponse);
        }
        
        // Yield para permitir otros mensajes
        await new Promise(resolve => setTimeout(resolve, 0));
      }

      self.postMessage({
        type: 'PARSE_RESULT',
        payload: { data: rows, totalRows: rows.length }
      } as WorkerResponse);
    }

    if (type === 'VALIDATE_ROWS' && payload.rows) {
      const errors: string[] = [];
      const validRows: any[] = [];
      
      const CHUNK_SIZE = 50;
      for (let i = 0; i < payload.rows.length; i += CHUNK_SIZE) {
        const chunk = payload.rows.slice(i, i + CHUNK_SIZE);
        
        chunk.forEach((row) => {
          const rowErrors = validateProductRow(row);
          if (rowErrors.length > 0) {
            errors.push(...rowErrors.map(e => `Fila ${row._rowIndex || '?'}: ${e}`));
          } else {
            validRows.push(row);
          }
        });

        // Reportar progreso
        self.postMessage({
          type: 'PROGRESS',
          payload: { 
            progress: Math.round((i / payload.rows.length) * 100),
            message: `Validando filas ${i} a ${Math.min(i + CHUNK_SIZE, payload.rows.length)}...`
          }
        } as WorkerResponse);
        
        await new Promise(resolve => setTimeout(resolve, 0));
      }

      self.postMessage({
        type: 'VALIDATE_RESULT',
        payload: { validRows, errors }
      } as WorkerResponse);
    }

  } catch (error: any) {
    self.postMessage({
      type: 'ERROR',
      payload: { message: error.message || 'Error desconocido en worker' }
    } as WorkerResponse);
  }
};

// Función de validación (duplicada del excel.ts para autonomía del worker)
function validateProductRow(row: any): string[] {
  const errors: string[] = [];
  
  if (!row['Nombre'] || String(row['Nombre']).trim() === '') {
    errors.push('Nombre es requerido');
  }
  
  const tipo = String(row['Tipo (A/B/C/D)'] || '').toUpperCase();
  if (!['A', 'B', 'C', 'D'].includes(tipo)) {
    errors.push('Tipo debe ser A, B, C o D');
  }
  
  const costo = Number(row['Precio Costo']);
  if (isNaN(costo) || costo < 0) {
    errors.push('Precio Costo debe ser un número positivo');
  }
  
  const venta = Number(row['Precio Venta']);
  if (isNaN(venta) || venta < 0) {
    errors.push('Precio Venta debe ser un número positivo');
  }
  
  const stock = Number(row['Stock']);
  if (isNaN(stock) || stock < 0 || !Number.isInteger(stock)) {
    errors.push('Stock debe ser un número entero positivo');
  }
  
  const minStock = Number(row['Stock Mínimo']);
  if (isNaN(minStock) || minStock < 0 || !Number.isInteger(minStock)) {
    errors.push('Stock Mínimo debe ser un número entero positivo');
  }
  
  if (!row['Unidad'] || String(row['Unidad']).trim() === '') {
    errors.push('Unidad es requerida');
  }
  
  return errors;
}

export {}; // Para que TypeScript lo trate como módulo