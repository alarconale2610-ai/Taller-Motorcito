// src/lib/excel-sanitizer.ts
export interface SanitizedProduct {
  barcode: string | null;
  name: string;
  description: string | null;
  type: 'A' | 'B' | 'C' | 'D';
  cost_price: number;
  sale_price: number;
  stock: number;
  min_stock: number;
  unit: string;
  _raw: any;
  _rowIndex: number;
}

export interface ValidationError {
  row: number;
  column: string;
  value: any;
  problem: string;
  solution: string;
  example?: string;
  severity: 'error' | 'warning';
  autoFixable: boolean;
  suggestedValue?: any;
}

// Capa 1: Sanitización de texto
export function sanitizeCell(value: any): string {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/^[\s\uFEFF\xA0]+|[\s\uFEFF\xA0]+$/g, '')
    .replace(/\s+/g, ' ')
    .replace(/[\u200B-\u200D\uFEFF]/g, '');
}

// Capa 2: Parseo inteligente de moneda
export function parseCurrency(value: any): { value: number; wasCleaned: boolean; original: string; error?: string } {
  const original = String(value);
  let cleaned = sanitizeCell(value);
  
  if (!cleaned) return { value: 0, wasCleaned: false, original };
  
  // Detectar símbolos de moneda
  const currencySymbols = /[$€£¥]\s?/g;
  const hasCurrency = currencySymbols.test(cleaned);
  cleaned = cleaned.replace(currencySymbols, '');
  
  // Manejar separadores de miles y decimales
  if (cleaned.includes(',') && cleaned.includes('.')) {
    const lastComma = cleaned.lastIndexOf(',');
    const lastDot = cleaned.lastIndexOf('.');
    
    if (lastComma > lastDot) {
      cleaned = cleaned.replace(/\./g, '').replace(',', '.');
    } else {
      cleaned = cleaned.replace(/,/g, '');
    }
  } else if (cleaned.includes(',') && !cleaned.includes('.')) {
    const parts = cleaned.split(',');
    if (parts.length === 2 && parts[1].length <= 2) {
      cleaned = cleaned.replace(',', '.');
    } else {
      cleaned = cleaned.replace(/,/g, '');
    }
  }
  
  const numericValue = parseFloat(cleaned);
  
  if (isNaN(numericValue)) {
    return { 
      value: NaN, 
      wasCleaned: hasCurrency, 
      original,
      error: hasCurrency 
        ? `El valor "${original}" contiene símbolo de moneda y no es un número válido`
        : `No se puede convertir "${original}" a número`
    };
  }
  
  return { value: numericValue, wasCleaned: hasCurrency || original !== cleaned, original };
}

// Capa 3: Parseo de códigos de barras/SKU
export function parseBarcode(value: any): { value: string | null; isValid: boolean; type: 'EAN' | 'SKU' | 'CODE128' | 'invalid'; error?: string } {
  const cleaned = sanitizeCell(value);
  
  if (!cleaned) return { value: null, isValid: true, type: 'SKU' };
  
  const hasSpecialChars = /[^a-zA-Z0-9\-_.]/.test(cleaned);
  
  if (hasSpecialChars) {
    return { 
      value: cleaned, 
      isValid: false, 
      type: 'invalid',
      error: `El código "${cleaned}" contiene caracteres especiales no permitidos (solo letras, números, guiones y puntos)`
    };
  }
  
  const isNumeric = /^\d+$/.test(cleaned);
  const isEAN = isNumeric && (cleaned.length === 8 || cleaned.length === 12 || cleaned.length === 13);
  
  return {
    value: cleaned.toUpperCase(),
    isValid: true,
    type: isEAN ? 'EAN' : 'SKU'
  };
}

