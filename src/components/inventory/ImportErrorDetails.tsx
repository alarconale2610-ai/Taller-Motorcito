// src/components/inventory/ImportErrorDetails.tsx
'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { 
  AlertCircle, 
  CheckCircle2, 
  Wand2, 
  ChevronDown, 
  ChevronUp,
  Lightbulb,
  Info
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ValidationError } from '@/lib/excel-sanitizer';
import { useState } from 'react';

interface ImportErrorDetailsProps {
  errors: ValidationError[];
  warnings: ValidationError[];
  onAutoFix?: () => void;
  autoFixableCount: number;
}

export function ImportErrorDetails({ 
  errors, 
  warnings, 
  onAutoFix,
  autoFixableCount 
}: ImportErrorDetailsProps) {
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());

  const toggleRow = (row: number) => {
    const newSet = new Set(expandedRows);
    if (newSet.has(row)) newSet.delete(row);
    else newSet.add(row);
    setExpandedRows(newSet);
  };

  // Agrupar por fila
  const byRow = (items: ValidationError[]) => {
    return items.reduce((acc, item) => {
      if (!acc[item.row]) acc[item.row] = [];
      acc[item.row].push(item);
      return acc;
    }, {} as Record<number, ValidationError[]>);
  };

  const errorsByRow = byRow(errors);
  const warningsByRow = byRow(warnings);

  if (errors.length === 0 && warnings.length === 0) return null;

  return (
    <div className="space-y-4 mt-4">
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-200">
        <div className="flex items-center gap-3">
          {errors.length > 0 ? (
            <div className="p-2 bg-red-100 rounded-full">
              <AlertCircle className="w-5 h-5 text-red-600" />
            </div>
          ) : (
            <div className="p-2 bg-amber-100 rounded-full">
              <Info className="w-5 h-5 text-amber-600" />
            </div>
          )}
          <div>
            <h3 className="font-semibold text-gray-900">
              {errors.length > 0 
                ? `${errors.length} errores encontrados` 
                : `${warnings.length} advertencias`}
            </h3>
            <p className="text-sm text-gray-500">
              {errors.length > 0 
                ? 'Debes corregir los errores antes de importar'
                : 'Puedes importar igualmente, pero revisa las sugerencias'}
            </p>
          </div>
        </div>
        
        {autoFixableCount > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={onAutoFix}
            className="flex items-center gap-2 text-blue-600 border-blue-200 hover:bg-blue-50"
          >
            <Wand2 className="w-4 h-4" />
            Corregir {autoFixableCount} automáticamente
          </Button>
        )}
      </div>

      {/* Lista de Errores */}
      {errors.length > 0 && (
        <div className="border border-red-200 rounded-lg overflow-hidden">
          <div className="bg-red-50 px-4 py-2 border-b border-red-200">
            <h4 className="font-medium text-red-800 text-sm">Errores (bloquean la importación)</h4>
          </div>
          <ScrollArea className="max-h-48">
            <div className="divide-y divide-red-100">
              {Object.entries(errorsByRow).map(([rowNum, rowErrors]) => (
                <div key={rowNum} className="p-3 hover:bg-red-50/30">
                  <button 
                    onClick={() => toggleRow(Number(rowNum))}
                    className="w-full flex items-start gap-3 text-left"
                  >
                    <span className="flex-shrink-0 w-6 h-6 flex items-center justify-center bg-red-100 text-red-700 rounded-full text-xs font-bold">
                      {rowNum}
                    </span>
                    <div className="flex-1">
                      <p className="font-medium text-sm text-gray-900">
                        {rowErrors[0].column}
                        {rowErrors.length > 1 && ` y ${rowErrors.length - 1} más`}
                      </p>
                      <p className="text-xs text-gray-500 truncate">
                        {rowErrors[0].problem}
                      </p>
                    </div>
                    {expandedRows.has(Number(rowNum)) ? (
                      <ChevronUp className="w-4 h-4 text-gray-400" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-gray-400" />
                    )}
                  </button>
                  
                  <AnimatePresence>
                    {expandedRows.has(Number(rowNum)) && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="pl-9 pt-2 space-y-2">
                          {rowErrors.map((error, idx) => (
                            <div key={idx} className="text-sm space-y-1">
                              <p className="text-red-700 font-medium">{error.column}</p>
                              <p className="text-gray-600">{error.problem}</p>
                              <div className="flex items-start gap-2 p-2 bg-blue-50 rounded text-blue-800 text-xs">
                                <Lightbulb className="w-3 h-3 flex-shrink-0 mt-0.5" />
                                <div>
                                  <p className="font-medium">Solución:</p>
                                  <p>{error.solution}</p>
                                  {error.example && (
                                    <p className="mt-1 text-blue-600">Ej: {error.example}</p>
                                  )}
                                </div>
                              </div>
                              {error.autoFixable && (
                                <div className="flex items-center gap-2 text-xs text-green-600">
                                  <CheckCircle2 className="w-3 h-3" />
                                  Se corregirá automáticamente a: {String(error.suggestedValue)}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      )}

      {/* Advertencias */}
      {warnings.length > 0 && (
        <div className="border border-amber-200 rounded-lg overflow-hidden">
          <div className="bg-amber-50 px-4 py-2 border-b border-amber-200">
            <h4 className="font-medium text-amber-800 text-sm">Advertencias (no bloquean)</h4>
          </div>
          <ScrollArea className="max-h-32">
            <div className="p-3 space-y-2">
              {warnings.map((warning, idx) => (
                <div key={idx} className="text-sm p-2 bg-amber-50/50 rounded border border-amber-100">
                  <p className="font-medium text-amber-900">Fila {warning.row} - {warning.column}</p>
                  <p className="text-amber-700 text-xs">{warning.problem}</p>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      )}
    </div>
  );
}