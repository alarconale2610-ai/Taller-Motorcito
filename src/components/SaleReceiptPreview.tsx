'use client';

import { useRef, useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Printer, ShoppingCart, X, CheckCircle } from 'lucide-react';
import { BranchConfig } from '@/types/database';
import { formatCurrency } from '@/lib/utils';

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

  const handlePrint = () => {
    setIsPrinting(true);
    
    // Crear iframe oculto (más confiable que window.open)
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

    // Datos
    const businessName = branchConfig?.business_name || 'TALLER MOTORCITO';
    const ruc = branchConfig?.ruc || '';
    const address = branchConfig?.company_address || '';
    const phone = branchConfig?.company_phone || '';
    const email = branchConfig?.company_email || '';
    const header = cleanText(branchConfig?.receipt_header);
    const footer = cleanText(branchConfig?.receipt_footer) || '¡Gracias por su preferencia!\nORIGINAL: CLIENTE / COPIA: EMISOR';
    const displayIvaPercent = ivaPercent || branchConfig?.iva_percent || 15;

    // Construir HTML completo con estilos INLINE 100%
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>${documentType} - ${documentNumber}</title>
        <style>
          /* RESET Y BASE */
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { 
            font-family: 'Courier New', Courier, monospace; 
            font-size: 12px; 
            line-height: 1.4; 
            width: 80mm; 
            padding: 3mm; 
            color: #000;
            background: #fff;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          
          /* HEADER */
          .header {
            text-align: center;
            border-bottom: 3px double #000;
            padding-bottom: 10px;
            margin-bottom: 10px;
          }
          .business-name { 
            font-size: 16px; 
            font-weight: bold; 
            text-transform: uppercase;
            margin-bottom: 5px;
          }
          .business-info {
            font-size: 11px;
            line-height: 1.5;
          }
          .ruc-box {
            border: 2px solid #000;
            display: inline-block;
            padding: 2px 8px;
            margin: 5px 0;
            font-weight: bold;
            font-size: 11px;
          }
          
          /* CUSTOM HEADER */
          .custom-header {
            text-align: center;
            font-style: italic;
            font-size: 10px;
            margin: 8px 0;
            padding: 5px;
            background: #f5f5f5;
            border-left: 3px solid #000;
          }
          
          /* DOCUMENTO BOX */
          .doc-box {
            border: 2px solid #000;
            padding: 10px;
            margin: 10px 0;
            text-align: center;
            background: #fafafa;
          }
          .doc-label {
            font-size: 10px;
            text-transform: uppercase;
            letter-spacing: 1px;
            margin-bottom: 3px;
          }
          .doc-type {
            font-size: 14px;
            font-weight: bold;
            margin-bottom: 3px;
          }
          .doc-number {
            font-size: 13px;
            font-weight: bold;
            letter-spacing: 1px;
            color: #c00;
          }
          
          /* INFO SECTION */
          .info-box {
            margin: 10px 0;
            font-size: 11px;
          }
          .info-row {
            display: flex;
            justify-content: space-between;
            margin: 3px 0;
            border-bottom: 1px dotted #ccc;
            padding-bottom: 2px;
          }
          .customer-box {
            border: 1px dashed #999;
            padding: 8px;
            margin: 8px 0;
            background: #fff;
          }
          .customer-label {
            font-size: 9px;
            text-transform: uppercase;
            color: #666;
            font-weight: bold;
          }
          .customer-name {
            font-weight: bold;
            text-transform: uppercase;
            font-size: 12px;
          }
          
          /* PRODUCTOS */
          .items-title {
            font-size: 11px;
            font-weight: bold;
            text-transform: uppercase;
            border-bottom: 2px solid #000;
            padding-bottom: 5px;
            margin: 15px 0 10px 0;
          }
          .item {
            margin: 8px 0;
            padding-bottom: 8px;
            border-bottom: 1px solid #eee;
          }
          .item-header {
            display: flex;
            justify-content: space-between;
            margin-bottom: 3px;
          }
          .item-name {
            flex: 1;
            font-weight: bold;
            padding-right: 10px;
          }
          .item-qty {
            background: #000;
            color: #fff;
            padding: 2px 6px;
            border-radius: 10px;
            font-size: 10px;
            min-width: 20px;
            text-align: center;
          }
          .item-details {
            display: flex;
            justify-content: space-between;
            font-size: 10px;
            color: #666;
          }
          .item-total {
            font-weight: bold;
            color: #000;
          }
          
          /* TOTALES */
          .totals-box {
            margin-top: 15px;
            border-top: 2px solid #000;
            padding-top: 10px;
          }
          .total-row {
            display: flex;
            justify-content: space-between;
            margin: 5px 0;
            font-size: 11px;
          }
          .total-final {
            font-size: 14px;
            font-weight: bold;
            border-top: 2px solid #000;
            border-bottom: 2px solid #000;
            padding: 8px 0;
            margin: 10px 0;
            display: flex;
            justify-content: space-between;
          }
          .total-amount {
            color: #c00;
            font-size: 16px;
          }
          
          /* PAYMENT */
          .payment-box {
            background: #f0f0f0;
            border: 1px solid #ccc;
            padding: 8px;
            text-align: center;
            margin: 10px 0;
            font-weight: bold;
            text-transform: uppercase;
          }
          .change-box {
            background: #e8f4f8;
            border: 1px solid #4a90e2;
            padding: 8px;
            margin: 8px 0;
            display: flex;
            justify-content: space-between;
            font-weight: bold;
          }
          
          /* FOOTER */
          .footer {
            margin-top: 20px;
            text-align: center;
            font-size: 10px;
            line-height: 1.5;
            white-space: pre-line;
            border-top: 1px dashed #999;
            padding-top: 10px;
          }
          .legal-footer {
            margin-top: 10px;
            font-size: 9px;
            color: #666;
            text-align: center;
          }
          .cut-line {
            border-top: 2px dashed #999;
            margin: 15px 0 5px 0;
            position: relative;
          }
          .cut-line::after {
            content: "✂";
            position: absolute;
            left: 50%;
            top: -10px;
            background: #fff;
            padding: 0 5px;
            transform: translateX(-50%);
          }
          
          @media print {
            body { width: 80mm; padding: 0; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <!-- HEADER -->
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

        <!-- DOCUMENTO -->
        <div class="doc-box">
          <div class="doc-label">DOCUMENTO</div>
          <div class="doc-type">${documentType}</div>
          <div class="doc-number">N° ${documentNumber}</div>
        </div>

        <!-- INFO -->
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
            ${customerPhone ? `<div style="font-size:10px; margin-top:3px;">Tel: ${customerPhone}</div>` : ''}
          </div>
        </div>

        <!-- PRODUCTOS -->
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

        ${items.length === 0 ? '<div style="text-align:center; color:#999; padding:10px;">No hay productos</div>' : ''}

        <!-- TOTALES -->
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

        <!-- FOOTER -->
        <div class="footer">${footer}</div>
        
        <div class="legal-footer">
          --- Mi Taller Mecánico ---<br>
          Documento generado electrónicamente
        </div>

        <div class="cut-line"></div>
      </body>
      </html>
    `;

    doc.open();
    doc.write(htmlContent);
    doc.close();

    // Esperar a que todo cargue y luego imprimir
    iframe.onload = () => {
      setTimeout(() => {
        iframe.contentWindow?.print();
        
        // Limpiar después de imprimir
        setTimeout(() => {
          document.body.removeChild(iframe);
          setIsPrinting(false);
          setShowSuccess(true);
          setTimeout(() => setShowSuccess(false), 2000);
        }, 1000);
      }, 500); // Dar tiempo a que renderice
    };
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

        {/* Vista previa simple (sin complicaciones) */}
        <div className="bg-gray-100 p-4 rounded-lg my-4 border-2 border-dashed border-gray-300">
          <div className="bg-white p-4 shadow-lg mx-auto" style={{ width: '100%', maxWidth: '320px', fontFamily: 'monospace', fontSize: '12px' }}>
            <div className="text-center border-b-2 border-black pb-2 mb-2">
              <div className="font-bold text-lg uppercase">{branchConfig?.business_name || 'TALLER'}</div>
              {branchConfig?.ruc && <div className="text-xs">RUC: {branchConfig.ruc}</div>}
            </div>
            
            <div className="text-center border border-black p-2 mb-2">
              <div className="font-bold">{documentType}</div>
              <div className="font-bold text-red-600">N° {documentNumber}</div>
            </div>

            <div className="space-y-1 text-xs mb-3">
              <div className="flex justify-between"><span>Fecha:</span><span>{formatDate(saleDate)}</span></div>
              <div className="flex justify-between"><span>Cliente:</span><span className="uppercase">{customerName}</span></div>
            </div>

            <div className="border-b border-black font-bold text-xs mb-1 flex justify-between">
              <span>Producto</span>
              <span>Total</span>
            </div>
            
            {items.map((item, i) => (
              <div key={i} className="flex justify-between text-xs py-1 border-b border-gray-200">
                <span>{item.quantity}x {item.product_name.substring(0, 15)}</span>
                <span>{formatCurrency(item.total)}</span>
              </div>
            ))}

            <div className="mt-3 space-y-1 text-xs">
              <div className="flex justify-between"><span>Subtotal:</span><span>{formatCurrency(subtotal)}</span></div>
              <div className="flex justify-between"><span>IVA ({ivaPercent || 15}%):</span><span>{formatCurrency(iva)}</span></div>
              <div className="flex justify-between font-bold text-base border-t-2 border-black pt-1 mt-1">
                <span>TOTAL:</span>
                <span className="text-red-600">{formatCurrency(total)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Botones */}
        <div className="flex flex-col gap-2">
          <Button 
            onClick={handlePrint} 
            className="w-full bg-blue-600 hover:bg-blue-700 h-12 text-lg font-bold"
            disabled={isPrinting}
          >
            {showSuccess ? <CheckCircle className="mr-2 h-5 w-5" /> : <Printer className="mr-2 h-5 w-5" />}
            {isPrinting ? 'Preparando...' : showSuccess ? '¡Listo!' : 'Imprimir Ticket'}
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