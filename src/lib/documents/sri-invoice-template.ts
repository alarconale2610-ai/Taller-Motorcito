// Template HTML puro para factura SRI - reusable para impresión y PDF
import { WorkOrder, Customer, Vehicle, WorkOrderItem, BranchConfig } from '@/types/database';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export interface SRIInvoiceTemplateParams {
  order: WorkOrder;
  customer: Customer | null;
  vehicle: Vehicle | undefined;
  items: WorkOrderItem[];
  branchConfig: BranchConfig | null;
  documentNumber: string;
  ivaPercent: number;
  accessKey?: string;
  subtotal: number;
  iva: number;
  total: number;
}

export function generateSRIInvoiceHTML(params: SRIInvoiceTemplateParams): string {
  const {
    order,
    customer,
    vehicle,
    items,
    branchConfig,
    documentNumber,
    ivaPercent,
    accessKey,
    subtotal,
    iva,
    total
  } = params;

  const companyName = branchConfig?.company_name || branchConfig?.business_name || 'TALLER';
  const businessName = branchConfig?.business_name || '';
  const ruc = branchConfig?.ruc || '';
  const address = branchConfig?.company_address || '';
  const phone = branchConfig?.company_phone || '';
  const email = branchConfig?.company_email || '';

  const [estab, ptoEmi, secuencial] = documentNumber.split('-');
  const fechaEmision = format(new Date(order.created_at), 'dd/MM/yyyy', { locale: es });
  const fechaAutorizacion = accessKey ? format(new Date(), 'dd/MM/yyyy HH:mm:ss') : 'PENDIENTE';
  const claveAcceso = accessKey || generateAccessKey({ ruc, estab, ptoEmi, secuencial, fechaEmision });

  return `
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
}
.header-box {
  border: 2px solid #000;
  padding: 10px;
  margin-bottom: 10px;
}
.header-grid {
  display: flex;
  justify-content: space-between;
}
.header-left { width: 60%; }
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
.info-label { font-weight: bold; }
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
.cliente-full { grid-column: 1 / -1; }
.cliente-label { font-weight: bold; }
.cliente-value { text-transform: uppercase; }
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
.items-table td.description { text-align: left; }
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
.totals-table td:last-child { text-align: right; }
.total-final {
  background: #e0e0e0;
  font-weight: bold;
  font-size: 12px;
}
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
.pago-table th { background: #f0f0f0; }
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
</style>
</head>
<body>
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
        <div class="clave-acceso">${accessKey ? claveAcceso : 'PENDIENTE DE AUTORIZACIÓN'}</div>
        <div><span class="auth-label">Fecha Autorización:</span> ${fechaAutorizacion}</div>
        <div><span class="auth-label">Ambiente:</span> ${process.env.NODE_ENV === 'production' ? 'PRODUCCIÓN' : 'PRUEBAS'}</div>
        <div><span class="auth-label">Emisión:</span> NORMAL</div>
        <div><span class="auth-label">Clave de Acceso:</span></div>
        <div class="clave-acceso">${claveAcceso}</div>
      </div>
    </div>
  </div>
</div>

<div class="cliente-box">
  <div class="cliente-grid">
    <div class="cliente-full">
      <span class="cliente-label">Razón Social:</span>
      <span class="cliente-value">${(customer?.name || 'CONSUMIDOR FINAL').toUpperCase()}</span>
    </div>
    <div>
      <span class="cliente-label">Identificación:</span>
      <span>${customer?.id || customer?.phone || '9999999999'}</span>
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
      <td>$${((item.unit_price) || 0).toFixed(2)}</td>
      <td>0.00</td>
      <td>$${(item.total_price || 0).toFixed(2)}</td>
    </tr>
    `).join('')}
    ${items.length === 0 ? '<tr><td colspan="7">Sin items registrados</td></tr>' : ''}
  </tbody>
</table>

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

<div class="footer-legal">
  <p>Documento autorizado mediante resolución del SRI</p>
  <p>Para consultas ingrese a: www.sri.gob.ec</p>
  ${businessName ? `<p style="margin-top:5px; font-weight:bold;">${businessName}</p>` : ''}
</div>

<div class="cut-line"></div>
</body>
</html>
  `;
}

// Generar clave de acceso SRI (simplificada)
function generateAccessKey(data: any): string {
  const fecha = format(new Date(), 'ddMMyyyy');
  const tipoComprobante = '01';
  const ruc = data.ruc.padStart(13, '0');
  const ambiente = process.env.NODE_ENV === 'production' ? '2' : '1';
  const serie = `${data.estab}${data.ptoEmi}`;
  const numero = data.secuencial.padStart(9, '0');
  const codigoNumerico = Math.floor(Math.random() * 100000000).toString().padStart(8, '0');
  const tipoEmision = '1';

  let clave = fecha + tipoComprobante + ruc + ambiente + serie + numero + codigoNumerico + tipoEmision;

  let suma = 0;
  let factor = 2;
  for (let i = clave.length - 1; i >= 0; i--) {
    suma += parseInt(clave[i]) * factor;
    factor = factor === 7 ? 2 : factor + 1;
  }
  const digito = 11 - (suma % 11);
  const digitoVerificador = digito === 11 ? 0 : digito === 10 ? 1 : digito;

  return clave + digitoVerificador;
}