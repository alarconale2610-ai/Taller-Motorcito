// src/lib/workers/excel.worker.ts
import * as XLSX from 'xlsx';
import {
  sanitizeCell,
  parseCurrency,
  parseBarcode,
  parseProductType,
  validateProductBusinessRules,
  SanitizedProduct,
  ValidationError
} from '../excel-sanitizer';

// ============================================================================
// TIPOS DEL WORKER
// ============================================================================

interface ExistingProduct {
  id: string;
  name: string;
  barcode?: string | null;
  description?: string | null;
  type?: string | null;
  cost_price?: number | null;
  sale_price?: number | null;
  stock?: number;
  min_stock?: number;
  unit?: string;
  branch_id?: string;
  [key: string]: any;
}

interface SmartImportPayload {
  fileData: ArrayBuffer;
  existingProducts: [string, ExistingProduct][];
  branchId: string;
}

// ProcesedProduct debe coincidir exactamente con Partial<SanitizedProduct>
interface ProcessedProduct {
  barcode: string | null;
  name: string;
  description: string | null;
  type: 'A' | 'B' | 'C' | 'D';
  cost_price: number | undefined;  // ← Cambiado de null a undefined
  sale_price: number | undefined;    // ← Cambiado de null a undefined
  stock: number;
  min_stock: number;
  unit: string;
  _raw: any;
  _rowIndex: number;
}

interface ImportStats {
  total: number;
  valid: number;
  errors: number;
  warnings: number;
}

// ============================================================================
// WORKER PRINCIPAL
// ============================================================================

