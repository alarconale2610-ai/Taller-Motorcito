// src/components/inventory/ImportPreviewModal.tsx
'use client';

import { motion } from 'framer-motion';
import { 
  FileSpreadsheet, 
  X,
  Upload,
  AlertTriangle,
  CheckCircle2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { getProductTypeColor } from '@/lib/utils';
import { ImportErrorDetails } from './ImportErrorDetails';
import { SanitizedProduct, ValidationError } from '@/lib/excel-sanitizer';

interface ImportPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  onAutoFix?: () => void;
  preview: SanitizedProduct[];
  errors: ValidationError[];
  warnings: ValidationError[];
  isImporting: boolean;
  autoFixableCount: number;
}

function formatSafeNumber(value: any): string {
  if (value === undefined || value === null || value === '') return '-';
  const num = Number(value);
  if (isNaN(num)) return '-';
  return num.toString();
}

function formatSafeCurrency(value: any): string {
  if (value === undefined || value === null || value === '') return '-';
  const num = Number(value);
  if (isNaN(num)) return '-';
  return `$${num.toFixed(2)}`;
}

export function ImportPreviewModal({
  isOpen,
  onClose,
  onConfirm,
  onAutoFix,
  preview,
  errors,
  warnings,
  isImporting,
  autoFixableCount
}: ImportPreviewModalProps) {
  if (!isOpen) return null;

  const hasErrors = errors.length > 0;
  const canImport = preview.length > 0 && !isImporting && errors.length === 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              Vista Previa de Importación
            </h2>
            <div className="flex items-center gap-4 mt-1">
              <p className="text-sm text-gray-500">
                Productos válidos: <span className="font-semibold text-gray-900">{preview.length}</span>
              </p>
              {errors.length > 0 && (
                <span className="flex items-center gap-1 text-sm text-red-600">
                  <AlertTriangle className="w-4 h-4" />
                  {errors.length} errores
                </span>
              )}
              {warnings.length > 0 && (
                <span className="flex items-center gap-1 text-sm text-amber-600">
                  <AlertTriangle className="w-4 h-4" />
                  {warnings.length} advertencias
                </span>
              )}
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="flex-1 overflow-auto p-6 space-y-4">
          {/* Errores Detallados */}
          {(errors.length > 0 || warnings.length > 0) && (
            <ImportErrorDetails 
              errors={errors} 
              warnings={warnings}
              onAutoFix={onAutoFix}
              autoFixableCount={autoFixableCount}
            />
          )}

          {/* Tabla de Preview */}
          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <div className="grid grid-cols-12 gap-4 px-4 py-3 bg-slate-50 border-b text-xs font-medium text-gray-500 uppercase tracking-wider">
              <div className="col-span-4">Nombre</div>
              <div className="col-span-2">Tipo</div>
              <div className="col-span-2 text-center">Stock</div>
              <div className="col-span-2 text-right">Costo</div>
              <div className="col-span-2 text-right">Venta</div>
            </div>
            
            <ScrollArea className="h-48">
              <div className="divide-y divide-slate-100">
                {preview.map((product, idx) => (
                  <div 
                    key={idx} 
                    className="grid grid-cols-12 gap-4 px-4 py-3 items-center hover:bg-slate-50/50 text-sm"
                  >
                    <div className="col-span-4">
                      <p className="font-medium text-gray-900 truncate">
                        {product.name || 'Sin nombre'}
                      </p>
                      {product.barcode && (
                        <p className="text-xs text-gray-400 font-mono truncate">
                          {product.barcode}
                        </p>
                      )}
                    </div>
                    <div className="col-span-2">
                      <Badge className={`${getProductTypeColor(product.type)} text-white text-xs font-normal`}>
                        {product.type}
                      </Badge>
                    </div>
                    <div className="col-span-2 text-center text-gray-600">
                      {formatSafeNumber(product.stock)}
                    </div>
                    <div className="col-span-2 text-right text-gray-600">
                      {formatSafeCurrency(product.cost_price)}
                    </div>
                    <div className="col-span-2 text-right text-gray-600">
                      {formatSafeCurrency(product.sale_price)}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>

          {/* Mensaje de éxito si todo está bien */}
          {!hasErrors && preview.length > 0 && (
            <div className="flex items-center gap-2 p-4 bg-green-50 text-green-700 rounded-lg">
              <CheckCircle2 className="w-5 h-5" />
              <span className="text-sm font-medium">
                Todo listo para importar {preview.length} productos
              </span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 pt-0 flex items-center justify-end gap-3 border-t border-slate-100 mt-4 pt-4">
          <Button
            variant="outline"
            onClick={onClose}
            className="border-slate-200 text-slate-700"
            disabled={isImporting}
          >
            Cancelar
          </Button>
          <Button
            onClick={onConfirm}
            disabled={!canImport}
            className="bg-slate-800 hover:bg-slate-700 text-white"
          >
            {isImporting ? (
              <>
                <div className="w-4 h-4 mr-2 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Importando...
              </>
            ) : (
              <>
                <Upload className="w-4 h-4 mr-2" />
                Importar {preview.length} Productos
              </>
            )}
          </Button>
        </div>
      </motion.div>
    </div>
  );
}