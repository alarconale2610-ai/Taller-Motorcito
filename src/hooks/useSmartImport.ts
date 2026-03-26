// src/hooks/useSmartImport.ts
'use client';

import { useState, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { importProducts } from '@/lib/actions/products-import';
import { 
  SanitizedProduct, 
  ValidationError, 
  parseCurrency, 
  parseBarcode, 
  parseProductType,
  validateProductBusinessRules,
  sanitizeCell
} from '@/lib/excel-sanitizer';

// Agrega esta exportación al inicio del archivo (después de los imports)
export interface ImportProgress {
  id: string;
  fileName: string;
  status: 'parsing' | 'validating' | 'importing' | 'completed' | 'error';
  progress: number;
  processed: number;
  total: number;
  successCount: number;
  errors: string[];
}

export interface ImportStats {
  total: number;
  valid: number;
  errors: number;
  warnings: number;
  imported: number;
}

export interface SmartImportResult {
  validProducts: SanitizedProduct[];
  errors: ValidationError[];
  warnings: ValidationError[];
  stats: ImportStats;
  autoFixableCount: number;
}

export function useSmartImport() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState({ percent: 0, stage: '' });
  const [result, setResult] = useState<SmartImportResult | null>(null);
  const { toast } = useToast();

  const processFile = useCallback(async (
    file: File,
    branchId: string,
    existingProducts: Map<string, any>
  ): Promise<SmartImportResult> => {
    setIsProcessing(true);
    setProgress({ percent: 0, stage: 'Leyendo archivo...' });
    
    return new Promise((resolve, reject) => {
      const worker = new Worker(
        new URL('@/lib/workers/excel.worker.ts', import.meta.url)
      );

      const handleMessage = (event: MessageEvent) => {
        const { type, payload } = event.data;

        if (type === 'PROGRESS') {
          setProgress({ percent: payload.progress, stage: payload.stage });
        }

        if (type === 'VALIDATION_RESULT') {
          const autoFixableCount = [
            ...payload.errors, 
            ...payload.warnings
          ].filter((e: ValidationError) => e.autoFixable).length;

          const result: SmartImportResult = {
            validProducts: payload.validRows,
            errors: payload.errors,
            warnings: payload.warnings,
            stats: payload.stats,
            autoFixableCount
          };
          
          setResult(result);
          setIsProcessing(false);
          worker.terminate();
          resolve(result);
        }

        if (type === 'ERROR') {
          setIsProcessing(false);
          worker.terminate();
          toast({
            title: 'Error al procesar archivo',
            description: payload.message,
            variant: 'destructive'
          });
          reject(new Error(payload.message));
        }
      };

      worker.onmessage = handleMessage;
      
      // Leer archivo
      const reader = new FileReader();
      reader.onload = (e) => {
        worker.postMessage({
          type: 'SMART_IMPORT',
          payload: { 
            fileData: e.target?.result,
            existingProducts: Array.from(existingProducts.entries()),
            branchId
          }
        });
      };
      reader.readAsArrayBuffer(file);
    });
  }, [toast]);

  const executeImport = useCallback(async (
    products: SanitizedProduct[],
    branchId: string
  ): Promise<{ success: boolean; imported: number }> => {
    const BATCH_SIZE = 50;
    let imported = 0;
    const errors: string[] = [];

    for (let i = 0; i < products.length; i += BATCH_SIZE) {
      const batch = products.slice(i, i + BATCH_SIZE).map(p => ({
        barcode: p.barcode ?? undefined,  // ✅ null → undefined
        name: p.name,
         description: p.description ?? undefined,  
        type: p.type,
        cost_price: p.cost_price,
        sale_price: p.sale_price,
        stock: p.stock,
        min_stock: p.min_stock,
        unit: p.unit
      }));

      try {
        const result = await importProducts(branchId, batch);
        imported += result.success;
        if (result.errors.length > 0) errors.push(...result.errors);
        
        setProgress({ 
          percent: Math.round(((i + batch.length) / products.length) * 100), 
          stage: `Importando ${Math.min(i + BATCH_SIZE, products.length)} de ${products.length}...` 
        });
        
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error: any) {
        errors.push(error.message);
      }
    }

    if (errors.length > 0) {
      toast({
        title: 'Importación completada con advertencias',
        description: `${imported} de ${products.length} productos importados`,
        variant: 'default'
      });
    } else {
      toast({
        title: '¡Importación exitosa!',
        description: `${imported} productos importados correctamente`,
      });
    }

    return { success: errors.length === 0, imported };
  }, [toast]);

  const applyAutoFixes = useCallback(() => {
    if (!result) return;
    
    const fixedProducts = result.validProducts.map(product => {
      const productErrors = result.errors.filter(e => e.row === product._rowIndex && e.autoFixable);
      const updates: any = {};
      
      productErrors.forEach(error => {
        if (error.column === 'Precio Costo' && error.suggestedValue !== undefined) {
          updates.cost_price = error.suggestedValue;
        }
        if (error.column === 'Precio Venta' && error.suggestedValue !== undefined) {
          updates.sale_price = error.suggestedValue;
        }
        if (error.column === 'Stock' && error.suggestedValue !== undefined) {
          updates.stock = error.suggestedValue;
        }
      });
      
      return { ...product, ...updates };
    });

    // Remover errores que fueron corregidos
    const remainingErrors = result.errors.filter(e => !e.autoFixable);
    
    setResult({
      ...result,
      validProducts: fixedProducts,
      errors: remainingErrors,
      autoFixableCount: 0
    });
    
    toast({
      title: 'Correcciones aplicadas',
      description: `Se corrigieron ${result.autoFixableCount} problemas automáticamente`,
    });
  }, [result, toast]);

  return {
    isProcessing,
    progress,
    result,
    processFile,
    executeImport,
    applyAutoFixes,
    reset: () => setResult(null)
  };
}