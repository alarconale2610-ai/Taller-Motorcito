'use client';

import { WorkOrder, Customer, Vehicle, WorkOrderItem } from '@/types/database';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface Props {
  order: WorkOrder;
  customer: Customer;
  vehicle: Vehicle | undefined;
  items: WorkOrderItem[];
  branchConfig: {
    business_name: string;
    ruc: string;
    company_name: string;
    company_address: string;
    company_phone: string;
    establishment_code: string;
    emission_point: string;
  };
  documentNumber: string;
  authorizationNumber?: string;
  ivaPercent?: number; // Nuevo: IVA dinámico
}

export function FacturaSRI({
  order,
  customer,
  vehicle,
  items,
  branchConfig,
  documentNumber,
  authorizationNumber = '1234567890',
  ivaPercent = 12 // Default 12% si no se especifica
}: Props) {
  // Calcular usando el IVA dinámico
  const ivaRate = ivaPercent / 100;
  const total = items.reduce((sum, item) => sum + item.total_price, 0);
  const subtotal = total / (1 + ivaRate);
  const iva = subtotal * ivaRate;

  const [estab, ptoEmi, secuencial] = documentNumber.split('-');

  return (
    <div className="print-area-factura bg-white p-8 w-[210mm] min-h-[297mm] text-sm font-sans border border-gray-300">
      {/* Encabezado SRI */}
      <div className="border-2 border-black p-4 mb-4">
        <div className="flex justify-between items-start">
          <div className="w-1/2">
            <h1 className="text-2xl font-bold uppercase mb-2">{branchConfig.company_name}</h1>
            <p><strong>Dirección Matriz:</strong> {branchConfig.company_address}</p>
            <p><strong>Dirección Sucursal:</strong> {branchConfig.company_address}</p>
            <p><strong>Contribuyente Especial:</strong> Nro. 0023</p>
            <p><strong>Obligado a llevar Contabilidad:</strong> SI</p>
          </div>

          <div className="w-1/2 border-l-2 border-black pl-4">
            <div className="border-2 border-black p-2 text-center mb-2">
              <h2 className="text-xl font-bold">FACTURA</h2>
              <p className="text-lg">{documentNumber}</p>
            </div>
            <div className="text-xs space-y-1">
              <p><strong>RUC:</strong> {branchConfig.ruc}</p>
              <p><strong>Nro Autorización:</strong></p>
              <p className="break-all text-[10px]">{authorizationNumber}</p>
              <p><strong>Fecha y Hora Autorización:</strong></p>
              <p>{format(new Date(), 'dd/MM/yyyy HH:mm:ss')}</p>
              <p><strong>Ambiente:</strong> PRODUCCIÓN</p>
              <p><strong>Emisión:</strong> NORMAL</p>
              <p><strong>Clave de Acceso:</strong></p>
              <p className="break-all text-[9px] font-mono bg-gray-100 p-1">
                {authorizationNumber}{format(new Date(order.created_at), 'ddMMyyyy')}1{branchConfig.ruc}2{estab}{ptoEmi}{secuencial}123456781
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Datos Cliente */}
      <div className="border border-black p-3 mb-4">
        <table className="w-full text-sm">
          <tbody>
            <tr>
              <td className="w-32 font-bold">Razón Social:</td>
              <td>{customer?.name || 'CONSUMIDOR FINAL'}</td>
              <td className="w-32 font-bold">Identificación:</td>
              <td>{customer?.phone || '9999999999'}</td>
            </tr>
            <tr>
              <td className="font-bold">Fecha Emisión:</td>
              <td>{format(new Date(order.created_at), 'dd/MM/yyyy')}</td>
              <td className="font-bold">Guía de Remisión:</td>
              <td>---</td>
            </tr>
            {vehicle && (
              <tr>
                <td className="font-bold">Vehículo:</td>
                <td colSpan={3}>{vehicle.brand} {vehicle.model} - Placa: {vehicle.plate}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Detalle de Items */}
      <table className="w-full border border-black text-sm mb-4">
        <thead className="bg-gray-100">
          <tr>
            <th className="border border-black p-2 w-16">Cod. Principal</th>
            <th className="border border-black p-2 w-16">Cant</th>
            <th className="border border-black p-2">Descripción</th>
            <th className="border border-black p-2 w-24">Detalle Adicional</th>
            <th className="border border-black p-2 w-24">Precio Unitario</th>
            <th className="border border-black p-2 w-20">Descuento</th>
            <th className="border border-black p-2 w-24">Precio Total</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, idx) => (
            <tr key={idx}>
              <td className="border border-black p-2 text-center">{idx + 1}</td>
              <td className="border border-black p-2 text-center">{item.quantity}</td>
              <td className="border border-black p-2">{item.description}</td>
              <td className="border border-black p-2"></td>
              <td className="border border-black p-2 text-right">${(item.unit_price).toFixed(2)}</td>
              <td className="border border-black p-2 text-right">0.00</td>
              <td className="border border-black p-2 text-right">${item.total_price.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Totales SRI - IVA Dinámico */}
      <div className="flex justify-end mb-4">
        <table className="w-1/2 border border-black text-sm">
          <tbody>
            <tr>
              <td className="border border-black p-2 font-bold">SUBTOTAL {ivaPercent}%</td>
              <td className="border border-black p-2 text-right">${subtotal.toFixed(2)}</td>
            </tr>
            <tr>
              <td className="border border-black p-2 font-bold">SUBTOTAL 0%</td>
              <td className="border border-black p-2 text-right">0.00</td>
            </tr>
            <tr>
              <td className="border border-black p-2 font-bold">SUBTOTAL No Objeto IVA</td>
              <td className="border border-black p-2 text-right">0.00</td>
            </tr>
            <tr>
              <td className="border border-black p-2 font-bold">SUBTOTAL Exento IVA</td>
              <td className="border border-black p-2 text-right">0.00</td>
            </tr>
            <tr>
              <td className="border border-black p-2 font-bold">SUBTOTAL SIN IMPUESTOS</td>
              <td className="border border-black p-2 text-right">${subtotal.toFixed(2)}</td>
            </tr>
            <tr>
              <td className="border border-black p-2 font-bold">DESCUENTO</td>
              <td className="border border-black p-2 text-right">0.00</td>
            </tr>
            <tr>
              <td className="border border-black p-2 font-bold">IVA {ivaPercent}%</td>
              <td className="border border-black p-2 text-right">${iva.toFixed(2)}</td>
            </tr>
            <tr>
              <td className="border border-black p-2 font-bold">PROPINA</td>
              <td className="border border-black p-2 text-right">0.00</td>
            </tr>
            <tr className="bg-gray-100 font-bold text-lg">
              <td className="border border-black p-2">VALOR TOTAL</td>
              <td className="border border-black p-2 text-right">${total.toFixed(2)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Forma de Pago */}
      <div className="border border-black p-3 mb-4">
        <h3 className="font-bold mb-2">Forma de Pago</h3>
        <table className="w-full text-sm">
          <thead className="bg-gray-100">
            <tr>
              <th className="border border-black p-2">Forma de Pago</th>
              <th className="border border-black p-2">Valor</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border border-black p-2">SIN UTILIZACIÓN DEL SISTEMA FINANCIERO</td>
              <td className="border border-black p-2 text-right">${total.toFixed(2)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="text-xs text-center mt-8 pt-4 border-t-2 border-black">
        <p>Documento autorizado mediante resolución del SRI</p>
        <p className="mt-2">Para consultas ingrese a: www.sri.gob.ec</p>
      </div>
    </div>
  );
}