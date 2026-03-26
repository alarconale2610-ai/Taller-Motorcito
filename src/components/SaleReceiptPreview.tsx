'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Printer, ShoppingCart, X, CheckCircle, Usb, Monitor } from 'lucide-react';
import { BranchConfig } from '@/types/database';
import { formatCurrency } from '@/lib/utils';
import { useWebUsbPrinter } from '@/hooks/useWebUsbPrinter';
import { toast } from '@/hooks/use-toast';

interface CartItem {
  product_id: string;
  product_name: string;
  product_type: 'A' | 'B' | 'C' | 'D';
  quantity: number;
  unit_price: number;
  total: number;
}

interface SaleReceiptPreviewProps {
  isOpen: boolean;
  onClose: () => void;
  onNewSale: () => void;
  documentNumber: string;
  documentType?: string;
  items: CartItem[];
  subtotal: number;
  iva: number;
  total: number;
  paymentMethod: 'cash' | 'transfer' | 'card';
  cashReceived: number;
  change: number;
  customerName: string;
  customerPhone?: string;
  branchConfig: BranchConfig | null;
  userName?: string;
  saleDate: string;
  ivaPercent?: number;
}

export function SaleReceiptPreview({
  isOpen,
  onClose,
  onNewSale,
  documentNumber,
  documentType = 'NOTA DE VENTA',
  items,
  subtotal,
  iva,
  total,
  paymentMethod,
  cashReceived,
  change,
  customerName,
  customerPhone,
  branchConfig,
  userName,
  saleDate,
  ivaPercent = 15,
}: SaleReceiptPreviewProps) {
  const [isPrinting, setIsPrinting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [printMode, setPrintMode] = useState<'usb' | 'browser'>('browser');
  
  const {
    isSupported,
    isConnected,
    isConnecting,
    deviceInfo,
    connect,
    printReceipt,
  } = useWebUsbPrinter();

  const cleanText = (text: string | undefined | null) => {
    if (!text) return '';
    return text.replace(/\\n/g, '\n');
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('es-EC', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getPaymentMethodLabel = (method: string) => {
    switch (method) {
      case 'cash': return 'EFECTIVO';
      case 'transfer': return 'TRANSFERENCIA';
      case 'card': return 'TARJETA';
      default: return method;
    }
  };

  // Imprimir vía USB ESC/POS
  const handleUsbPrint = async () => {
    if (!isConnected) {
      const connected = await connect();
      if (!connected) return;
    }

    setIsPrinting(true);
    
    const success = await printReceipt({
      businessName: branchConfig?.business_name || 'TALLER MOTORCITO',
      ruc: branchConfig?.ruc,
      address: branchConfig?.company_address,
      phone: branchConfig?.company_phone,
      email: branchConfig?.company_email,
      documentType,
      documentNumber,
      date: formatDate(saleDate),
      cashier: userName || 'N/A',
      customerName,
      customerPhone,
      items: items.map(item => ({
        name: item.product_name,
        quantity: item.quantity,
        unitPrice: item.unit_price,
        total: item.total,
      })),
      subtotal,
      iva,
      ivaPercent: ivaPercent || branchConfig?.iva_percent || 15,
      total,
      paymentMethod: getPaymentMethodLabel(paymentMethod),
      cashReceived: paymentMethod === 'cash' ? cashReceived : undefined,
      change: paymentMethod === 'cash' ? change : undefined,
      header: cleanText(branchConfig?.receipt_header),
      footer: cleanText(branchConfig?.receipt_footer) || '¡Gracias por su preferencia!\nORIGINAL: CLIENTE / COPIA: EMISOR',
    });

    setIsPrinting(false);
    
    if (success) {
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 2000);
    }
  };

  // Imprimir vía navegador (iframe) - método original mejorado
  const handleBrowserPrint = () => {
    setIsPrinting(true);
    
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (!doc) {
      setIsPrinting(false);
      return;
    }

    const businessName = branchConfig?.business_name || 'TALLER MOTORCITO';
    const ruc = branchConfig?.ruc || '';
    const address = branchConfig?.company_address || '';
    const phone = branchConfig?.company_phone || '';
    const email = branchConfig?.company_email || '';
    const header = cleanText(branchConfig?.receipt_header);
    const footer = cleanText(branchConfig?.receipt_footer) || '¡Gracias por su preferencia!\nORIGINAL: CLIENTE / COPIA: EMISOR';
    const displayIvaPercent = ivaPercent || branchConfig?.iva_percent || 15;

    // HTML optimizado para impresoras térmicas 80mm
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${documentType} - ${documentNumber}</title>
        <style>
          @page {
            size: 80mm auto;
            margin: 0;
          }
          
          * { 
            margin: 0; 
            padding: 0; 
            box-sizing: border-box; 
          }
          
          body { 
            font-family: 'Arial', 'Helvetica', sans-serif; 
            font-size: 11px; 
            line-height: 1.3; 
            width: 72mm; 
            padding: 3mm; 
            margin: 0 auto;
            color: #000;
            background: #fff;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          
          .header {
            text-align: center;
            margin-bottom: 8px;
          }
          
          .business-name { 
            font-size: 14px; 
            font-weight: 900; 
            text-transform: uppercase;
            margin-bottom: 3px;
            letter-spacing: 0.5px;
          }
          
          .business-info {
            font-size: 10px;
            line-height: 1.4;
            color: #333;
          }
          
          .ruc-box {
            border: 1.5px solid #000;
            display: inline-block;
            padding: 2px 6px;
            margin: 4px 0;
            font-weight: bold;
            font-size: 10px;
          }
          
          .custom-header {
            text-align: center;
            font-size: 9px;
            margin: 6px 0;
            padding: 4px;
            background: #f5f5f5;
            border-left: 2px solid #000;
            font-style: italic;
          }
          
          .doc-box {
            border: 2px solid #000;
            padding: 8px;
            margin: 8px 0;
            text-align: center;
            background: #fafafa;
          }
          
          .doc-label {
            font-size: 9px;
            text-transform: uppercase;
            letter-spacing: 1px;
            margin-bottom: 2px;
            color: #555;
          }
          
          .doc-type {
            font-size: 13px;
            font-weight: 900;
            margin-bottom: 2px;
          }
          
          .doc-number {
            font-size: 12px;
            font-weight: bold;
            letter-spacing: 1px;
            color: #c00;
          }
          
          .info-box {
            margin: 8px 0;
            font-size: 10px;
          }
          
          .info-row {
            display: flex;
            justify-content: space-between;
            margin: 2px 0;
            border-bottom: 1px dotted #ccc;
            padding-bottom: 2px;
          }
          
          .customer-box {
            border: 1px dashed #666;
            padding: 6px;
            margin: 6px 0;
            background: #fff;
          }
          
          .customer-label {
            font-size: 8px;
            text-transform: uppercase;
            color: #666;
            font-weight: bold;
          }
          
          .customer-name {
            font-weight: 900;
            text-transform: uppercase;
            font-size: 11px;
          }
          
          .items-title {
            font-size: 10px;
            font-weight: 900;
            text-transform: uppercase;
            border-bottom: 2px solid #000;
            padding-bottom: 4px;
            margin: 12px 0 8px 0;
          }
          
          .item {
            margin: 6px 0;
            padding-bottom: 6px;
            border-bottom: 1px solid #eee;
          }
          
          .item-header {
            display: flex;
            justify-content: space-between;
            margin-bottom: 2px;
            align-items: flex-start;
          }
          
          .item-name {
            flex: 1;
            font-weight: 700;
            padding-right: 8px;
            word-wrap: break-word;
            line-height: 1.2;
          }
          
          .item-qty {
            background: #000;
            color: #fff;
            padding: 1px 5px;
            border-radius: 8px;
            font-size: 9px;
            min-width: 18px;
            text-align: center;
            flex-shrink: 0;
          }
          
          .item-details {
            display: flex;
            justify-content: space-between;
            font-size: 9px;
            color: #555;
            margin-top: 2px;
          }
          
          .item-total {
            font-weight: 700;
            color: #000;
          }
          
          .totals-box {
            margin-top: 12px;
            border-top: 2px solid #000;
            padding-top: 8px;
          }
          
          .total-row {
            display: flex;
            justify-content: space-between;
            margin: 3px 0;
            font-size: 10px;
          }
          
          .total-final {
            font-size: 13px;
            font-weight: 900;
            border-top: 2px solid #000;
            border-bottom: 2px solid #000;
            padding: 6px 0;
            margin: 8px 0;
            display: flex;
            justify-content: space-between;
          }
          
          .total-amount {
            color: #c00;
            font-size: 14px;
          }
          
          .payment-box {
            background: #f0f0f0;
            border: 1px solid #ccc;
            padding: 6px;
            text-align: center;
            margin: 8px 0;
            font-weight: 700;
            text-transform: uppercase;
            font-size: 10px;
          }
          
          .change-box {
            background: #e8f4f8;
            border: 1px solid #4a90e2;
            padding: 6px;
            margin: 6px 0;
            display: flex;
            justify-content: space-between;
            font-weight: 700;
            font-size: 10px;
          }
          
          .footer {
            margin-top: 15px;
            text-align: center;
            font-size: 9px;
            line-height: 1.4;
            white-space: pre-line;
            border-top: 1px dashed #999;
            padding-top: 8px;
            color: #555;
          }
          
          .legal-footer {
            margin-top: 8px;
            font-size: 8px;
            color: #777;
            text-align: center;
          }
          
          .cut-line {
            border-top: 2px dashed #999;
            margin: 12px 0 4px 0;
            position: relative;
          }
          
          .cut-line::after {
            content: "✂";
            position: absolute;
            left: 50%;
            top: -9px;
            background: #fff;
            padding: 0 4px;
            transform: translateX(-50%);
            font-size: 10px;
          }
          
          @media print {
            body { 
              width: 72mm; 
              padding: 0; 
              margin: 0;
            }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="business-name">${businessName}</div>
          ${ruc ? `<div class="ruc-box">RUC: ${ruc}</div>` : ''}
          <div class="business-info">
            ${address ? `<div>${address}</div>` : ''}
            ${phone ? `<div>Tel: ${phone}</div>` : ''}
            ${email ? `<div>${email}</div>` : ''}
          </div>
        </div>

        ${header ? `<div class="custom-header">${header}</div>` : ''}

        <div class="doc-box">
          <div class="doc-label">DOCUMENTO</div>
          <div class="doc-type">${documentType}</div>
          <div class="doc-number">N° ${documentNumber}</div>
        </div>

        <div class="info-box">
          <div class="info-row">
            <span><strong>Fecha:</strong></span>
            <span>${formatDate(saleDate)}</span>
          </div>
          <div class="info-row">
            <span><strong>Cajero:</strong></span>
            <span>${userName || 'N/A'}</span>
          </div>
          <div class="customer-box">
            <div class="customer-label">CLIENTE</div>
            <div class="customer-name">${customerName.toUpperCase()}</div>
            ${customerPhone ? `<div style="font-size:9px; margin-top:2px;">Tel: ${customerPhone}</div>` : ''}
          </div>
        </div>

        <div class="items-title">DETALLE DE PRODUCTOS</div>
        ${items.map(item => `
          <div class="item">
            <div class="item-header">
              <span class="item-name">${item.product_name}</span>
              <span class="item-qty">${item.quantity}</span>
            </div>
            <div class="item-details">
              <span>${formatCurrency(item.unit_price)} c/u</span>
              <span class="item-total">${formatCurrency(item.total)}</span>
            </div>
          </div>
        `).join('')}

        ${items.length === 0 ? '<div style="text-align:center; color:#999; padding:8px;">No hay productos</div>' : ''}

        <div class="totals-box">
          <div class="total-row">
            <span>Subtotal:</span>
            <span>${formatCurrency(subtotal)}</span>
          </div>
          <div class="total-row">
            <span>IVA (${displayIvaPercent}%):</span>
            <span>${formatCurrency(iva)}</span>
          </div>
          <div class="total-final">
            <span>TOTAL:</span>
            <span class="total-amount">${formatCurrency(total)}</span>
          </div>
          
          <div class="payment-box">
            MÉTODO DE PAGO: ${getPaymentMethodLabel(paymentMethod)}
          </div>

          ${paymentMethod === 'cash' && change > 0 ? `
            <div class="change-box">
              <span>CAMBIO:</span>
              <span>${formatCurrency(change)}</span>
            </div>
          ` : ''}
        </div>

        <div class="footer">${footer}</div>
        
        <div class="legal-footer">
          --- ${businessName} ---<br>
          Documento generado electrónicamente
        </div>

        <div class="cut-line"></div>
      </body>
      </html>
    `;

    doc.open();
    doc.write(htmlContent);
    doc.close();

    iframe.onload = () => {
      setTimeout(() => {
        iframe.contentWindow?.focus();
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

  const handlePrint = () => {
    if (printMode === 'usb') {
      handleUsbPrint();
    } else {
      handleBrowserPrint();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg max-h-[95vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5" />
              {documentType} - {documentNumber}
            </span>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </DialogTitle>
        </DialogHeader>

        {/* Selector de modo de impresión */}
        <div className="flex gap-2 mb-4 p-3 bg-slate-50 rounded-lg border border-slate-200">
          <Button
            variant={printMode === 'browser' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setPrintMode('browser')}
            className="flex-1 gap-2"
          >
            <Monitor className="h-4 w-4" />
            Navegador
          </Button>
          <Button
            variant={printMode === 'usb' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setPrintMode('usb')}
            className="flex-1 gap-2"
            disabled={!isSupported}
          >
            <Usb className="h-4 w-4" />
            USB Directo
            {isConnected && <span className="w-2 h-2 bg-green-500 rounded-full ml-1" />}
          </Button>
        </div>

        {!isSupported && printMode === 'usb' && (
          <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
            <strong>Nota:</strong> Su navegador no soporta Web USB. Use Chrome o Edge para impresión USB directa.
          </div>
        )}

        {printMode === 'usb' && isConnected && deviceInfo && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-sm">
            <strong>Conectada:</strong> {deviceInfo.productName}
          </div>
        )}

        {/* Vista previa */}
        <div className="bg-gray-100 p-4 rounded-lg my-4 border-2 border-dashed border-gray-300">
          <div className="bg-white p-4 shadow-lg mx-auto" style={{ width: '100%', maxWidth: '320px', fontFamily: 'Arial, sans-serif', fontSize: '11px' }}>
            <div className="text-center border-b-2 border-black pb-2 mb-2">
              <div className="font-black text-base uppercase tracking-wide">{branchConfig?.business_name || 'TALLER'}</div>
              {branchConfig?.ruc && <div className="text-xs font-bold border border-black inline-block px-2 mt-1">RUC: {branchConfig.ruc}</div>}
            </div>
            
            <div className="text-center border-2 border-black p-2 mb-2 bg-gray-50">
              <div className="font-bold text-sm">{documentType}</div>
              <div className="font-black text-red-600 text-lg">N° {documentNumber}</div>
            </div>

            <div className="space-y-1 text-xs mb-3">
              <div className="flex justify-between border-b border-dotted border-gray-400 pb-1">
                <span className="font-bold">Fecha:</span>
                <span>{formatDate(saleDate)}</span>
              </div>
              <div className="flex justify-between border-b border-dotted border-gray-400 pb-1">
                <span className="font-bold">Cliente:</span>
                <span className="uppercase font-bold">{customerName}</span>
              </div>
            </div>

            <div className="border-b-2 border-black font-black text-xs mb-2 flex justify-between uppercase">
              <span>Producto</span>
              <span>Total</span>
            </div>
            
            {items.map((item, i) => (
              <div key={i} className="flex justify-between text-xs py-1 border-b border-gray-200">
                <span className="flex-1 pr-2"><span className="bg-black text-white px-1.5 rounded-full text-[10px] mr-1">{item.quantity}</span>{item.product_name.substring(0, 20)}</span>
                <span className="font-bold">{formatCurrency(item.total)}</span>
              </div>
            ))}

            <div className="mt-3 space-y-1 text-xs border-t-2 border-black pt-2">
              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span>{formatCurrency(subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span>IVA ({ivaPercent || 15}%):</span>
                <span>{formatCurrency(iva)}</span>
              </div>
              <div className="flex justify-between font-black text-base border-t-2 border-b-2 border-black py-2 my-2">
                <span>TOTAL:</span>
                <span className="text-red-600 text-lg">{formatCurrency(total)}</span>
              </div>
            </div>
            
            <div className="text-center text-[10px] text-gray-500 mt-2 bg-gray-100 p-1 border border-gray-300">
              {getPaymentMethodLabel(paymentMethod)}
            </div>
          </div>
        </div>

        {/* Botones */}
        <div className="flex flex-col gap-2">
          {printMode === 'usb' && !isConnected && (
            <Button 
              onClick={connect} 
              variant="outline"
              className="w-full h-10"
              disabled={isConnecting}
            >
              {isConnecting ? 'Conectando...' : 'Conectar Impresora USB'}
            </Button>
          )}
          
          <Button 
            onClick={handlePrint} 
            className="w-full bg-blue-600 hover:bg-blue-700 h-12 text-lg font-bold"
            disabled={isPrinting || (printMode === 'usb' && !isConnected)}
          >
            {showSuccess ? <CheckCircle className="mr-2 h-5 w-5" /> : <Printer className="mr-2 h-5 w-5" />}
            {isPrinting ? 'Preparando...' : showSuccess ? '¡Listo!' : printMode === 'usb' ? 'Imprimir por USB' : 'Imprimir Ticket'}
          </Button>
          
          <div className="flex gap-2">
            <Button onClick={onNewSale} variant="outline" className="flex-1">
              <ShoppingCart className="mr-2 h-4 w-4" />
              Nueva Venta
            </Button>
            <Button onClick={onClose} variant="outline" className="flex-1">
              Cerrar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}