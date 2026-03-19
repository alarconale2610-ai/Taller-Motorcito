'use client';

import { useState } from 'react';
import { WorkOrder, Customer, Vehicle, WorkOrderItem, BranchConfig } from '@/types/database';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Printer, CheckCircle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/utils';

interface Props {
  order: WorkOrder;
  customer: Customer | null;
  vehicle: Vehicle | undefined;
  items: WorkOrderItem[];
  branchConfig: BranchConfig | null;
  documentNumber: string;
  ivaPercent?: number;
}

export function NotaVenta80mm({
  order,
  customer,
  vehicle,
  items,
  branchConfig,
  documentNumber,
  ivaPercent = 12,
}: Props) {
  const [isPrinting, setIsPrinting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const cleanText = (text: string | undefined | null) => {
    if (!text) return '';
    return text.replace(/\\n/g, '\n');
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

    // Datos de la sucursal desde Settings
    const businessName = branchConfig?.business_name || 'TALLER';
    const ruc = branchConfig?.ruc || '';
    const address = branchConfig?.company_address || '';
    const phone = branchConfig?.company_phone || '';
    const header = cleanText(branchConfig?.receipt_header);
    const footer = cleanText(branchConfig?.receipt_footer) || '¡Gracias por su preferencia!\nDocumento sin valor tributario';

    // Cálculos
    const total = items.reduce((sum, item) => sum + (item.total_price || 0), 0);
    const ivaRate = ivaPercent / 100;
    const subtotal = total / (1 + ivaRate);
    const iva = total - subtotal;

    // HTML completo para impresión térmica
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>NOTA DE VENTA - ${documentNumber}</title>
        <style>
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
          .ruc-box {
            border: 2px solid #000;
            display: inline-block;
            padding: 2px 8px;
            margin: 5px 0;
            font-weight: bold;
            font-size: 11px;
          }
          .business-info {
            font-size: 11px;
            line-height: 1.5;
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
          .vehicle-box {
            margin-top: 5px;
            font-size: 10px;
            color: #333;
            font-style: italic;
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
          </div>
        </div>

        ${header ? `<div class="custom-header">${header}</div>` : ''}

        <!-- DOCUMENTO -->
        <div class="doc-box">
          <div class="doc-label">DOCUMENTO</div>
          <div class="doc-type">NOTA DE VENTA</div>
          <div class="doc-number">N° ${documentNumber}</div>
        </div>

        <!-- INFO -->
        <div class="info-box">
          <div class="info-row">
            <span><strong>Fecha:</strong></span>
            <span>${format(new Date(order.created_at), 'dd/MM/yyyy HH:mm', { locale: es })}</span>
          </div>
          <div class="info-row">
            <span><strong>Orden #:</strong></span>
            <span>${order.id.slice(0, 8).toUpperCase()}</span>
          </div>
          <div class="customer-box">
            <div class="customer-label">CLIENTE</div>
            <div class="customer-name">${(customer?.name || 'CONSUMIDOR FINAL').toUpperCase()}</div>
            ${customer?.phone ? `<div style="font-size:10px; margin-top:3px;">Tel: ${customer.phone}</div>` : ''}
            ${vehicle ? `
              <div class="vehicle-box">
                Vehículo: ${vehicle.brand} ${vehicle.model} | Placa: ${vehicle.plate}
              </div>
            ` : ''}
          </div>
        </div>

        <!-- PRODUCTOS -->
        <div class="items-title">DETALLE DE SERVICIOS Y REPUESTOS</div>
        ${items.map(item => `
          <div class="item">
            <div class="item-header">
              <span class="item-name">${item.description}</span>
              <span class="item-qty">${item.quantity}</span>
            </div>
            <div class="item-details">
              <span>$${(item.unit_price || 0).toFixed(2)} c/u</span>
              <span class="item-total">$${(item.total_price || 0).toFixed(2)}</span>
            </div>
          </div>
        `).join('')}

        ${items.length === 0 ? '<div style="text-align:center; color:#999; padding:10px;">Sin items registrados</div>' : ''}

        <!-- TOTALES -->
        <div class="totals-box">
          <div class="total-row">
            <span>Subtotal:</span>
            <span>$${subtotal.toFixed(2)}</span>
          </div>
          <div class="total-row">
            <span>IVA (${ivaPercent}%):</span>
            <span>$${iva.toFixed(2)}</span>
          </div>
          <div class="total-final">
            <span>TOTAL:</span>
            <span class="total-amount">$${total.toFixed(2)}</span>
          </div>
        </div>

        <!-- FOOTER -->
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
      }, 500);
    };
  };

  // Cálculos para la vista previa en pantalla
  const total = items.reduce((sum, item) => sum + (item.total_price || 0), 0);
  const ivaRate = ivaPercent / 100;
  const subtotal = total / (1 + ivaRate);
  const iva = total - subtotal;

  return (
    <div className="space-y-4">
      {/* Vista previa en pantalla (simulación del ticket 80mm) */}
      <div className="bg-gray-100 p-4 rounded-lg border-2 border-dashed border-gray-300">
        <div 
          className="bg-white p-4 shadow-lg mx-auto" 
          style={{ 
            width: '100%', 
            maxWidth: '320px', 
            fontFamily: 'Courier New, Courier, monospace', 
            fontSize: '12px',
            lineHeight: '1.4'
          }}
        >
          {/* Header */}
          <div className="text-center border-b-2 border-double border-black pb-2 mb-2">
            <div className="font-bold text-lg uppercase">
              {branchConfig?.business_name || 'TALLER'}
            </div>
            {branchConfig?.ruc && (
              <div className="border-2 border-black inline-block px-2 py-0.5 text-xs font-bold mt-1">
                RUC: {branchConfig.ruc}
              </div>
            )}
            <div className="text-xs mt-1 space-y-0.5">
              {branchConfig?.company_address && <div>{branchConfig.company_address}</div>}
              {branchConfig?.company_phone && <div>Tel: {branchConfig.company_phone}</div>}
            </div>
          </div>

          {/* Custom Header */}
          {branchConfig?.receipt_header && (
            <div className="text-center italic text-xs bg-gray-100 p-1 mb-2 border-l-4 border-black">
              {branchConfig.receipt_header.replace(/\\n/g, ' ')}
            </div>
          )}

          {/* Documento Box */}
          <div className="border-2 border-black p-2 mb-2 text-center bg-gray-50">
            <div className="text-xs uppercase tracking-wider mb-1">DOCUMENTO</div>
            <div className="font-bold text-sm">NOTA DE VENTA</div>
            <div className="font-bold text-red-600 text-sm tracking-wide">
              N° {documentNumber}
            </div>
          </div>

          {/* Info */}
          <div className="space-y-1 text-xs mb-3">
            <div className="flex justify-between border-b border-dotted border-gray-400 py-0.5">
              <span>Fecha:</span>
              <span>{format(new Date(order.created_at), 'dd/MM/yyyy HH:mm', { locale: es })}</span>
            </div>
            <div className="flex justify-between border-b border-dotted border-gray-400 py-0.5">
              <span>Orden:</span>
              <span>{order.id.slice(0, 8).toUpperCase()}</span>
            </div>
          </div>

          {/* Cliente Box */}
          <div className="border border-dashed border-gray-500 p-2 mb-2 bg-white">
            <div className="text-xs uppercase text-gray-500 font-bold mb-1">CLIENTE</div>
            <div className="font-bold uppercase text-sm">
              {(customer?.name || 'CONSUMIDOR FINAL').toUpperCase()}
            </div>
            {customer?.phone && (
              <div className="text-xs mt-0.5">Tel: {customer.phone}</div>
            )}
            {vehicle && (
              <div className="text-xs mt-1 italic text-gray-600">
                {vehicle.brand} {vehicle.model} | {vehicle.plate}
              </div>
            )}
          </div>

          {/* Items */}
          <div className="border-b-2 border-black font-bold text-xs mb-1 mt-3 pb-1">
            DETALLE DE SERVICIOS Y REPUESTOS
          </div>
          
          {items.map((item, idx) => (
            <div key={idx} className="py-1 border-b border-gray-200">
              <div className="flex justify-between items-start mb-0.5">
                <span className="flex-1 pr-2 font-bold">{item.description}</span>
                <span className="bg-black text-white px-1.5 py-0.5 rounded-full text-xs min-w-[20px] text-center">
                  {item.quantity}
                </span>
              </div>
              <div className="flex justify-between text-xs text-gray-600">
                <span>{formatCurrency(item.unit_price || 0)} c/u</span>
                <span className="font-bold text-black">{formatCurrency(item.total_price || 0)}</span>
              </div>
            </div>
          ))}

          {items.length === 0 && (
            <div className="text-center text-gray-400 py-2 text-xs">Sin items registrados</div>
          )}

          {/* Totales */}
          <div className="mt-3 pt-2 border-t-2 border-black space-y-1">
            <div className="flex justify-between text-xs">
              <span>Subtotal:</span>
              <span>{formatCurrency(subtotal)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span>IVA ({ivaPercent}%):</span>
              <span>{formatCurrency(iva)}</span>
            </div>
            <div className="flex justify-between font-bold text-base border-t-2 border-b-2 border-black py-1 mt-1">
              <span>TOTAL:</span>
              <span className="text-red-600">{formatCurrency(total)}</span>
            </div>
          </div>

          {/* Footer */}
          <div className="mt-4 text-center text-xs leading-relaxed border-t border-dashed border-gray-400 pt-2 whitespace-pre-line">
            {branchConfig?.receipt_footer?.replace(/\\n/g, '\n') || '¡Gracias por su preferencia!'}
          </div>

          <div className="text-center text-xs text-gray-500 mt-2 mb-1">
            --- {branchConfig?.business_name || 'TALLER'} ---<br/>
            Documento generado electrónicamente
          </div>

          {/* Cut line */}
          <div className="border-t-2 border-dashed border-gray-400 mt-3 pt-1 text-center">
            <span className="text-gray-400 text-xs">✂</span>
          </div>
        </div>
      </div>

      {/* Botón Imprimir */}
      <div className="flex gap-2">
        <Button
          onClick={handlePrint}
          className="flex-1 bg-blue-600 hover:bg-blue-700 h-12 text-lg font-bold"
          disabled={isPrinting}
        >
          {showSuccess ? (
            <CheckCircle className="mr-2 h-5 w-5" />
          ) : (
            <Printer className="mr-2 h-5 w-5" />
          )}
          {isPrinting ? 'Preparando...' : showSuccess ? '¡Listo!' : 'Imprimir Ticket 80mm'}
        </Button>
      </div>
    </div>
  );
}