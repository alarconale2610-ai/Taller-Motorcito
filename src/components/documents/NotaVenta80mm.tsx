'use client';

import { WorkOrder, Customer, Vehicle, WorkOrderItem } from '@/types/database';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface Props {
  order: WorkOrder;
  customer: Customer;
  vehicle: Vehicle | undefined;
  items: WorkOrderItem[];
  branchName: string;
  branchRuc: string;
  documentNumber: string;
  ivaPercent?: number; // Nuevo: IVA dinámico
}

export function NotaVenta80mm({
  order,
  customer,
  vehicle,
  items,
  branchName,
  branchRuc,
  documentNumber,
  ivaPercent = 12 // Default 12% si no se especifica
}: Props) {
  const total = items.reduce((sum, item) => sum + item.total_price, 0);
  
  // Calcular subtotal e IVA basado en el porcentaje dinámico
  const ivaRate = ivaPercent / 100;
  const subtotal = total / (1 + ivaRate);
  const iva = total - subtotal;

  return (
    <div className="print-area bg-white p-4 w-[80mm] text-xs font-mono leading-tight">
      {/* Header */}
      <div className="text-center mb-4 border-b-2 border-dashed border-black pb-2">
        <h1 className="font-bold text-lg uppercase">{branchName}</h1>
        <p>RUC: {branchRuc}</p>
        <p className="mt-1">NOTA DE VENTA</p>
        <p className="font-bold">No. {documentNumber}</p>
      </div>

      {/* Info */}
      <div className="mb-3 text-[10px]">
        <p><strong>Fecha:</strong> {format(new Date(order.created_at), 'dd/MM/yyyy HH:mm')}</p>
        <p><strong>Cliente:</strong> {customer?.name || 'Consumidor Final'}</p>
        {customer?.phone && <p><strong>Tel:</strong> {customer.phone}</p>}
        {vehicle && (
          <p><strong>Vehículo:</strong> {vehicle.brand} {vehicle.model} ({vehicle.plate})</p>
        )}
      </div>

      {/* Items */}
      <table className="w-full text-[10px] border-t border-b border-black py-2 my-2">
        <thead>
          <tr className="border-b border-black">
            <th className="text-left py-1">Cant</th>
            <th className="text-left">Descripción</th>
            <th className="text-right">Total</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, idx) => (
            <tr key={idx}>
              <td className="py-1">{item.quantity}</td>
              <td className="truncate max-w-[40mm]">{item.description}</td>
              <td className="text-right">${item.total_price.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Totals - IVA Dinámico */}
      <div className="text-right mt-3 space-y-1">
        <p><strong>SUBTOTAL:</strong> ${subtotal.toFixed(2)}</p>
        <p><strong>IVA ({ivaPercent}%):</strong> ${iva.toFixed(2)}</p>
        <p className="text-lg font-bold border-t-2 border-black pt-1">
          TOTAL: ${total.toFixed(2)}
        </p>
      </div>

      {/* Footer */}
      <div className="text-center mt-6 pt-4 border-t border-dashed border-gray-400 text-[9px]">
        <p>Gracias por su preferencia</p>
        <p className="mt-2">Documento sin valor tributario</p>
      </div>
    </div>
  );
}