self.onmessage = async (e: MessageEvent) => {
  const { type, payload } = e.data;

  try {
    if (type === 'SMART_IMPORT' && payload.fileData) {
      const { fileData, existingProducts: existingArray, branchId } = payload as SmartImportPayload;
      
      if (!branchId || typeof branchId !== 'string') {
        throw new Error('branchId es requerido y debe ser un string válido');
      }

      const existingProducts = new Map<string, ExistingProduct>(existingArray || []);
      
      const workbook = XLSX.read(fileData, { type: 'array' });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const rawData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 }) as any[][];

      if (!Array.isArray(rawData) || rawData.length < 2) {
        throw new Error('El archivo debe tener al menos un encabezado y una fila de datos');
      }

      const headers = rawData[0].map((h: any) => sanitizeCell(String(h ?? '')));
      const rows: Array<Record<string, any> & { _rowIndex: number; _raw: any }> = [];

      for (let i = 1; i < rawData.length; i++) {
        const row = rawData[i];
        if (!Array.isArray(row)) continue;
        
        const hasContent = row.some(cell => cell !== undefined && cell !== null && cell !== '');
        if (!hasContent) continue;

        const rowObj: Record<string, any> & { _rowIndex: number; _raw: any } = { 
          _rowIndex: i, 
          _raw: {} 
        };
        
        headers.forEach((header: string, idx: number) => {
          const value = row[idx];
          rowObj[header] = value;
          rowObj._raw[header] = value;
        });
        
        rows.push(rowObj);
      }

      self.postMessage({
        type: 'PROGRESS',
        payload: { progress: 30, stage: 'Validando datos...' }
      });

      const validRows: ProcessedProduct[] = [];
      const errors: ValidationError[] = [];
      const warnings: ValidationError[] = [];

      for (const row of rows) {
        const barcodeRaw = row['Código de Barras'] ?? row['barcode'] ?? row['sku'] ?? row['codigo'] ?? null;
        const costRaw = row['Precio Costo'] ?? row['cost_price'] ?? row['costo'] ?? row['precio_costo'] ?? null;
        const saleRaw = row['Precio Venta'] ?? row['sale_price'] ?? row['venta'] ?? row['precio_venta'] ?? null;
        const stockRaw = row['Stock'] ?? row['stock'] ?? row['cantidad'] ?? 0;
        const minStockRaw = row['Stock Mínimo'] ?? row['min_stock'] ?? row['minimo'] ?? row['stock_minimo'] ?? 5;
        const typeRaw = row['Tipo (A/B/C/D)'] ?? row['type'] ?? row['tipo'] ?? null;
        const nameRaw = row['Nombre'] ?? row['name'] ?? row['producto'] ?? row['descripcion'] ?? null;
        const descRaw = row['Descripción'] ?? row['description'] ?? row['desc'] ?? null;
        const unitRaw = row['Unidad'] ?? row['unit'] ?? row['medida'] ?? 'unidad';

        const barcodeData = parseBarcode(barcodeRaw);
        const costData = parseCurrency(costRaw);
        const saleData = parseCurrency(saleRaw);
        
        const stockVal = Math.max(0, parseInt(sanitizeCell(stockRaw), 10) || 0);
        const minStockVal = Math.max(0, parseInt(sanitizeCell(minStockRaw), 10) || 5);
        
        const typeData = parseProductType(typeRaw);
        
        const nameVal = sanitizeCell(nameRaw);
        if (!nameVal || nameVal.trim().length === 0) {
          errors.push({
            row: row._rowIndex,
            column: 'Nombre',
            value: nameRaw,
            problem: 'El nombre del producto es obligatorio',
            solution: 'Ingresa un nombre descriptivo para el producto',
            example: 'Aceite Motor 20W50',
            severity: 'error',
            autoFixable: false
          });
        }

        if (!barcodeData.isValid && barcodeData.error) {
          warnings.push({
            row: row._rowIndex,
            column: 'Código de Barras',
            value: barcodeRaw,
            problem: barcodeData.error,
            solution: 'Usa solo letras, números, guiones y puntos',
            severity: 'warning',
            autoFixable: false
          });
        }

        if (costData.error) {
          errors.push({
            row: row._rowIndex,
            column: 'Precio Costo',
            value: costRaw,
            problem: costData.error,
            solution: 'Usa solo números. Puedes usar punto o coma para decimales',
            example: '12.50',
            severity: 'error',
            autoFixable: false
          });
        }

        if (saleData.error) {
          errors.push({
            row: row._rowIndex,
            column: 'Precio Venta',
            value: saleRaw,
            problem: saleData.error,
            solution: 'Usa solo números sin símbolos de moneda',
            example: '15.00',
            severity: 'error',
            autoFixable: false
          });
        }

        if (!typeData.isValid && typeData.error) {
          errors.push({
            row: row._rowIndex,
            column: 'Tipo',
            value: typeRaw,
            problem: typeData.error,
            solution: 'Usa A, B, C o D',
            example: 'A',
            severity: 'error',
            autoFixable: true,
            suggestedValue: typeData.suggestion || 'A'
          });
        }

        // Helper para convertir valor numérico a number | undefined
        const toValidNumber = (val: number): number | undefined => {
          if (isNaN(val)) return undefined;
          return val;
        };

        const product: ProcessedProduct = {
          barcode: barcodeData.value,
          name: nameVal || 'SIN NOMBRE',
          description: sanitizeCell(descRaw) || null,
          type: typeData.value,
          cost_price: toValidNumber(costData.value),  // ← undefined en lugar de null
          sale_price: toValidNumber(saleData.value),    // ← undefined en lugar de null
          stock: stockVal,
          min_stock: minStockVal,
          unit: sanitizeCell(unitRaw) || 'unidad',
          _raw: row._raw,
          _rowIndex: row._rowIndex
        };

        const rowErrors = validateProductBusinessRules(product, row._rowIndex, existingProducts, branchId);
        const criticalErrors = rowErrors.filter((e: ValidationError) => e.severity === 'error');
        const rowWarnings = rowErrors.filter((e: ValidationError) => e.severity === 'warning');

        if (criticalErrors.length === 0) {
          validRows.push(product);
        }
        
        errors.push(...criticalErrors);
        warnings.push(...rowWarnings);
      }

      const stats: ImportStats = {
        total: rows.length,
        valid: validRows.length,
        errors: errors.filter(e => e.severity === 'error').length,
        warnings: warnings.length
      };

      self.postMessage({
        type: 'VALIDATION_RESULT',
        payload: {
          validRows,
          errors,
          warnings,
          stats
        }
      });
    } else {
      throw new Error(`Tipo de mensaje no soportado: ${type}`);
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido en el worker';
    console.error('[ExcelWorker] Error:', error);
    
    self.postMessage({
      type: 'ERROR',
      payload: { 
        message: errorMessage,
        details: error instanceof Error ? error.stack : undefined
      }
    });
  }
};

export {};