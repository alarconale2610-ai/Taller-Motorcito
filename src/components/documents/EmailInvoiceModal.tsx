'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Mail, CheckCircle, AlertCircle, FileText, Database } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { createClient } from '@/lib/supabase';

interface InvoiceItem {
  description: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  is_product: boolean;
}

type SendStatus = 'idle' | 'saving' | 'sending' | 'success' | 'error';

interface Props {
  invoice: {
    id: string;
    documentNumber: string;
    customer: any;
    items: InvoiceItem[];
    total: number;
    subtotal: number;
    iva: number;
    createdAt: string;
    branchConfig: any;
    type: 'sri_invoice' | 'note';
    htmlContent: string;
  };
  open: boolean;
  onClose: () => void;
}

interface TempRecord {
  id: string;
  invoice_id: string;
  html_content: string;
  created_at: string;
  expires_at: string;
}

export function EmailInvoiceModal({ invoice, open, onClose }: Props) {
  const [email, setEmail] = useState(invoice.customer?.email || '');
  const [status, setStatus] = useState<SendStatus>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const { toast } = useToast();

  const handleSend = async () => {
    if (!email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      toast({ title: 'Error', description: 'Correo inválido', variant: 'destructive' });
      return;
    }

    if (!invoice.htmlContent || invoice.htmlContent.length < 100) {
      toast({ title: 'Error', description: 'Sin contenido HTML', variant: 'destructive' });
      return;
    }

    let tempId: string;

    try {
      setStatus('saving');

      const supabase = createClient();

      await supabase
        .from('invoice_html_temp' as any)
        .delete()
        .eq('invoice_id', invoice.id);

      const { data, error } = await supabase
        .from('invoice_html_temp' as any)
        .insert({
          invoice_id: invoice.id,
          html_content: invoice.htmlContent,
          expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString()
        } as any)
        .select()
        .single();

      if (error) {
        throw new Error('Error guardando HTML: ' + error.message);
      }

      const record = data as unknown as TempRecord;
      
      if (!record || !record.id) {
        throw new Error('No se retornó ID del registro');
      }

      tempId = record.id;

      setStatus('sending');

      const payload = {
        tempId,
        invoiceId: invoice.id,
        documentNumber: invoice.documentNumber,
        customerEmail: email,
        customerName: invoice.customer?.name || '',
        items: invoice.items,
        total: invoice.total,
        subtotal: invoice.subtotal,
        iva: invoice.iva,
        branchConfig: invoice.branchConfig,
        htmlContent: invoice.htmlContent
      };

      const res = await fetch('/api/invoices/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const responseData = await res.json();

      if (!res.ok) {
        throw new Error(responseData.error || 'Error del servidor');
      }

      setStatus('success');
      toast({
        title: '¡Enviado! ✅',
        description: `Factura enviada a ${email}`,
        duration: 5000
      });

      setTimeout(() => {
        onClose();
        setStatus('idle');
      }, 2000);

    } catch (error: any) {
      setStatus('error');
      setErrorMessage(error.message);
      toast({
        title: 'Error ❌',
        description: error.message,
        variant: 'destructive',
        duration: 8000
      });
    }
  };

  const config = {
    idle: { color: 'bg-gray-50', icon: <Mail className="h-5 w-5" />, title: 'Listo', desc: 'Presione enviar' },
    saving: { color: 'bg-yellow-50', icon: <Database className="h-5 w-5 animate-pulse" />, title: 'Guardando...', desc: 'Preparando factura' },
    sending: { color: 'bg-blue-50', icon: <Loader2 className="animate-spin h-5 w-5" />, title: 'Enviando...', desc: 'Enviando correo' },
    success: { color: 'bg-green-50', icon: <CheckCircle className="h-5 w-5" />, title: '¡Enviado!', desc: `A: ${email}` },
    error: { color: 'bg-red-50', icon: <AlertCircle className="h-5 w-5" />, title: 'Error', desc: errorMessage }
  }[status];

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && status !== 'saving' && status !== 'sending' && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Enviar Factura por Email
          </DialogTitle>
        </DialogHeader>

        <div className={`rounded-lg border-2 p-4 flex items-center gap-3 ${config.color}`}>
          {config.icon}
          <div className="flex-1">
            <p className="font-semibold text-sm">{config.title}</p>
            <p className="text-xs opacity-80">{config.desc}</p>
          </div>
        </div>

        <div className="bg-gray-50 p-4 rounded-lg border space-y-2">
          <div className="flex justify-between">
            <span className="text-sm text-gray-600">Factura:</span>
            <span className="font-mono font-bold">{invoice.documentNumber}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-gray-600">Total:</span>
            <span className="font-bold text-blue-600">{formatCurrency(invoice.total)}</span>
          </div>
        </div>

        <div className={`p-3 rounded-lg border flex items-center gap-3 ${invoice.htmlContent ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
          <FileText className={`h-5 w-5 ${invoice.htmlContent ? 'text-green-600' : 'text-red-600'}`} />
          <div>
            <p className={`text-sm font-medium ${invoice.htmlContent ? 'text-green-800' : 'text-red-800'}`}>
              {invoice.htmlContent ? 'Contenido listo' : 'Sin contenido'}
            </p>
            <p className="text-xs text-gray-600">
              {invoice.htmlContent ? `${Math.round(invoice.htmlContent.length / 1024)} KB` : 'Error'}
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Correo electrónico *</label>
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={status === 'saving' || status === 'sending' || status === 'success'}
          />
        </div>

        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={onClose} disabled={status === 'saving' || status === 'sending'}>
            Cancelar
          </Button>
          <Button
            onClick={handleSend}
            disabled={status === 'saving' || status === 'sending' || status === 'success' || !email || !invoice.htmlContent}
          >
            {status === 'saving' ? 'Guardando...' :
             status === 'sending' ? 'Enviando...' :
             'Enviar Factura'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}