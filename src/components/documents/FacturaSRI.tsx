'use client';

import { useState, useMemo } from 'react';
import { WorkOrder, Customer, Vehicle, WorkOrderItem, BranchConfig } from '@/types/database';
import { Printer, CheckCircle, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/utils';
import { EmailInvoiceModal } from './EmailInvoiceModal';
import { generateSRIInvoiceHTML } from '@/lib/documents/sri-invoice-template';
import { useToast } from '@/hooks/use-toast';

interface Props {
  order: WorkOrder;
  customer: Customer | null;
  vehicle: Vehicle | undefined;
  items: WorkOrderItem[];
  branchConfig: BranchConfig | null;
  documentNumber: string;
  ivaPercent?: number;
  accessKey?: string;
}

export function FacturaSRI(props: Props) {
  const { order, customer, vehicle, items, branchConfig, documentNumber, ivaPercent = 12, accessKey } = props;
  
  const [isPrinting, setIsPrinting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const { toast } = useToast();

  // Cálculos
  const subtotal = useMemo(() => items.reduce((sum, item) => sum + (item.total_price || 0), 0), [items]);
  const iva = useMemo(() => subtotal * (ivaPercent / 100), [subtotal, ivaPercent]);
  const total = useMemo(() => subtotal + iva, [subtotal, iva]);

  // HTML de la factura
  const invoiceHTML = useMemo(() => {
    return generateSRIInvoiceHTML({
      order, customer, vehicle, items, branchConfig, documentNumber, 
      ivaPercent, accessKey, subtotal, iva, total
    });
  }, [order, customer, vehicle, items, branchConfig, documentNumber, ivaPercent, accessKey, subtotal, iva, total]);

  // Datos para el modal
  const invoiceData = useMemo(() => ({
    id: order.id,
    documentNumber,
    customer,
    items,
    total,
    subtotal,
    iva,
    createdAt: order.created_at,
    branchConfig,
    type: 'sri_invoice' as const,
    htmlContent: invoiceHTML
  }), [order.id, documentNumber, customer, items, total, subtotal, iva, order.created_at, branchConfig, invoiceHTML]);

  const handlePrint = () => {
    setIsPrinting(true);
    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
    document.body.appendChild(iframe);
    const doc = iframe.contentWindow?.document;
    if (!doc) return;
    doc.open();
    doc.write(invoiceHTML);
    doc.close();
    iframe.onload = () => {
      setTimeout(() => {
        iframe.contentWindow?.print();
        setTimeout(() => {
          document.body.removeChild(iframe);
          setIsPrinting(false);
          setShowSuccess(true);
          setTimeout(() => setShowSuccess(false), 2000);
        }, 1000);
      }, 500);
    };
  };

  const handleEmailClick = () => {
    if (!customer?.email) {
      toast({ title: 'Sin correo', description: 'El cliente no tiene email.', variant: 'destructive' });
      return;
    }
    
    if (!invoiceData.htmlContent || invoiceData.htmlContent.length < 100) {
      toast({ title: 'Error', description: 'No se generó el HTML.', variant: 'destructive' });
      return;
    }
    
    setShowEmailModal(true);
  };

  return (
    <div className="space-y-4">
      <div className="bg-gray-100 p-4 rounded-lg border-2 border-dashed border-gray-300 overflow-auto">
        <div
          className="bg-white p-6 shadow-lg mx-auto"
          style={{ width: '100%', maxWidth: '800px', fontFamily: 'Courier New, monospace', fontSize: '11px' }}
          dangerouslySetInnerHTML={{ __html: invoiceHTML }}
        />
      </div>

      <div className="flex gap-2">
        <Button onClick={handlePrint} className="flex-1 bg-blue-600 hover:bg-blue-700 h-12 text-lg font-bold" disabled={isPrinting}>
          {showSuccess ? <CheckCircle className="mr-2 h-5 w-5" /> : <Printer className="mr-2 h-5 w-5" />}
          {isPrinting ? 'Preparando...' : showSuccess ? '¡Listo!' : 'Imprimir'}
        </Button>

        <Button onClick={handleEmailClick} variant="outline" className="h-12 px-6" disabled={!customer?.email}>
          <Mail className="h-5 w-5 mr-2" />
          Enviar Email
        </Button>
      </div>

      {showEmailModal && (
        <EmailInvoiceModal
          invoice={invoiceData}
          open={showEmailModal}
          onClose={() => setShowEmailModal(false)}
        />
      )}
    </div>
  );
}