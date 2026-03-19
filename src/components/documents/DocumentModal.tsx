'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Printer, X } from 'lucide-react';
import { WorkOrder, WorkOrderItem, Customer, Vehicle, BranchConfig } from '@/types/database';
import { getWorkOrderItems } from '@/lib/actions/workOrders';
import { getCustomerById } from '@/lib/actions/customers';
import { getBranchConfig } from '@/lib/actions/branches';
import { getNextDocumentNumber, createDocument } from '@/lib/actions/documents';
import { NotaVenta80mm } from './NotaVenta80mm';
import { FacturaSRI } from './FacturaSRI';
import { PrintStyles } from './PrintStyles';

interface Props {
  order: WorkOrder | null;
  type: 'invoice' | 'note' | null;
  onClose: () => void;
  onPrinted: () => void}

export function DocumentModal({ order, type, onClose, onPrinted }: Props) {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<WorkOrderItem[]>([]);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [branchConfig, setBranchConfig] = useState<BranchConfig | null>(null);
  const [documentNumber, setDocumentNumber] = useState('');
  const [vehicle, setVehicle] = useState<Vehicle | undefined>(undefined);

  useEffect(() => {
    // Verificación temprana - si no hay datos, no hacer nada
    if (!order || !type) {
      setLoading(false);
      return;
    }

    // Guardar referencias locales para TypeScript
    const currentOrder = order;
    const currentType = type;

    async function loadData() {
      setLoading(true);
      try {
        // Usar las referencias locales que TypeScript sabe que no son null
        const orderId = currentOrder.id;
        const branchId = currentOrder.branch_id;
        const customerId = currentOrder.customer_id;
        const vehicleId = currentOrder.vehicle_id;
        const orderTotal = currentOrder.total;
        
        // Cargar items
        const orderItems = await getWorkOrderItems(orderId);
        setItems(orderItems);

        // Cargar cliente
        const cust = await getCustomerById(customerId);
        setCustomer(cust);
        
        // Buscar vehículo
        if (cust?.vehicles && vehicleId) {
          const foundVehicle = cust.vehicles.find((v: Vehicle) => v.id === vehicleId);
          setVehicle(foundVehicle);
        } else {
          setVehicle(undefined);
        }

        // Cargar config sucursal
        const config = await getBranchConfig(branchId);
        setBranchConfig(config);

        // Generar número de documento
        const docType = currentType === 'invoice' ? 'factura' : 'nota_venta';
        const nextNum = await getNextDocumentNumber(branchId, docType);
        setDocumentNumber(nextNum);

        // Guardar en BD
        await createDocument({
          order_id: orderId,
          branch_id: branchId,
          document_type: docType,
          document_number: nextNum,
          total: orderTotal,
        });

      } catch (error) {
        console.error('Error cargando datos:', error);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [order, type]);

  const handlePrint = () => {
    window.print();
    onPrinted();
  };

  if (!order || !type) return null;

  const isInvoice = type === 'invoice';
  const ivaPercent = branchConfig?.iva_percent ?? 12;

  return (
    <>
      <PrintStyles />
      <Dialog open={!!order} onOpenChange={onClose}>
        <DialogContent className={`${isInvoice ? 'max-w-4xl' : 'max-w-sm'} h-[90vh] overflow-y-auto`}>
          <DialogHeader className="flex flex-row items-center justify-between no-print">
            <DialogTitle>
              {isInvoice ? 'Factura Electrónica' : 'Nota de Venta'} - Previsualización
            </DialogTitle>
            <div className="flex gap-2">
              <Button onClick={handlePrint} className="gap-2">
                <Printer className="h-4 w-4" />
                Imprimir
              </Button>
              <Button variant="outline" onClick={onClose}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </DialogHeader>

          {loading ? (
            <div className="flex justify-center py-8">Cargando...</div>
          ) : (
            <div className="bg-white">
              {isInvoice ? (
                <FacturaSRI
                  order={order}
                  customer={customer}
                  vehicle={vehicle}
                  items={items}
                  branchConfig={branchConfig}
                  documentNumber={documentNumber}
                  ivaPercent={ivaPercent}
                />
              ) : (
                <NotaVenta80mm
                  order={order}
                  customer={customer}
                  vehicle={vehicle}
                  items={items}
                  branchConfig={branchConfig}
                  documentNumber={documentNumber}
                  ivaPercent={ivaPercent}
                />
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}