// Capa 4: Detección flexible de columnas
export function detectColumns(headers: string[]): Record<string, string> {
  const mapping: Record<string, string> = {};
  
  const patterns: Record<string, string[]> = {
    barcode: ['codigo', 'barcode', 'sku', 'código', 'código de barras', 'id producto', 'referencia', 'cod'],
    name: ['nombre', 'producto', 'name', 'descripcion', 'descripción', 'título', 'articulo', 'artículo', 'item'],
    description: ['descripcion', 'description', 'desc', 'detalle', 'notas', 'observacion'],
    type: ['tipo', 'type', 'categoria', 'category', 'clase', 'grupo', 'familia'],
    cost_price: ['costo', 'precio costo', 'cost price', 'precio de costo', 'compra', 'precio proveedor', 'p.costo'],
    sale_price: ['venta', 'precio venta', 'sale price', 'precio de venta', 'pvp', 'precio publico', 'precio', 'p.venta'],
    stock: ['stock', 'cantidad', 'quantity', 'existencia', 'inventario', 'qty', 'unidades'],
    min_stock: ['minimo', 'stock minimo', 'min stock', 'stock mínimo', 'mínimo', 'alerta', 'stock min'],
    unit: ['unidad', 'unit', 'medida', 'um', 'units', 'u.m.']
  };
  
  headers.forEach((header, index) => {
    const cleanHeader = sanitizeCell(header).toLowerCase();
    
    for (const [field, possibleNames] of Object.entries(patterns)) {
      if (possibleNames.some(name => cleanHeader.includes(name))) {
        mapping[field] = header;
        break;
      }
    }
  });
  
  return mapping;
}

// Capa 5: Parseo de tipo de producto
export function parseProductType(value: any): { value: 'A' | 'B' | 'C' | 'D'; isValid: boolean; suggestion?: string; error?: string } {
  const cleaned = sanitizeCell(value).toUpperCase();
  
  if (['A', 'B', 'C', 'D'].includes(cleaned)) {
    return { value: cleaned as 'A' | 'B' | 'C' | 'D', isValid: true };
  }
  
  if (!cleaned) return { value: 'A', isValid: false, error: 'El tipo de producto está vacío' };
  
  // Sugerencias por similitud
  if (cleaned.includes('A') || cleaned.includes('1')) return { value: 'A', isValid: false, suggestion: 'A' };
  if (cleaned.includes('B') || cleaned.includes('2')) return { value: 'B', isValid: false, suggestion: 'B' };
  if (cleaned.includes('C') || cleaned.includes('3')) return { value: 'C', isValid: false, suggestion: 'C' };
  if (cleaned.includes('D') || cleaned.includes('4')) return { value: 'D', isValid: false, suggestion: 'D' };
  
  return { value: 'A', isValid: false, error: `Tipo "${value}" no válido. Debe ser A, B, C o D` };
}

