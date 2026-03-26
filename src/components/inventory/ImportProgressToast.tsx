// src/components/inventory/ImportProgressToast.tsx
'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { 
  FileSpreadsheet, 
  X, 
  CheckCircle2, 
  AlertCircle, 
  Loader2,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { useState } from 'react';
import { ImportProgress } from '@/hooks/useSmartImport';

import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';

interface ImportProgressToastProps {
  imports: ImportProgress[];
  onDismiss: (id: string) => void;
}

export function ImportProgressToast({ imports, onDismiss }: ImportProgressToastProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (imports.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 w-96">
      <AnimatePresence>
        {imports.map((imp) => (
          <motion.div
            key={imp.id}
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, x: 100 }}
            className="bg-white rounded-lg shadow-lg border border-slate-200 overflow-hidden"
          >
            {/* Header */}
            <div className="p-4 flex items-start gap-3">
              <div className={`
                p-2 rounded-lg 
                ${imp.status === 'completed' ? 'bg-green-100' : 
                  imp.status === 'error' ? 'bg-red-100' : 'bg-blue-100'}
              `}>
                {imp.status === 'completed' ? (
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                ) : imp.status === 'error' ? (
                  <AlertCircle className="w-5 h-5 text-red-600" />
                ) : (
                  <FileSpreadsheet className="w-5 h-5 text-blue-600" />
                )}
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <p className="font-medium text-sm text-gray-900 truncate">
                    {imp.fileName}
                  </p>
                  <button 
                    onClick={() => onDismiss(imp.id)}
                    className="text-gray-400 hover:text-gray-600 ml-2"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                
                <p className="text-xs text-gray-500 mt-0.5">
                  {imp.status === 'parsing' && 'Analizando archivo...'}
                  {imp.status === 'validating' && 'Validando datos...'}
                  {imp.status === 'importing' && `Importando ${imp.processed} de ${imp.total}...`}
                  {imp.status === 'completed' && `${imp.successCount} productos importados`}
                  {imp.status === 'error' && 'Error en la importación'}
                </p>

                {/* Barra de progreso */}
                {imp.status !== 'completed' && imp.status !== 'error' && (
                  <div className="mt-3">
                    <Progress value={imp.progress} className="h-1.5" />
                  </div>
                )}

                {/* Resumen si hay errores */}
                {imp.errors.length > 0 && (
                  <button
                    onClick={() => setExpandedId(expandedId === imp.id ? null : imp.id)}
                    className="flex items-center gap-1 mt-2 text-xs text-amber-600 hover:text-amber-700"
                  >
                    {imp.errors.length} errores encontrados
                    {expandedId === imp.id ? (
                      <ChevronUp className="w-3 h-3" />
                    ) : (
                      <ChevronDown className="w-3 h-3" />
                    )}
                  </button>
                )}
              </div>
            </div>

            {/* Detalles de errores expandibles */}
            <AnimatePresence>
              {expandedId === imp.id && imp.errors.length > 0 && (
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: 'auto' }}
                  exit={{ height: 0 }}
                  className="border-t border-slate-100 bg-slate-50"
                >
                  <ScrollArea className="max-h-32">
                    <div className="p-3 space-y-1">
                      {imp.errors.slice(0, 10).map((error, idx) => (
                        <p key={idx} className="text-xs text-red-600 flex items-start gap-1">
                          <AlertCircle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                          <span className="line-clamp-2">{error}</span>
                        </p>
                      ))}
                      {imp.errors.length > 10 && (
                        <p className="text-xs text-gray-500 text-center">
                          ... y {imp.errors.length - 10} errores más
                        </p>
                      )}
                    </div>
                  </ScrollArea>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Botón de cierre para completados */}
            {imp.status === 'completed' && (
              <div className="px-4 pb-3">
                <Button 
                  size="sm" 
                  variant="ghost" 
                  className="w-full h-8 text-xs"
                  onClick={() => onDismiss(imp.id)}
                >
                  Cerrar
                </Button>
              </div>
            )}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}