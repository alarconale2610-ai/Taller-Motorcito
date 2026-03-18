'use client';

import { useState, useMemo, useEffect } from 'react';
import { 
  Search, DollarSign, CheckCircle, User, Loader2, 
  Banknote, ArrowRightLeft, Package, Clock, Receipt, Filter, X
} from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useBranchStore } from '@/store/useBranchStore';
import { useAuthStore } from '@/store/useAuthStore';
import { Worker, Product, WorkerConsumption } from '@/types/database';
import { getWorkers } from '@/lib/actions/workers';
import { getProducts } from '@/lib/actions/products';
import {
  getConsumptions,
  createConsumption,
  payConsumption,
  payAllConsumptionsByWorker
} from '@/lib/actions/consumptions';
import { formatCurrency, getProductTypeColor, getProductTypeLabel } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';

const consumptionSchema = z.object({
  worker_id: z.string().min(1, 'Trabajador requerido'),
  quantity: z.number().min(1, 'Cantidad minima 1'),
  notes: z.string().optional(),
});

type ConsumptionForm = z.infer<typeof consumptionSchema>;

export default function InternalConsumptionPage() {
  const { selectedBranch } = useBranchStore();
  const { user } = useAuthStore();
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [consumptions, setConsumptions] = useState<WorkerConsumption[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modales
  const [consumptionDialogOpen, setConsumptionDialogOpen] = useState(false);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedConsumption, setSelectedConsumption] = useState<WorkerConsumption | null>(null);
  
  // Filtros del historial
  const [productSearchQuery, setProductSearchQuery] = useState('');
  const [selectedProductType, setSelectedProductType] = useState<'all' | 'A' | 'B' | 'C' | 'D'>('D');
  const [historyWorkerFilter, setHistoryWorkerFilter] = useState<string>('all');
  const [historyStatusFilter, setHistoryStatusFilter] = useState<'all' | 'pending' | 'paid'>('all');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [showFilters, setShowFilters] = useState(false);
  
  // Formulario
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ConsumptionForm>({
    resolver: zodResolver(consumptionSchema),
    defaultValues: { quantity: 1 },
  });

  // Pago
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'transfer'>('cash');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [partialAmount, setPartialAmount] = useState<string>('');

  useEffect(() => {
    async function loadData() {
      if (!selectedBranch) {
        setWorkers([]);
        setProducts([]);
        setConsumptions([]);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const [workersData, productsData, consumptionsData] = await Promise.all([
          getWorkers(selectedBranch.id),
          getProducts(selectedBranch.id),
          getConsumptions(selectedBranch.id),
        ]);
        
        setWorkers(workersData);
        setProducts(productsData);
        setConsumptions(consumptionsData);
      } catch (error) {
        toast({
          title: 'Error',
          description: error instanceof Error ? error.message : 'Error al cargar datos',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [selectedBranch]);

  const activeWorkers = useMemo(() => workers.filter((w) => w.is_active), [workers]);

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchesSearch = 
        p.name.toLowerCase().includes(productSearchQuery.toLowerCase()) ||
        p.barcode?.includes(productSearchQuery);
      const matchesType = selectedProductType === 'all' || p.type === selectedProductType;
      const hasStock = p.stock > 0;
      return matchesSearch && matchesType && hasStock;
    });
  }, [products, productSearchQuery, selectedProductType]);

  // Calcular deudas por trabajador (solo pendientes para mostrar en tarjetas)
  const workerPendingDebts = useMemo(() => {
    const grouped = new Map<string, {
      worker: Worker;
      pendingConsumptions: WorkerConsumption[];
      totalPending: number;
    }>();

    consumptions
      .filter(c => c.status === 'pending')
      .forEach((consumption) => {
        const worker = workers.find((w) => w.id === consumption.worker_id);
        if (!worker) return;
        
        if (!grouped.has(worker.id)) {
          grouped.set(worker.id, {
            worker,
            pendingConsumptions: [],
            totalPending: 0,
          });
        }
        
        const data = grouped.get(worker.id)!;
        data.pendingConsumptions.push(consumption);
        data.totalPending += consumption.total;
      });

    return Array.from(grouped.values())
      .sort((a, b) => b.totalPending - a.totalPending);
  }, [consumptions, workers]);

  // Filtrar historial
  const filteredHistory = useMemo(() => {
    return consumptions.filter((consumption) => {
      // Filtro por trabajador
      if (historyWorkerFilter !== 'all' && consumption.worker_id !== historyWorkerFilter) {
        return false;
      }
      
      // Filtro por estado
      if (historyStatusFilter !== 'all' && consumption.status !== historyStatusFilter) {
        return false;
      }
      
      // Filtro por fecha desde
      if (dateFrom) {
        const consumptionDate = new Date(consumption.consumed_at);
        const fromDate = new Date(dateFrom);
        if (consumptionDate < fromDate) return false;
      }
      
      // Filtro por fecha hasta
      if (dateTo) {
        const consumptionDate = new Date(consumption.consumed_at);
        const toDate = new Date(dateTo);
        toDate.setHours(23, 59, 59);
        if (consumptionDate > toDate) return false;
      }
      
      return true;
    });
  }, [consumptions, historyWorkerFilter, historyStatusFilter, dateFrom, dateTo]);

  const totalPendingDebt = useMemo(() => 
    workerPendingDebts.reduce((sum, d) => sum + d.totalPending, 0),
    [workerPendingDebts]
  );

  const handleProductSelect = (product: Product) => {
    setSelectedProduct(product);
    setValue('quantity', 1);
    setConsumptionDialogOpen(true);
  };

  const onSubmitConsumption = async (data: ConsumptionForm) => {
    if (!selectedProduct) return;

    if (data.quantity > selectedProduct.stock) {
      toast({ 
        title: 'Stock insuficiente', 
        description: `Solo hay ${selectedProduct.stock} unidades disponibles.`,
        variant: 'destructive' 
      });
      return;
    }

    try {
      const newConsumption = await createConsumption({
        worker_id: data.worker_id,
        product_id: selectedProduct.id,
        quantity: data.quantity,
        unit_price: selectedProduct.sale_price,
        total: selectedProduct.sale_price * data.quantity,
        status: 'pending',
        notes: data.notes,
      }, user?.id);

      setConsumptions((prev) => [newConsumption, ...prev]);
      
      setProducts((prev) =>
        prev.map((p) =>
          p.id === selectedProduct.id ? { ...p, stock: p.stock - data.quantity } : p
        )
      );

      toast({ title: '✅ Consumo registrado correctamente' });
      setConsumptionDialogOpen(false);
      setSelectedProduct(null);
      reset();
      
    } catch (error) {
      toast({
        title: '❌ Error',
        description: error instanceof Error ? error.message : 'Error desconocido',
        variant: 'destructive',
      });
    }
  };

  const openConsumptionDetail = (consumption: WorkerConsumption) => {
    setSelectedConsumption(consumption);
    setPaymentMethod('cash');
    setReferenceNumber('');
    setPartialAmount(consumption.total.toString());
    setDetailDialogOpen(true);
  };

  const handlePay = async () => {
    if (!selectedConsumption) return;

    try {
      const amount = parseFloat(partialAmount);
      
      await payConsumption(
        selectedConsumption.id,
        paymentMethod,
        referenceNumber,
        amount < selectedConsumption.total ? amount : undefined
      );
      
      // Recargar datos
      if (selectedBranch) {
        const updatedConsumptions = await getConsumptions(selectedBranch.id);
        setConsumptions(updatedConsumptions);
      }
      
      toast({ title: '✅ Pago registrado correctamente' });
      setDetailDialogOpen(false);
      setSelectedConsumption(null);
      
    } catch (error) {
      toast({
        title: '❌ Error al registrar pago',
        description: error instanceof Error ? error.message : 'Error desconocido',
        variant: 'destructive',
      });
    }
  };

  const handlePayAllFromDetail = async () => {
    if (!selectedConsumption) return;
    
    try {
      await payConsumption(
        selectedConsumption.id,
        paymentMethod,
        referenceNumber,
        undefined // Pago total
      );
      
      if (selectedBranch) {
        const updatedConsumptions = await getConsumptions(selectedBranch.id);
        setConsumptions(updatedConsumptions);
      }
      
      toast({ title: '✅ Pago total registrado' });
      setDetailDialogOpen(false);
      setSelectedConsumption(null);
      
    } catch (error) {
      toast({
        title: '❌ Error',
        description: error instanceof Error ? error.message : 'Error al pagar',
        variant: 'destructive',
      });
    }
  };

  const clearFilters = () => {
    setHistoryWorkerFilter('all');
    setHistoryStatusFilter('all');
    setDateFrom('');
    setDateTo('');
  };

  if (!selectedBranch) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-gray-500">Seleccione una sucursal para ver los consumos</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Consumo Interno</h1>
          <p className="text-gray-500">Registro de deudas de trabajadores (Mini Tienda)</p>
        </div>
      </div>

      {/* Alerta de Deuda Total */}
      {totalPendingDebt > 0 && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="flex items-center justify-between py-4">
            <div className="flex items-center gap-3">
              <DollarSign className="h-5 w-5 text-red-600" />
              <div>
                <p className="font-medium text-red-800">Deuda total pendiente</p>
                <p className="text-sm text-red-600">
                  {workerPendingDebts.length} trabajadores deben
                </p>
              </div>
            </div>
            <div className="text-2xl font-bold text-red-700">
              {formatCurrency(totalPendingDebt)}
            </div>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Columna Izquierda: Productos e Historial */}
            <div className="lg:col-span-2 space-y-4">
              {/* Productos */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Package className="h-5 w-5" />
                    Productos Disponibles (Mini Tienda)
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex gap-3">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        placeholder="Buscar producto..."
                        value={productSearchQuery}
                        onChange={(e) => setProductSearchQuery(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                    <Select value={selectedProductType} onValueChange={(v: any) => setSelectedProductType(v)}>
                      <SelectTrigger className="w-[140px]">
                        <SelectValue placeholder="Tipo" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos</SelectItem>
                        <SelectItem value="A">Tipo A</SelectItem>
                        <SelectItem value="B">Tipo B</SelectItem>
                        <SelectItem value="C">Tipo C</SelectItem>
                        <SelectItem value="D">Tipo D (Mini Tienda)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {filteredProducts.map((product) => (
                      <div
                        key={product.id}
                        onClick={() => handleProductSelect(product)}
                        className="cursor-pointer border rounded-lg p-3 hover:shadow-md transition-shadow bg-white hover:border-blue-300"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <Badge className={`${getProductTypeColor(product.type)} text-white text-xs`}>
                            {getProductTypeLabel(product.type)}
                          </Badge>
                          <span className="text-xs text-green-600 font-medium">
                            Stock: {product.stock}
                          </span>
                        </div>
                        <h3 className="font-medium text-sm mb-1 line-clamp-2">{product.name}</h3>
                        <p className="text-lg font-bold text-blue-600">
                          {formatCurrency(product.sale_price)}
                        </p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Historial de Consumos con Filtros */}
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <Receipt className="h-5 w-5" />
                      Historial de Consumos
                    </CardTitle>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => setShowFilters(!showFilters)}
                    >
                      <Filter className="h-4 w-4 mr-2" />
                      Filtros
                    </Button>
                  </div>
                  
                  {/* Panel de Filtros */}
                  {showFilters && (
                    <div className="mt-4 p-4 bg-gray-50 rounded-lg space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label className="text-xs mb-1 block">Trabajador</Label>
                          <Select value={historyWorkerFilter} onValueChange={setHistoryWorkerFilter}>
                            <SelectTrigger>
                              <SelectValue placeholder="Todos" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">Todos</SelectItem>
                              {workers.map((w) => (
                                <SelectItem key={w.id} value={w.id}>{w.full_name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="text-xs mb-1 block">Estado</Label>
                          <Select value={historyStatusFilter} onValueChange={(v: any) => setHistoryStatusFilter(v)}>
                            <SelectTrigger>
                              <SelectValue placeholder="Todos" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">Todos</SelectItem>
                              <SelectItem value="pending">Pendiente</SelectItem>
                              <SelectItem value="paid">Pagado</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label className="text-xs mb-1 block">Desde</Label>
                          <Input 
                            type="date" 
                            value={dateFrom} 
                            onChange={(e) => setDateFrom(e.target.value)} 
                          />
                        </div>
                        <div>
                          <Label className="text-xs mb-1 block">Hasta</Label>
                          <Input 
                            type="date" 
                            value={dateTo} 
                            onChange={(e) => setDateTo(e.target.value)} 
                          />
                        </div>
                      </div>
                      <Button variant="ghost" size="sm" onClick={clearFilters} className="w-full">
                        <X className="h-4 w-4 mr-2" />
                        Limpiar filtros
                      </Button>
                    </div>
                  )}
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50 border-b">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Trabajador</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Producto</th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Cantidad</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Estado</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Fecha</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {filteredHistory.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                              No hay consumos que coincidan con los filtros
                            </td>
                          </tr>
                        ) : (
                          filteredHistory.map((consumption) => {
                            const worker = workers.find((w) => w.id === consumption.worker_id);
                            const product = products.find((p) => p.id === consumption.product_id);

                            return (
                              <tr 
                                key={consumption.id} 
                                onClick={() => openConsumptionDetail(consumption)}
                                className="hover:bg-gray-50 cursor-pointer transition-colors"
                              >
                                <td className="px-4 py-3 font-medium text-gray-900">
                                  {worker?.full_name || 'N/A'}
                                </td>
                                <td className="px-4 py-3 text-gray-600">
                                  {product?.name || 'N/A'}
                                </td>
                                <td className="px-4 py-3 text-center text-gray-600">
                                  {consumption.quantity}
                                </td>
                                <td className="px-4 py-3 text-right font-medium">
                                  {formatCurrency(consumption.total)}
                                </td>
                                <td className="px-4 py-3 text-center">
                                  {consumption.status === 'pending' ? (
                                    <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">
                                      Pendiente
                                    </Badge>
                                  ) : (
                                    <Badge className="bg-green-500 hover:bg-green-500">
                                      Pagado
                                    </Badge>
                                  )}
                                </td>
                                <td className="px-4 py-3 text-right text-sm text-gray-500">
                                  {new Date(consumption.consumed_at).toLocaleDateString()}
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Columna Derecha: Solo Deudas Pendientes por Trabajador */}
            <div>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <DollarSign className="h-5 w-5" />
                    Deudas Pendientes
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[600px] pr-4">
                    <div className="space-y-3">
                      {workerPendingDebts.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">
                          <CheckCircle className="h-12 w-12 mx-auto mb-2 opacity-30" />
                          <p>No hay deudas pendientes</p>
                        </div>
                      ) : (
                        workerPendingDebts.map((debt) => (
                          <div 
                            key={debt.worker.id} 
                            className="border rounded-lg p-4 bg-white"
                          >
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                                  <User className="h-5 w-5 text-blue-600" />
                                </div>
                                <div>
                                  <p className="font-medium text-gray-900">{debt.worker.full_name}</p>
                                  <p className="text-sm text-gray-500">
                                    {debt.pendingConsumptions.length} consumo(s) pendiente(s)
                                  </p>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="text-xl font-bold text-red-600">
                                  {formatCurrency(debt.totalPending)}
                                </p>
                              </div>
                            </div>
                            
                            {/* Lista de deudas pendientes de este trabajador */}
                            <div className="mt-3 space-y-2">
                              {debt.pendingConsumptions.slice(0, 3).map((c) => {
                                const prod = products.find(p => p.id === c.product_id);
                                return (
                                  <div 
                                    key={c.id} 
                                    onClick={() => openConsumptionDetail(c)}
                                    className="flex justify-between items-center p-2 bg-yellow-50 rounded cursor-pointer hover:bg-yellow-100"
                                  >
                                    <span className="text-sm text-gray-700">{prod?.name}</span>
                                    <span className="font-medium text-red-600">{formatCurrency(c.total)}</span>
                                  </div>
                                );
                              })}
                              {debt.pendingConsumptions.length > 3 && (
                                <p className="text-xs text-center text-gray-500">
                                  +{debt.pendingConsumptions.length - 3} más...
                                </p>
                              )}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>
          </div>
        </>
      )}

      {/* Modal Registrar Consumo */}
      <Dialog open={consumptionDialogOpen} onOpenChange={setConsumptionDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Registrar Consumo Interno</DialogTitle>
          </DialogHeader>
          
          {selectedProduct && (
            <div className="p-3 bg-blue-50 rounded-lg mb-4">
              <p className="font-medium text-blue-900">{selectedProduct.name}</p>
              <p className="text-sm text-blue-700">
                Precio: {formatCurrency(selectedProduct.sale_price)} | Stock: <strong>{selectedProduct.stock}</strong>
              </p>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmitConsumption)} className="space-y-4">
            <div className="space-y-2">
              <Label>Trabajador *</Label>
              <Select onValueChange={(v) => setValue('worker_id', v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar trabajador" />
                </SelectTrigger>
                <SelectContent>
                  {activeWorkers.map((worker) => (
                    <SelectItem key={worker.id} value={worker.id}>
                      {worker.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Cantidad *</Label>
              <Input
                type="number"
                min={1}
                max={selectedProduct?.stock || 1}
                {...register('quantity', { valueAsNumber: true })}
              />
            </div>

            {selectedProduct && watch('quantity') > 0 && (
              <div className="p-3 bg-gray-100 rounded-lg">
                <p className="text-sm">
                  Total a deber: <strong className="text-lg text-blue-600">
                    {formatCurrency(selectedProduct.sale_price * watch('quantity'))}
                  </strong>
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Label>Notas (opcional)</Label>
              <Input {...register('notes')} placeholder="Ej: Debe hace 2 semanas" />
            </div>

            <DialogFooter className="gap-2">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => {
                  setConsumptionDialogOpen(false);
                  setSelectedProduct(null);
                  reset();
                }}
              >
                Cancelar
              </Button>
              <Button 
                type="submit" 
                disabled={isSubmitting || !selectedProduct || (watch('quantity') || 0) > (selectedProduct?.stock || 0)}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {isSubmitting ? 'Registrando...' : 'Registrar Deuda'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal Detalle del Consumo */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedConsumption?.status === 'pending' ? (
                <Clock className="h-5 w-5 text-yellow-500" />
              ) : (
                <CheckCircle className="h-5 w-5 text-green-500" />
              )}
              Detalle del Consumo
            </DialogTitle>
          </DialogHeader>
          
          {selectedConsumption && (
            <div className="space-y-4 py-4">
              {/* Info del consumo */}
              <div className="space-y-2">
                {selectedConsumption.status === 'pending' ? (
                  <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-sm text-red-700 mb-1">Monto Pendiente</p>
                    <p className="text-3xl font-bold text-red-700">
                      {formatCurrency(selectedConsumption.total)}
                    </p>
                  </div>
                ) : (
                  <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                    <p className="text-sm text-green-700 mb-1">Monto Pagado</p>
                    <p className="text-3xl font-bold text-green-700">
                      {formatCurrency(selectedConsumption.total)}
                    </p>
                    <p className="text-sm text-green-600 mt-1">
                      Pagado el: {new Date(selectedConsumption.paid_at || '').toLocaleDateString()}
                      {selectedConsumption.payment_method === 'transfer' && ' (Transferencia)'}
                    </p>
                  </div>
                )}

                <div className="p-3 bg-gray-50 rounded-lg space-y-1">
                  <p className="text-sm"><strong>Trabajador:</strong> {workers.find(w => w.id === selectedConsumption.worker_id)?.full_name}</p>
                  <p className="text-sm"><strong>Producto:</strong> {products.find(p => p.id === selectedConsumption.product_id)?.name}</p>
                  <p className="text-sm"><strong>Cantidad:</strong> {selectedConsumption.quantity} unidades</p>
                  <p className="text-sm"><strong>Precio unitario:</strong> {formatCurrency(selectedConsumption.unit_price)}</p>
                  <p className="text-sm"><strong>Fecha:</strong> {new Date(selectedConsumption.consumed_at).toLocaleDateString()}</p>
                  {selectedConsumption.notes && (
                    <p className="text-sm"><strong>Notas:</strong> {selectedConsumption.notes}</p>
                  )}
                </div>
              </div>

              {/* Solo mostrar opciones de pago si está pendiente */}
              {selectedConsumption.status === 'pending' && (
                <>
                  <Separator />
                  
                  <div className="space-y-3">
                    <Label>Método de Pago</Label>
                    <div className="grid grid-cols-2 gap-3">
                      <Button
                        type="button"
                        variant={paymentMethod === 'cash' ? 'default' : 'outline'}
                        className="flex flex-col items-center py-3 h-auto"
                        onClick={() => setPaymentMethod('cash')}
                      >
                        <Banknote className="h-5 w-5 mb-1" />
                        <span>Efectivo</span>
                      </Button>
                      <Button
                        type="button"
                        variant={paymentMethod === 'transfer' ? 'default' : 'outline'}
                        className="flex flex-col items-center py-3 h-auto"
                        onClick={() => setPaymentMethod('transfer')}
                      >
                        <ArrowRightLeft className="h-5 w-5 mb-1" />
                        <span>Transferencia</span>
                      </Button>
                    </div>

                    {paymentMethod === 'transfer' && (
                      <div className="space-y-2">
                        <Label>Referencia/Número de Transferencia *</Label>
                        <Input
                          placeholder="Ej: TRX-123456"
                          value={referenceNumber}
                          onChange={(e) => setReferenceNumber(e.target.value)}
                        />
                      </div>
                    )}

                    <div className="space-y-2">
                      <Label>Monto a pagar</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={partialAmount}
                        onChange={(e) => setPartialAmount(e.target.value)}
                      />
                      <p className="text-xs text-gray-500">
                        Deje el monto completo para pagar todo, o ingrese un monto menor para pago parcial
                      </p>
                    </div>
                  </div>

                  <DialogFooter className="gap-2">
                    <Button variant="outline" onClick={() => setDetailDialogOpen(false)}>
                      Cerrar
                    </Button>
                    <Button 
                      onClick={handlePay}
                      disabled={paymentMethod === 'transfer' && !referenceNumber}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      <DollarSign className="h-4 w-4 mr-2" />
                      {parseFloat(partialAmount) < selectedConsumption.total ? 'Registrar Pago Parcial' : 'Pagar Total'}
                    </Button>
                  </DialogFooter>
                </>
              )}

              {selectedConsumption.status === 'paid' && (
                <DialogFooter>
                  <Button variant="outline" onClick={() => setDetailDialogOpen(false)} className="w-full">
                    Cerrar
                  </Button>
                </DialogFooter>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}