// Capa 6-7: Validación de reglas de negocio y duplicados
export function validateProductBusinessRules(
  product: Partial<SanitizedProduct>,
  rowIndex: number,
  existingProducts: Map<string, any>,
  branchId: string
): ValidationError[] {
  const errors: ValidationError[] = [];
  
  // Validar nombre
  if (!product.name || product.name.length < 2) {
    errors.push({
      row: rowIndex,
      column: 'Nombre',
      value: product.name,
      problem: 'El nombre está vacío o es muy corto (mínimo 2 caracteres)',
      solution: 'Ingresa un nombre descriptivo para el producto',
      example: 'Aceite Motor 20W50',
      severity: 'error',
      autoFixable: false
    });
  }
  
  // Validar precio de costo
  if (product.cost_price === undefined || isNaN(product.cost_price)) {
    errors.push({
      row: rowIndex,
      column: 'Precio Costo',
      value: product._raw?.['Precio Costo'] || product._raw?.['cost_price'],
      problem: 'El formato del precio no es válido o contiene símbolos de moneda',
      solution: 'Usa solo números. Puedes usar punto o coma para decimales. No incluyas símbolos de moneda ($, €)',
      example: '12.50 o 12,50',
      severity: 'error',
      autoFixable: false
    });
  } else if (product.cost_price < 0) {
    errors.push({
      row: rowIndex,
      column: 'Precio Costo',
      value: product.cost_price,
      problem: 'El precio de costo es negativo',
      solution: 'El precio debe ser positivo o 0 si es gratis',
      severity: 'error',
      autoFixable: true,
      suggestedValue: Math.abs(product.cost_price)
    });
  }
  
  // Validar precio de venta
  if (product.sale_price === undefined || isNaN(product.sale_price)) {
    errors.push({
      row: rowIndex,
      column: 'Precio Venta',
      value: product._raw?.['Precio Venta'] || product._raw?.['sale_price'],
      problem: 'El formato del precio de venta no es válido',
      solution: 'Usa solo números sin símbolos de moneda',
      example: '15.00',
      severity: 'error',
      autoFixable: false
    });
  } else if (product.sale_price < 0) {
    errors.push({
      row: rowIndex,
      column: 'Precio Venta',
      value: product.sale_price,
      problem: 'El precio de venta es negativo',
      solution: 'El precio debe ser positivo',
      severity: 'error',
      autoFixable: true,
      suggestedValue: Math.abs(product.sale_price)
    });
  }
  
  // Validar margen de ganancia
  if (product.cost_price && product.sale_price && product.sale_price < product.cost_price) {
    const suggestedPrice = Math.round(product.cost_price * 1.3 * 100) / 100;
    errors.push({
      row: rowIndex,
      column: 'Precio Venta',
      value: product.sale_price,
      problem: `El precio de venta ($${product.sale_price}) es menor al costo ($${product.cost_price})`,
      solution: 'El precio de venta debe ser mayor al costo para generar ganancia. Considera al menos un 30% de margen.',
      example: `Sugerencia: $${suggestedPrice} (30% de margen)`,
      severity: 'warning',
      autoFixable: true,
      suggestedValue: suggestedPrice
    });
  }
  
  // Validar stock
  if (product.stock === undefined || isNaN(product.stock)) {
    errors.push({
      row: rowIndex,
      column: 'Stock',
      value: product._raw?.['Stock'] || product._raw?.['stock'],
      problem: 'El valor de stock no es un número válido',
      solution: 'Ingresa un número entero (ej: 10)',
      example: '10',
      severity: 'error',
      autoFixable: false
    });
  } else if (product.stock < 0) {
    errors.push({
      row: rowIndex,
      column: 'Stock',
      value: product.stock,
      problem: 'El stock es negativo',
      solution: 'Usa 0 para indicar sin stock, o un número positivo',
      severity: 'error',
      autoFixable: true,
      suggestedValue: 0
    });
  }
  
  // Validar código de barras duplicado
  if (product.barcode) {
    const existing = existingProducts.get(product.barcode);
    if (existing) {
      if (existing.branch_id === branchId) {
        errors.push({
          row: rowIndex,
          column: 'Código de Barras',
          value: product.barcode,
          problem: `Este código ya existe en tu inventario con el nombre "${existing.name}"`,
          solution: 'Usa un código diferente o actualiza el producto existente desde el inventario',
          severity: 'error',
          autoFixable: false
        });
      } else {
        errors.push({
          row: rowIndex,
          column: 'Código de Barras',
          value: product.barcode,
          problem: `Este código existe en otra sucursal`,
          solution: 'Puedes importarlo igualmente (cada sucursal maneja su propio stock) o usar un código diferente',
          severity: 'warning',
          autoFixable: false
        });
      }
    }
  }
  
  return errors;
}

// Helper para formatear números seguros en UI
export function formatSafeNumber(value: any): string {
  if (value === undefined || value === null || value === '') return '-';
  const num = Number(value);
  if (isNaN(num)) return '-';
  return num.toString();
}

export function formatSafeCurrency(value: any): string {
  if (value === undefined || value === null || value === '') return '-';
  const num = Number(value);
  if (isNaN(num)) return '-';
  return `$${num.toFixed(2)}`;
}