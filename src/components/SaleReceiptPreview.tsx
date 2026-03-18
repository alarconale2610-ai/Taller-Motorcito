'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Printer, CheckCircle, Receipt } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { CartItem } from '@/types/database';

interface BranchConfig {
  business_name: string;
  company_name: string;
  company_ruc: string;
  company_address: string;
  company_phone: string;
  establishment_code: string;
  emission_point: string;
  receipt_header?: string;
  receipt_footer?: string;
  iva_percent: number;
}

interface SaleReceiptPreviewProps {
  isOpen: boolean;
  onClose: () => void;
  onNewSale: () => void;
  documentNumber: string;
  items: CartItem[];
  subtotal: number;
  iva: number;
  total: number;
  paymentMethod: 'cash' | 'card' | 'transfer' | 'credit';
  cashReceived?: number;
  change?: number;
  customerName: string;
  branchConfig: BranchConfig | null;
  userName?: string;
  saleDate: string;
}

export function SaleReceiptPreview({
  isOpen,
  onClose,
  onNewSale,
  documentNumber,
  items,
  subtotal,
  iva,
  total,
  paymentMethod,
  cashReceived,
  change,
  customerName,
  branchConfig,
  userName,
  saleDate,
}: SaleReceiptPreviewProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const getPaymentMethodLabel = (method: string) => {
    const methods: Record<string, string> = {
      cash: 'Efectivo',
      card: 'Tarjeta',
      transfer: 'Transferencia',
      credit: 'Crédito',
    };
    return methods[method] || method;
  };

  const handlePrint = () => {
    window.print();
  };

  if (!mounted) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[400px] max-h-[90vh] p-0 gap-0 flex flex-col print:max-w-none print:w-[80mm] print:p-0 print:m-0 print:border-0 print:max-h-none">
        {/* Header (oculto en print) */}
        <div className="print:hidden flex-shrink-0">
          <DialogHeader className="p-6 pb-2">
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5" />
              Venta Completada - {documentNumber}
            </DialogTitle>
          </DialogHeader>
        </div>

        {/* ScrollArea para el ticket */}
        <ScrollArea className="flex-1 overflow-y-auto print:overflow-visible">
          <div className="bg-white p-6 print:p-2 print:w-[80mm] print:max-w-[80mm] print:m-0 print:shadow-none">
            {/* Estilos de impresión */}
            <style jsx global>{`
              @media print {
                @page {
                  size: 80mm auto;
                  margin: 0;
                }
                body * {
                  visibility: hidden;
                }
                .print-area, .print-area * {
                  visibility: visible;
                }
                .print-area {
                  position: absolute;
                  left: 0;
                  top: 0;
                  width: 80mm;
                  padding: 5mm;
                }
                .no-print {
                  display: none !important;
                }
              }
            `}</style>

            <div className="print-area space-y-3 text-sm">
              {/* Header Empresa */}
              <div className="text-center space-y-1">
                <h2 className="font-bold text-base uppercase tracking-tight">
                  {branchConfig?.business_name || branchConfig?.company_name || 'TALLER WEB'}
                </h2>
                <p className="text-xs text-gray-600">
                  RUC: {branchConfig?.company_ruc || '0000000000000'}
                </p>
                <p className="text-xs text-gray-600 whitespace-pre-line">
                  {branchConfig?.company_address || ''}
                </p>
                <p className="text-xs text-gray-600">
                  Tel: {branchConfig?.company_phone || ''}
                </p>
                
                {branchConfig?.receipt_header && (
                  <p className="text-xs text-gray-600 mt-2 italic">
                    {branchConfig.receipt_header}
                  </p>
                )}
              </div>

              <Separator className="border-dashed border-gray-400" />

              {/* Info Documento */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-600">Documento:</span>
                  <span className="font-mono font-bold text-xs">
                    {documentNumber || '001-001-000000001'}
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-600">Fecha:</span>
                  <span className="text-xs">{new Date(saleDate).toLocaleString('es-EC')}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-600">Cajero:</span>
                  <span className="truncate max-w-[120px] text-xs">{userName || 'Admin'}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-600">Cliente:</span>
                  <span className="truncate max-w-[150px] text-xs">{customerName}</span>
                </div>
              </div>

              <Separator className="border-dashed border-gray-400" />

              {/* Items */}
              <div className="space-y-2">
                <div className="text-xs font-bold uppercase tracking-wider text-gray-500 border-b border-gray-300 pb-1">
                  Descripción
                </div>
                {items.map((item, index) => (
                  <div key={index} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="flex-1 pr-2 text-xs leading-tight">{item.product_name}</span>
                      <span className="font-mono text-xs">x{item.quantity}</span>
                    </div>
                    <div className="flex justify-between text-xs pl-2">
                      <span className="text-gray-500 text-xs">
                        {formatCurrency(item.unit_price)} c/u
                      </span>
                      <span className="font-mono font-medium text-xs">
                        {formatCurrency(item.total)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              <Separator className="border-dashed border-gray-400" />

              {/* Totales */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-600">Subtotal:</span>
                  <span className="font-mono text-xs">{formatCurrency(subtotal)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-600">
                    IVA ({branchConfig?.iva_percent || 15}%):
                  </span>
                  <span className="font-mono text-xs">{formatCurrency(iva)}</span>
                </div>
                <div className="flex justify-between text-sm font-bold mt-2 pt-2 border-t border-dashed border-gray-400">
                  <span>TOTAL:</span>
                  <span className="font-mono">{formatCurrency(total)}</span>
                </div>
              </div>

              {/* Pago */}
              <div className="space-y-1 bg-gray-50 p-2 rounded text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-600">Método de pago:</span>
                  <span className="uppercase font-medium">{getPaymentMethodLabel(paymentMethod)}</span>
                </div>
                {paymentMethod === 'cash' && cashReceived !== undefined && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Recibido:</span>
                      <span className="font-mono">{formatCurrency(cashReceived)}</span>
                    </div>
                    {change !== undefined && change >= 0 && (
                      <div className="flex justify-between font-bold text-green-700">
                        <span>Cambio:</span>
                        <span className="font-mono">{formatCurrency(change)}</span>
                      </div>
                    )}
                  </>
                )}
              </div>

              <Separator className="border-dashed border-gray-400" />

              {/* Footer */}
              <div className="text-center space-y-2 pt-2">
                <div className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">
                  *** Gracias por su compra ***
                </div>
                
                {branchConfig?.receipt_footer && (
                  <p className="text-[10px] text-gray-500 whitespace-pre-line">
                    {branchConfig.receipt_footer}
                  </p>
                )}
                
                <div className="text-[9px] text-gray-400 mt-4">
                  Documento sin valor tributario
                </div>
                
                <div className="mt-6 pt-4">
                  <div className="border-t border-gray-400 w-32 mx-auto pt-1">
                    <span className="text-[10px] text-gray-500">Firma Cliente</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </ScrollArea>

        {/* Botones fijos abajo (ocultos en print) */}
        <DialogFooter className="p-4 pt-2 border-t bg-gray-50 flex-row gap-2 print:hidden flex-shrink-0">
          <Button variant="outline" onClick={handlePrint} className="flex-1">
            <Printer className="h-4 w-4 mr-2" />
            Imprimir
          </Button>
          <Button onClick={onNewSale} className="flex-1 bg-green-600 hover:bg-green-700">
            <CheckCircle className="h-4 w-4 mr-2" />
            Nueva Venta
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}