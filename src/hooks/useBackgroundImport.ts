// Reemplaza TODO el contenido de src/hooks/useBackgroundImport.ts con esto:

'use client';

import { useState, useRef, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { importProducts } from '@/lib/actions/products-import';

export interface ImportProgress {
  id: string;
  fileName: string;
  status: 'parsing' | 'validating' | 'importing' | 'completed' | 'error';
  progress: number; // 0-100
  processed: number;
  total: number;
  errors: string[];
  successCount: number;
}

// Helper para convertir a número seguro
function safeNumber(value: any, defaultValue: number = 0): number {
  if (value === undefined || value === null || value === '') return defaultValue;
  const num = Number(value);
  return isNaN(num) ? defaultValue : num;
}

export function useBackgroundImport() {
  const [activeImports, setActiveImports] = useState<ImportProgress[]>([]);
  const { toast } = useToast();
  const workerRef = useRef<Worker | null>(null);

  // Inicializar Worker
  const getWorker = useCallback(() => {
    if (!workerRef.current) {
      workerRef.current = new Worker(
        new URL('@/lib/workers/excel.worker.ts', import.meta.url)
      );
    }
    return workerRef.current;
  }, []);

  const startImport = useCallback(async (
    file: File,
    branchId: string,
    onComplete?: () => void
  ) => {
    const importId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const fileName = file.name;

    // Agregar a imports activos
    setActiveImports(prev => [...prev, {
      id: importId,
      fileName,
      status: 'parsing',
      progress: 0,
      processed: 0,
      total: 0,
      errors: [],
      successCount: 0
    }]);

    const worker = getWorker();

    // Escuchar mensajes del worker
    const handleMessage = async (e: MessageEvent) => {
      const { type, payload } = e.data;

      switch (type) {
        case 'PROGRESS':
          setActiveImports(prev => prev.map(imp => 
            imp.id === importId 
              ? { ...imp, progress: payload.progress, status: 'parsing' }
              : imp
          ));
          break;

        case 'PARSE_RESULT':
          // Iniciar validación
          setActiveImports(prev => prev.map(imp => 
            imp.id === importId 
              ? { ...imp, status: 'validating', total: payload.totalRows }
              : imp
          ));
          
          // Enviar a validar
          worker.postMessage({
            type: 'VALIDATE_ROWS',
            payload: { rows: payload.data }
          });
          break;

        case 'VALIDATE_RESULT':
          // Iniciar importación por lotes
          await processBatches(
            importId, 
            payload.validRows, 
            branchId, 
            payload.errors,
            onComplete
          );
          break;

        case 'ERROR':
          handleError(importId, payload.message);
          break;
      }
    };

    worker.onmessage = handleMessage;

    // Leer archivo y enviar al worker
    const reader = new FileReader();
    reader.onload = (e) => {
      const data = e.target?.result;
      worker.postMessage({
        type: 'PARSE_EXCEL',
        payload: { fileData: data }
      });
    };
    reader.readAsArrayBuffer(file);

  }, [getWorker]);

  const processBatches = async (
    importId: string,
    rows: any[],
    branchId: string,
    validationErrors: string[],
    onComplete?: () => void
  ) => {
    const BATCH_SIZE = 50; // Tamaño seguro para Vercel
    const total = rows.length;
    let processed = 0;
    let successCount = 0;
    const allErrors = [...validationErrors];

    setActiveImports(prev => prev.map(imp => 
      imp.id === importId 
        ? { ...imp, status: 'importing', total, errors: allErrors }
        : imp
    ));

    // Procesar por lotes
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE).map(row => {
        // Mapear con valores seguros (evitar NaN)
        const costPrice = safeNumber(row['Precio Costo'] ?? row['cost_price'], 0);
        const salePrice = safeNumber(row['Precio Venta'] ?? row['sale_price'], 0);
        const stock = safeNumber(row['Stock'] ?? row['stock'], 0);
        const minStock = safeNumber(row['Stock Mínimo'] ?? row['min_stock'] ?? row['minStock'], 5);
        
        return {
          barcode: row['Código de Barras']?.toString() || row['barcode']?.toString() || null,
          name: row['Nombre'] || row['name'] || 'Sin nombre',
          description: row['Descripción'] || row['description'] || null,
          type: String(row['Tipo (A/B/C/D)'] || row['type'] || 'A').toUpperCase() as 'A' | 'B' | 'C' | 'D',
          cost_price: costPrice,
          sale_price: salePrice,
          stock: stock,
          min_stock: minStock,
          unit: row['Unidad'] || row['unit'] || 'unidad',
        };
      });

      try {
        const result = await importProducts(branchId, batch);
        successCount += result.success;
        
        if (result.errors.length > 0) {
          allErrors.push(...result.errors);
        }

        processed += batch.length;
        const progress = Math.round((processed / total) * 100);

        setActiveImports(prev => prev.map(imp => 
          imp.id === importId 
            ? { 
                ...imp, 
                progress, 
                processed, 
                successCount,
                errors: allErrors 
              }
            : imp
        ));

        // Pequeña pausa para no saturar el servidor
        if (i + BATCH_SIZE < rows.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }

      } catch (error: any) {
        allErrors.push(`Error en lote ${i/BATCH_SIZE + 1}: ${error.message}`);
      }
    }

    // Finalizar
    const isSuccess = successCount === total && allErrors.length === 0;
    const hasPartialSuccess = successCount > 0;
    
    setActiveImports(prev => prev.map(imp => 
      imp.id === importId 
        ? { 
            ...imp, 
            status: hasPartialSuccess ? 'completed' : 'error',
            progress: 100,
            successCount,
            errors: allErrors
          }
        : imp
    ));

    // Toast final
    if (hasPartialSuccess && allErrors.length === 0) {
      toast({
        title: '✅ Importación completada',
        description: `${successCount} productos importados correctamente`,
      });
    } else if (hasPartialSuccess) {
      toast({
        title: '⚠️ Importación parcial',
        description: `${successCount} de ${total} importados. ${allErrors.length} errores.`,
        variant: 'default',
      });
    } else {
      toast({
        title: '❌ Error en importación',
        description: `No se pudo importar ningún producto. Revise los errores.`,
        variant: 'destructive',
      });
    }

    // Callback de completado
    if (onComplete && hasPartialSuccess) {
      onComplete();
    }

    // Limpiar después de 5 segundos si fue exitoso
    if (hasPartialSuccess && allErrors.length === 0) {
      setTimeout(() => {
        setActiveImports(prev => prev.filter(imp => imp.id !== importId));
      }, 5000);
    }
  };

  const handleError = (importId: string, message: string) => {
    setActiveImports(prev => prev.map(imp => 
      imp.id === importId 
        ? { ...imp, status: 'error', errors: [message] }
        : imp
    ));
    
    toast({
      title: '❌ Error en importación',
      description: message,
      variant: 'destructive',
    });
  };

  const dismissImport = useCallback((importId: string) => {
    setActiveImports(prev => prev.filter(imp => imp.id !== importId));
  }, []);

  return {
    activeImports,
    startImport,
    dismissImport
  };
}