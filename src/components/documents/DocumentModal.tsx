'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Printer, X } from 'lucide-react';
import { WorkOrder } from '@/types/database';
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
  onPrinted: () => void;
}

export function DocumentModal({ order, type, onClose, onPrinted }: Props) {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [customer, setCustomer] = useState<any>(null);
  const [branchConfig, setBranchConfig] = useState<any>(null);
  const [documentNumber, setDocumentNumber] = useState('');
  const [vehicle, setVehicle] = useState<any>(null);

  useEffect(() => {
    if (!order || !type) return;

    async function loadData() {
      setLoading(true);
      try {
        // Cargar items
        const orderItems = await getWorkOrderItems(order.id);
        setItems(orderItems);

        // Cargar cliente
        const cust = await getCustomerById(order.customer_id);
        setCustomer(cust);
        setVehicle(cust?.vehicles?.find((v: any) => v.id === order.vehicle_id));

        // Cargar config sucursal (incluye iva_percent)
        const config = await getBranchConfig(order.branch_id);
        setBranchConfig(config);

        // Generar número de documento
        const docType = type === 'invoice' ? 'factura' : 'nota_venta';
        const nextNum = await getNextDocumentNumber(order.branch_id, docType);
        setDocumentNumber(nextNum);

        // Guardar en BD que se generó este documento
        await createDocument({
          order_id: order.id,
          branch_id: order.branch_id,
          document_type: docType,
          document_number: nextNum,
          total: order.total,
        });

      } catch (error) {
        console.error(error);
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

  // Obtener el IVA de la config, default 12 si no existe
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
                  branchName={branchConfig?.business_name || 'TALLER'}
                  branchRuc={branchConfig?.ruc || '9999999999001'}
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