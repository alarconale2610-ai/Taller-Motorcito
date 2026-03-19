'use client';

import { useState } from 'react';
import { WorkOrder, Customer, Vehicle, WorkOrderItem, BranchConfig } from '@/types/database';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Printer, CheckCircle } from 'lucide-react';
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

export function FacturaSRI({
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

  const handlePrint = () => {
    setIsPrinting(true);

    // Crear iframe para impresión
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

    // Datos de la empresa desde Settings
    const companyName = branchConfig?.company_name || branchConfig?.business_name || 'TALLER';
    const businessName = branchConfig?.business_name || '';
    const ruc = branchConfig?.ruc || '9999999999001';
    const address = branchConfig?.company_address || '';
    const phone = branchConfig?.company_phone || '';
    const email = branchConfig?.company_email || '';
    
    // Parsear número de documento (001-001-000000001)
    const [estab, ptoEmi, secuencial] = documentNumber.split('-');
    
    // Cálculos SRI
    const total = items.reduce((sum, item) => sum + (item.total_price || 0), 0);
    const ivaRate = ivaPercent / 100;
    const subtotal = total / (1 + ivaRate);
    const iva = total - subtotal;

    // Fechas
    const fechaEmision = format(new Date(order.created_at), 'dd/MM/yyyy', { locale: es });
    const fechaAutorizacion = format(new Date(), 'dd/MM/yyyy HH:mm:ss');

    // HTML para factura SRI
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>FACTURA - ${documentNumber}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: 'Courier New', Courier, monospace;
            font-size: 11px;
            line-height: 1.3;
            width: 210mm;
            min-height: 297mm;
            padding: 10mm;
            color: #000;
            background: #fff;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          
          /* ENCABEZADO SRI */
          .header-box {
            border: 2px solid #000;
            padding: 10px;
            margin-bottom: 10px;
          }
          .header-grid {
            display: flex;
            justify-content: space-between;
          }
          .header-left {
            width: 60%;
          }
          .header-right {
            width: 38%;
            border-left: 2px solid #000;
            padding-left: 10px;
          }
          
          .company-name {
            font-size: 16px;
            font-weight: bold;
            text-transform: uppercase;
            margin-bottom: 8px;
            border-bottom: 1px solid #000;
            padding-bottom: 5px;
          }
          .company-info {
            font-size: 10px;
            line-height: 1.4;
          }
          .info-label {
            font-weight: bold;
          }
          
          /* CAJA FACTURA */
          .factura-box {
            border: 2px solid #000;
            padding: 8px;
            text-align: center;
            margin-bottom: 8px;
            background: #f5f5f5;
          }
          .factura-label {
            font-size: 10px;
            font-weight: bold;
            text-transform: uppercase;
          }
          .factura-number {
            font-size: 14px;
            font-weight: bold;
            color: #c00;
            letter-spacing: 2px;
          }
          
          /* AUTORIZACIÓN */
          .auth-box {
            font-size: 9px;
            line-height: 1.3;
          }
          .auth-label {
            font-weight: bold;
            display: block;
            margin-top: 4px;
          }
          .clave-acceso {
            font-family: monospace;
            font-size: 8px;
            background: #f0f0f0;
            padding: 3px;
            word-break: break-all;
            border: 1px solid #ccc;
            margin-top: 3px;
          }
          
          /* CLIENTE BOX */
          .cliente-box {
            border: 1px solid #000;
            padding: 8px;
            margin: 10px 0;
          }
          .cliente-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 5px;
            font-size: 10px;
          }
          .cliente-full {
            grid-column: 1 / -1;
          }
          .cliente-label {
            font-weight: bold;
          }
          .cliente-value {
            text-transform: uppercase;
          }
          
          /* TABLA ITEMS */
          .items-table {
            width: 100%;
            border-collapse: collapse;
            margin: 10px 0;
            font-size: 9px;
          }
          .items-table th {
            border: 1px solid #000;
            padding: 4px;
            background: #e0e0e0;
            font-weight: bold;
            text-align: center;
          }
          .items-table td {
            border: 1px solid #000;
            padding: 3px;
            text-align: center;
          }
          .items-table td.description {
            text-align: left;
          }
          
          /* TOTALES SRI */
          .totals-container {
            display: flex;
            justify-content: flex-end;
            margin: 10px 0;
          }
          .totals-table {
            width: 50%;
            border-collapse: collapse;
            font-size: 10px;
          }
          .totals-table td {
            border: 1px solid #000;
            padding: 4px 8px;
          }
          .totals-table td:first-child {
            font-weight: bold;
            text-align: left;
          }
          .totals-table td:last-child {
            text-align: right;
          }
          .total-final {
            background: #e0e0e0;
            font-weight: bold;
            font-size: 12px;
          }
          
          /* FORMA DE PAGO */
          .pago-box {
            border: 1px solid #000;
            margin: 10px 0;
            padding: 8px;
          }
          .pago-title {
            font-weight: bold;
            font-size: 10px;
            margin-bottom: 5px;
            text-transform: uppercase;
          }
          .pago-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 9px;
          }
          .pago-table th, .pago-table td {
            border: 1px solid #000;
            padding: 4px;
            text-align: center;
          }
          .pago-table th {
            background: #f0f0f0;
          }
          
          /* FOOTER LEGAL */
          .footer-legal {
            margin-top: 20px;
            text-align: center;
            font-size: 9px;
            border-top: 2px solid #000;
            padding-top: 10px;
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
            body { width: 210mm; padding: 5mm; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <!-- ENCABEZADO SRI -->
        <div class="header-box">
          <div class="header-grid">
            <div class="header-left">
              <div class="company-name">${companyName}</div>
              <div class="company-info">
                <div><span class="info-label">Dirección Matriz:</span> ${address}</div>
                <div><span class="info-label">Dirección Sucursal:</span> ${address}</div>
                <div><span class="info-label">Contribuyente Especial:</span> Nro. 0023</div>
                <div><span class="info-label">Obligado a llevar Contabilidad:</span> SI</div>
              </div>
            </div>
            
            <div class="header-right">
              <div class="factura-box">
                <div class="factura-label">FACTURA</div>
                <div class="factura-number">${documentNumber}</div>
              </div>
              
              <div class="auth-box">
                <div><span class="auth-label">RUC:</span> ${ruc}</div>
                <div><span class="auth-label">Nro Autorización:</span></div>
                <div style="font-size:8px; word-break:break-all;">${documentNumber}${fechaEmision.replace(/\//g, '')}1${ruc}2${estab}${ptoEmi}${secuencial}123456781</div>
                <div><span class="auth-label">Fecha Autorización:</span> ${fechaAutorizacion}</div>
                <div><span class="auth-label">Ambiente:</span> PRODUCCIÓN</div>
                <div><span class="auth-label">Emisión:</span> NORMAL</div>
                <div><span class="auth-label">Clave de Acceso:</span></div>
                <div class="clave-acceso">${documentNumber}${fechaEmision.replace(/\//g, '')}1${ruc}2${estab}${ptoEmi}${secuencial}123456781</div>
              </div>
            </div>
          </div>
        </div>

        <!-- DATOS CLIENTE -->
        <div class="cliente-box">
          <div class="cliente-grid">
            <div class="cliente-full">
              <span class="cliente-label">Razón Social:</span>
              <span class="cliente-value">${(customer?.name || 'CONSUMIDOR FINAL').toUpperCase()}</span>
            </div>
            <div>
              <span class="cliente-label">Identificación:</span>
              <span>${customer?.phone || '9999999999'}</span>
            </div>
            <div>
              <span class="cliente-label">Fecha Emisión:</span>
              <span>${fechaEmision}</span>
            </div>
            ${vehicle ? `
              <div class="cliente-full">
                <span class="cliente-label">Vehículo:</span>
                <span>${vehicle.brand} ${vehicle.model} - Placa: ${vehicle.plate}</span>
              </div>
            ` : ''}
          </div>
        </div>

        <!-- TABLA ITEMS -->
        <table class="items-table">
          <thead>
            <tr>
              <th style="width:8%">Cod.</th>
              <th style="width:8%">Cant</th>
              <th style="width:40%">Descripción</th>
              <th style="width:15%">Detalle</th>
              <th style="width:12%">P. Unit</th>
              <th style="width:8%">Desc</th>
              <th style="width:12%">Total</th>
            </tr>
          </thead>
          <tbody>
            ${items.map((item, idx) => `
              <tr>
                <td>${idx + 1}</td>
                <td>${item.quantity}</td>
                <td class="description">${item.description}</td>
                <td>${item.is_product ? 'PRODUCTO' : 'SERVICIO'}</td>
                <td>$${(item.unit_price || 0).toFixed(2)}</td>
                <td>0.00</td>
                <td>$${(item.total_price || 0).toFixed(2)}</td>
              </tr>
            `).join('')}
            ${items.length === 0 ? '<tr><td colspan="7">Sin items registrados</td></tr>' : ''}
          </tbody>
        </table>

        <!-- TOTALES SRI -->
        <div class="totals-container">
          <table class="totals-table">
            <tbody>
              <tr>
                <td>SUBTOTAL ${ivaPercent}%</td>
                <td>$${subtotal.toFixed(2)}</td>
              </tr>
              <tr>
                <td>SUBTOTAL 0%</td>
                <td>0.00</td>
              </tr>
              <tr>
                <td>SUBTOTAL No Objeto IVA</td>
                <td>0.00</td>
              </tr>
              <tr>
                <td>SUBTOTAL Exento IVA</td>
                <td>0.00</td>
              </tr>
              <tr>
                <td>SUBTOTAL SIN IMPUESTOS</td>
                <td>$${subtotal.toFixed(2)}</td>
              </tr>
              <tr>
                <td>DESCUENTO</td>
                <td>0.00</td>
              </tr>
              <tr>
                <td>IVA ${ivaPercent}%</td>
                <td>$${iva.toFixed(2)}</td>
              </tr>
              <tr>
                <td>PROPINA</td>
                <td>0.00</td>
              </tr>
              <tr class="total-final">
                <td>VALOR TOTAL</td>
                <td>$${total.toFixed(2)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- FORMA DE PAGO -->
        <div class="pago-box">
          <div class="pago-title">Forma de Pago</div>
          <table class="pago-table">
            <thead>
              <tr>
                <th>Forma de Pago</th>
                <th>Valor</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>SIN UTILIZACIÓN DEL SISTEMA FINANCIERO</td>
                <td>$${total.toFixed(2)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- FOOTER LEGAL -->
        <div class="footer-legal">
          <p>Documento autorizado mediante resolución del SRI</p>
          <p>Para consultas ingrese a: www.sri.gob.ec</p>
          ${businessName ? `<p style="margin-top:5px; font-weight:bold;">${businessName}</p>` : ''}
        </div>

        <div class="cut-line"></div>
      </body>
      </html>
    `;

    doc.open();
    doc.write(htmlContent);
    doc.close();

    // Imprimir
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

  // Cálculos para vista previa
  const total = items.reduce((sum, item) => sum + (item.total_price || 0), 0);
  const ivaRate = ivaPercent / 100;
  const subtotal = total / (1 + ivaRate);
  const iva = total - subtotal;
  
  const [estab, ptoEmi, secuencial] = documentNumber.split('-');

  return (
    <div className="space-y-4">
      {/* Vista previa en pantalla - Diseño SRI */}
      <div className="bg-gray-100 p-4 rounded-lg border-2 border-dashed border-gray-300 overflow-auto">
        <div 
          className="bg-white p-6 shadow-lg mx-auto" 
          style={{ 
            width: '100%',
            maxWidth: '800px',
            fontFamily: 'Courier New, Courier, monospace', 
            fontSize: '11px',
            lineHeight: '1.3'
          }}
        >
          {/* Encabezado */}
          <div className="border-2 border-black p-3 mb-2">
            <div className="flex justify-between">
              <div className="w-3/5 pr-2">
                <div className="text-base font-bold uppercase border-b border-black pb-1 mb-2">
                  {branchConfig?.company_name || branchConfig?.business_name || 'TALLER'}
                </div>
                <div className="text-xs space-y-0.5">
                  <div><strong>Dirección Matriz:</strong> {branchConfig?.company_address || ''}</div>
                  <div><strong>Dirección Sucursal:</strong> {branchConfig?.company_address || ''}</div>
                  <div><strong>Contribuyente Especial:</strong> Nro. 0023</div>
                  <div><strong>Obligado a llevar Contabilidad:</strong> SI</div>
                </div>
              </div>
              
              <div className="w-2/5 border-l-2 border-black pl-3">
                <div className="border-2 border-black p-2 text-center bg-gray-100 mb-2">
                  <div className="text-xs font-bold uppercase">FACTURA</div>
                  <div className="text-sm font-bold text-red-600 tracking-wider">{documentNumber}</div>
                </div>
                
                <div className="text-xs space-y-0.5">
                  <div><strong>RUC:</strong> {branchConfig?.ruc || '9999999999001'}</div>
                  <div><strong>Nro Autorización:</strong></div>
                  <div className="text-[8px] break-all bg-gray-100 p-1 border border-gray-300">
                    {documentNumber}{format(new Date(order.created_at), 'ddMMyyyy')}1{branchConfig?.ruc || ''}2{estab || '001'}{ptoEmi || '001'}{secuencial || '000000001'}123456781
                  </div>
                  <div><strong>Fecha Autorización:</strong> {format(new Date(), 'dd/MM/yyyy HH:mm')}</div>
                  <div><strong>Ambiente:</strong> PRODUCCIÓN</div>
                  <div><strong>Emisión:</strong> NORMAL</div>
                </div>
              </div>
            </div>
          </div>

          {/* Cliente */}
          <div className="border border-black p-2 mb-2">
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="col-span-2">
                <strong>Razón Social:</strong> {(customer?.name || 'CONSUMIDOR FINAL').toUpperCase()}
              </div>
              <div><strong>Identificación:</strong> {customer?.phone || '9999999999'}</div>
              <div><strong>Fecha Emisión:</strong> {format(new Date(order.created_at), 'dd/MM/yyyy')}</div>
              {vehicle && (
                <div className="col-span-2">
                  <strong>Vehículo:</strong> {vehicle.brand} {vehicle.model} - Placa: {vehicle.plate}
                </div>
              )}
            </div>
          </div>

          {/* Tabla Items */}
          <table className="w-full border-collapse text-xs mb-2">
            <thead>
              <tr className="bg-gray-200">
                <th className="border border-black p-1 w-8">Cod</th>
                <th className="border border-black p-1 w-8">Cant</th>
                <th className="border border-black p-1 text-left w-1/3">Descripción</th>
                <th className="border border-black p-1 w-20">Detalle</th>
                <th className="border border-black p-1 w-20">P. Unit</th>
                <th className="border border-black p-1 w-12">Desc</th>
                <th className="border border-black p-1 w-20">Total</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => (
                <tr key={idx}>
                  <td className="border border-black p-1 text-center">{idx + 1}</td>
                  <td className="border border-black p-1 text-center">{item.quantity}</td>
                  <td className="border border-black p-1">{item.description}</td>
                  <td className="border border-black p-1 text-center text-[10px]">
                    {item.is_product ? 'PRODUCTO' : 'SERVICIO'}
                  </td>
                  <td className="border border-black p-1 text-right">{formatCurrency(item.unit_price || 0)}</td>
                  <td className="border border-black p-1 text-right">0.00</td>
                  <td className="border border-black p-1 text-right">{formatCurrency(item.total_price || 0)}</td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td colSpan={7} className="border border-black p-2 text-center text-gray-500">
                    Sin items registrados
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {/* Totales */}
          <div className="flex justify-end mb-2">
            <table className="w-1/2 border-collapse text-xs">
              <tbody>
                <tr>
                  <td className="border border-black p-1 font-bold">SUBTOTAL {ivaPercent}%</td>
                  <td className="border border-black p-1 text-right">{formatCurrency(subtotal)}</td>
                </tr>
                <tr>
                  <td className="border border-black p-1 font-bold">SUBTOTAL 0%</td>
                  <td className="border border-black p-1 text-right">0.00</td>
                </tr>
                <tr>
                  <td className="border border-black p-1 font-bold">SUBTOTAL No Objeto IVA</td>
                  <td className="border border-black p-1 text-right">0.00</td>
                </tr>
                <tr>
                  <td className="border border-black p-1 font-bold">SUBTOTAL Exento IVA</td>
                  <td className="border border-black p-1 text-right">0.00</td>
                </tr>
                <tr>
                  <td className="border border-black p-1 font-bold">SUBTOTAL SIN IMPUESTOS</td>
                  <td className="border border-black p-1 text-right">{formatCurrency(subtotal)}</td>
                </tr>
                <tr>
                  <td className="border border-black p-1 font-bold">DESCUENTO</td>
                  <td className="border border-black p-1 text-right">0.00</td>
                </tr>
                <tr>
                  <td className="border border-black p-1 font-bold">IVA {ivaPercent}%</td>
                  <td className="border border-black p-1 text-right">{formatCurrency(iva)}</td>
                </tr>
                <tr>
                  <td className="border border-black p-1 font-bold">PROPINA</td>
                  <td className="border border-black p-1 text-right">0.00</td>
                </tr>
                <tr className="bg-gray-200 font-bold">
                  <td className="border border-black p-1">VALOR TOTAL</td>
                  <td className="border border-black p-1 text-right text-sm">{formatCurrency(total)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Forma de Pago */}
          <div className="border border-black p-2 mb-2">
            <div className="font-bold text-xs uppercase mb-1">Forma de Pago</div>
            <table className="w-full border-collapse text-xs">
              <thead className="bg-gray-100">
                <tr>
                  <th className="border border-black p-1">Forma de Pago</th>
                  <th className="border border-black p-1">Valor</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border border-black p-1 text-center">SIN UTILIZACIÓN DEL SISTEMA FINANCIERO</td>
                  <td className="border border-black p-1 text-right">{formatCurrency(total)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Footer */}
          <div className="text-center text-xs mt-4 pt-2 border-t-2 border-black">
            <p>Documento autorizado mediante resolución del SRI</p>
            <p>Para consultas ingrese a: www.sri.gob.ec</p>
            {branchConfig?.business_name && (
              <p className="mt-1 font-bold">{branchConfig.business_name}</p>
            )}
          </div>

          <div className="border-t-2 border-dashed border-gray-400 mt-4 pt-1 text-center">
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
          {isPrinting ? 'Preparando...' : showSuccess ? '¡Listo!' : 'Imprimir Factura SRI'}
        </Button>
      </div>
    </div>
  );
}