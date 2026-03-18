import * as XLSX from 'xlsx';
import { Product } from '@/types/database';

export interface ExcelProductRow {
  'Código de Barras': string;
  'Nombre': string;
  'Descripción': string;
  'Tipo (A/B/C/D)': string;
  'Precio Costo': number;
  'Precio Venta': number;
  'Stock': number;
  'Stock Mínimo': number;
  'Unidad': string;
}

export function exportProductsToExcel(products: Product[], branchName: string): void {
  const data: ExcelProductRow[] = products.map(p => ({
    'Código de Barras': p.barcode || '',
    'Nombre': p.name,
    'Descripción': p.description || '',
    'Tipo (A/B/C/D)': p.type,
    'Precio Costo': p.cost_price,
    'Precio Venta': p.sale_price,
    'Stock': p.stock,
    'Stock Mínimo': p.min_stock,
    'Unidad': p.unit,
  }));

  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Inventario');
  
  // Ajustar anchos de columna
  const colWidths = [
    { wch: 20 }, // Código de Barras
    { wch: 30 }, // Nombre
    { wch: 40 }, // Descripción
    { wch: 15 }, // Tipo
    { wch: 15 }, // Precio Costo
    { wch: 15 }, // Precio Venta
    { wch: 10 }, // Stock
    { wch: 15 }, // Stock Mínimo
    { wch: 15 }, // Unidad
  ];
  ws['!cols'] = colWidths;

  const date = new Date().toISOString().split('T')[0];
  XLSX.writeFile(wb, `Inventario_${branchName}_${date}.xlsx`);
}

export function downloadTemplate(): void {
  const template: ExcelProductRow[] = [
    {
      'Código de Barras': '1234567890123',
      'Nombre': 'Ejemplo Producto',
      'Descripción': 'Descripción opcional',
      'Tipo (A/B/C/D)': 'A',
      'Precio Costo': 10.00,
      'Precio Venta': 14.00,
      'Stock': 100,
      'Stock Mínimo': 10,
      'Unidad': 'unidad',
    }
  ];

  const ws = XLSX.utils.json_to_sheet(template);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Template');
  
  ws['!cols'] = [
    { wch: 20 }, { wch: 30 }, { wch: 40 }, { wch: 15 }, 
    { wch: 15 }, { wch: 15 }, { wch: 10 }, { wch: 15 }, { wch: 15 }
  ];

  XLSX.writeFile(wb, 'Template_Importar_Productos.xlsx');
}

export function parseExcelFile(file: File): Promise<ExcelProductRow[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json(worksheet) as ExcelProductRow[];
        resolve(json);
      } catch (error) {
        reject(new Error('Error al leer archivo Excel'));
      }
    };
    
    reader.onerror = () => reject(new Error('Error al leer archivo'));
    reader.readAsBinaryString(file);
  });
}

export function validateProductRow(row: any, index: number): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!row['Nombre'] || String(row['Nombre']).trim() === '') {
    errors.push(`Fila ${index + 1}: Nombre es requerido`);
  }
  
  const tipo = row['Tipo (A/B/C/D)'];
  if (!tipo || !['A', 'B', 'C', 'D'].includes(String(tipo).toUpperCase())) {
    errors.push(`Fila ${index + 1}: Tipo debe ser A, B, C o D`);
  }
  
  const costo = Number(row['Precio Costo']);
  if (isNaN(costo) || costo < 0) {
    errors.push(`Fila ${index + 1}: Precio Costo debe ser un número positivo`);
  }
  
  const venta = Number(row['Precio Venta']);
  if (isNaN(venta) || venta < 0) {
    errors.push(`Fila ${index + 1}: Precio Venta debe ser un número positivo`);
  }
  
  const stock = Number(row['Stock']);
  if (isNaN(stock) || stock < 0) {
    errors.push(`Fila ${index + 1}: Stock debe ser un número positivo`);
  }
  
  const stockMin = Number(row['Stock Mínimo']);
  if (isNaN(stockMin) || stockMin < 0) {
    errors.push(`Fila ${index + 1}: Stock Mínimo debe ser un número positivo`);
  }
  
  if (!row['Unidad'] || String(row['Unidad']).trim() === '') {
    errors.push(`Fila ${index + 1}: Unidad es requerida`);
  }
  
  return { valid: errors.length === 0, errors };
}