'use client';

import { useState, useMemo, useEffect } from 'react';
import { DocumentModal } from '@/components/documents/DocumentModal';
import { Plus, Search, Wrench, Calendar, User, Car, CheckCircle, Clock, Loader2, FileText, Package, Trash2, TrendingUp, Filter } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
import { Textarea } from '@/components/ui/textarea';
import { useBranchStore } from '@/store/useBranchStore';
import { WorkOrder, Customer, Worker, Product, WorkOrderItem } from '@/types/database';
import { getWorkOrders, createWorkOrder, updateWorkOrder, assignMechanic, addWorkOrderItem, getWorkOrderItems } from '@/lib/actions/workOrders';
import { getCustomers } from '@/lib/actions/customers';
import { getWorkers } from '@/lib/actions/workers';
import { getProducts } from '@/lib/actions/products';
import { formatCurrency } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { format, subDays, isWithinInterval, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

const workOrderSchema = z.object({
  customer_id: z.string().min(1, 'Cliente requerido'),
  vehicle_id: z.string().min(1, 'Vehiculo requerido'),
  description: z.string().min(1, 'Descripcion requerida'),
  mechanic_id: z.string().optional(),
});

type WorkOrderForm = z.infer<typeof workOrderSchema>;



const statusLabels: Record<string, string> = {
  pending: 'Pendiente',
  in_progress: 'En Progreso',
  completed: 'Completado',
  delivered: 'Entregado',
};

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-500',
  in_progress: 'bg-blue-500',
  completed: 'bg-green-500',
  delivered: 'bg-gray-500',
};

const productTypeLabels: Record<string, string> = {
  'A': 'Tipo A (Repuestos)',
  'B': 'Tipo B (Lubricantes)',
  'C': 'Tipo C (Baterías)',
  'D': 'Tipo D (Mini Tienda)',
};

export default function WorkOrdersPage() {
  const { selectedBranch } = useBranchStore();
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [submitting, setSubmitting] = useState(false);
  
  // Filtros de fecha
  const [dateFilter, setDateFilter] = useState<'3days' | 'week' | 'month' | 'all'>('3days');
  
  // Filtros de productos (NUEVO)
  const [selectedType, setSelectedType] = useState<string>('');
  const [productSearch, setProductSearch] = useState('');
  
  // Estados para items de la orden
  const [orderItems, setOrderItems] = useState<Array<{
    id?: string;
    product_id?: string;
    description: string;
    quantity: number;
    unit_price: number;
    cost_price?: number;
    is_product: boolean;
  }>>([]);
  const [manualDescription, setManualDescription] = useState('');
  const [manualPrice, setManualPrice] = useState('');

  const [documentModal, setDocumentModal] = useState<{
    order: WorkOrder | null;
    type: 'invoice' | 'note' | null;
  }>({ order: null, type: null });
  
  // Estado para ver items de una orden existente
  const [viewingOrder, setViewingOrder] = useState<WorkOrder | null>(null);
  const [orderItemsView, setOrderItemsView] = useState<WorkOrderItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);
  
  // Estado para agregar items a orden existente
  const [editingOrder, setEditingOrder] = useState<WorkOrder | null>(null);
  const [newItems, setNewItems] = useState<Array<{
    product_id?: string;
    description: string;
    quantity: number;
    unit_price: number;
    is_product: boolean;
  }>>([]);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<WorkOrderForm>({
    resolver: zodResolver(workOrderSchema),
  });

  useEffect(() => {
    async function loadData() {
      if (!selectedBranch) {
        setWorkOrders([]);
        setCustomers([]);
        setWorkers([]);
        setProducts([]);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const [ordersData, customersData, workersData, productsData] = await Promise.all([
          getWorkOrders(selectedBranch.id),
          getCustomers(selectedBranch.id),
          getWorkers(selectedBranch.id),
          getProducts(selectedBranch.id),
        ]);
        setWorkOrders(ordersData);
        setCustomers(customersData);
        setWorkers(workersData.filter(w => w.is_active && w.role === 'mecanico'));
        setProducts(productsData.filter(p => p.is_active));
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

  // Filtrar productos por tipo y búsqueda (NUEVO)
  const filteredProducts = useMemo(() => {
    return products.filter(product => {
     const matchesType = selectedType && selectedType !== 'all' ? product.type === selectedType : true;
      const matchesSearch = productSearch 
        ? product.name.toLowerCase().includes(productSearch.toLowerCase()) ||
          product.barcode?.includes(productSearch)
        : true;
      return matchesType && matchesSearch && product.stock > 0;
    });
  }, [products, selectedType, productSearch]);

  // Filtrar por fechas
  const filteredByDate = useMemo(() => {
    if (dateFilter === 'all') return workOrders;
    
    let start: Date;
    let end: Date = new Date();
    
    switch (dateFilter) {
      case '3days':
        start = subDays(end, 3);
        break;
      case 'week':
        start = subDays(end, 7);
        break;
      case 'month':
        start = subDays(end, 30);
        break;
      default:
        return workOrders;
    }
    
    return workOrders.filter(order => {
      const orderDate = parseISO(order.created_at);
      return isWithinInterval(orderDate, { start, end });
    });
  }, [workOrders, dateFilter]);

  // Filtrar por búsqueda
  const filteredWorkOrders = useMemo(() => {
    return filteredByDate.filter((order) => {
      const customer = customers.find(c => c.id === order.customer_id);
      const searchLower = searchQuery.toLowerCase();
      return (
        customer?.name.toLowerCase().includes(searchLower) ||
        order.description.toLowerCase().includes(searchLower)
      );
    });
  }, [filteredByDate, customers, searchQuery]);

  // Calcular estadísticas con ganancias
  const stats = useMemo(() => {
    const total = filteredWorkOrders.length;
    const pending = filteredWorkOrders.filter((o) => o.status === 'pending').length;
    const inProgress = filteredWorkOrders.filter((o) => o.status === 'in_progress').length;
    const completed = filteredWorkOrders.filter((o) => o.status === 'completed' || o.status === 'delivered').length;
    
    const totalRevenue = filteredWorkOrders
      .filter(o => o.status === 'completed' || o.status === 'delivered')
      .reduce((sum, o) => sum + o.total, 0);
    
    const totalCost = totalRevenue * 0.7;
    const profit = totalRevenue - totalCost;
    
    return {
      total,
      pending,
      inProgress,
      completed,
      totalRevenue,
      profit,
    };
  }, [filteredWorkOrders]);

  const handleOpenDialog = () => {
    reset({
      customer_id: '',
      vehicle_id: '',
      description: '',
      mechanic_id: '',
    });
    setSelectedCustomer(null);
    setOrderItems([]);
    setSelectedType('');
    setProductSearch('');
    setManualDescription('');
    setManualPrice('');
    setDialogOpen(true);
  };

  const calculateTotal = () => {
    return orderItems.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
  };

  const handleAddProduct = (product: Product) => {
    if (product.stock <= 0) {
      toast({
        title: 'Sin stock',
        description: 'Este producto no tiene stock disponible',
        variant: 'destructive',
      });
      return;
    }

    const existing = orderItems.find(item => item.product_id === product.id);
    if (existing) {
      if (existing.quantity >= product.stock) {
        toast({
          title: 'Stock insuficiente',
          description: `Solo hay ${product.stock} unidades disponibles`,
          variant: 'destructive',
        });
        return;
      }
      setOrderItems(items => items.map(item => 
        item.product_id === product.id 
          ? { ...item, quantity: item.quantity + 1 }
          : item
      ));
    } else {
      setOrderItems(items => [...items, {
        product_id: product.id,
        description: product.name,
        quantity: 1,
        unit_price: product.sale_price,
        cost_price: product.cost_price,
        is_product: true,
      }]);
    }
    toast({
      title: 'Producto agregado',
      description: `${product.name} agregado a la orden`,
    });
  };

  const handleAddManualItem = () => {
    const price = parseFloat(manualPrice);
    if (!manualDescription || isNaN(price) || price <= 0) {
      toast({
        title: 'Error',
        description: 'Ingrese una descripción y un precio válido mayor a 0',
        variant: 'destructive',
      });
      return;
    }
    
    setOrderItems(items => [...items, {
      description: manualDescription,
      quantity: 1,
      unit_price: price,
      cost_price: 0,
      is_product: false,
    }]);
    setManualDescription('');
    setManualPrice('');
  };

  const handleRemoveItem = (index: number) => {
    setOrderItems(items => items.filter((_, i) => i !== index));
  };

  const onSubmit = async (data: WorkOrderForm) => {
    if (!selectedBranch) return;
    if (orderItems.length === 0) {
      toast({
        title: 'Error',
        description: 'Agregue al menos un producto o servicio',
        variant: 'destructive',
      });
      return;
    }
    
    if (orderItems.some(item => item.unit_price <= 0)) {
      toast({
        title: 'Error',
        description: 'Todos los precios deben ser mayores a 0',
        variant: 'destructive',
      });
      return;
    }
    
    setSubmitting(true);
    try {
      const newOrder = await createWorkOrder({
        ...data,
        branch_id: selectedBranch.id,
        status: 'pending',
        total: calculateTotal(),
      });

      for (const item of orderItems) {
        await addWorkOrderItem({
          work_order_id: newOrder.id,
          product_id: item.product_id,
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unit_price,
          is_product: item.is_product,
        });
      }

      setWorkOrders((prev) => [newOrder, ...prev]);
      toast({ title: 'Orden de trabajo creada correctamente' });
      setDialogOpen(false);
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Error al crear orden',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Agregar items a orden existente
  const handleOpenEditOrder = async (order: WorkOrder) => {
    if (order.status === 'completed' || order.status === 'delivered') {
      toast({
        title: 'No se puede editar',
        description: 'Las órdenes completadas o entregadas no se pueden modificar',
        variant: 'destructive',
      });
      return;
    }
    
    setEditingOrder(order);
    setNewItems([]);
    setSelectedType('');
    setProductSearch('');
    setLoadingItems(true);
    
    try {
      const items = await getWorkOrderItems(order.id);
      setOrderItemsView(items);
    } catch (error) {
      console.error(error);
    } finally {
      setLoadingItems(false);
    }
  };

  const handleAddItemToExisting = (product?: Product) => {
    if (product) {
      const existing = newItems.find(item => item.product_id === product.id);
      if (existing) {
        if (existing.quantity >= product.stock) {
          toast({
            title: 'Stock insuficiente',
            description: `Solo hay ${product.stock} unidades disponibles`,
            variant: 'destructive',
          });
          return;
        }
        setNewItems(items => items.map(item => 
          item.product_id === product.id 
            ? { ...item, quantity: item.quantity + 1 }
            : item
        ));
      } else {
        setNewItems(items => [...items, {
          product_id: product.id,
          description: product.name,
          quantity: 1,
          unit_price: product.sale_price,
          is_product: true,
        }]);
      }
    } else if (manualDescription && manualPrice) {
      const price = parseFloat(manualPrice);
      if (isNaN(price) || price <= 0) {
        toast({
          title: 'Error',
          description: 'Precio debe ser mayor a 0',
          variant: 'destructive',
        });
        return;
      }
      
      setNewItems(items => [...items, {
        description: manualDescription,
        quantity: 1,
        unit_price: price,
        is_product: false,
      }]);
      setManualDescription('');
      setManualPrice('');
    }
  };

  const handleSaveNewItems = async () => {
    if (!editingOrder || newItems.length === 0) return;
    
    setSubmitting(true);
    try {
      for (const item of newItems) {
        await addWorkOrderItem({
          work_order_id: editingOrder.id,
          product_id: item.product_id,
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unit_price,
          is_product: item.is_product,
        });
      }
      
      const newTotal = editingOrder.total + newItems.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
      await updateWorkOrder(editingOrder.id, { total: newTotal });
      
      const updatedOrders = await getWorkOrders(selectedBranch!.id);
      setWorkOrders(updatedOrders);
      
      toast({ title: 'Items agregados correctamente' });
      setEditingOrder(null);
      setNewItems([]);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudieron agregar los items',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusChange = async (orderId: string, newStatus: WorkOrder['status']) => {
    try {
      const updated = await updateWorkOrder(orderId, { status: newStatus });
      setWorkOrders((prev) =>
        prev.map((o) => (o.id === orderId ? updated : o))
      );
      toast({ title: `Estado actualizado a: ${statusLabels[newStatus]}` });
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Error al actualizar estado',
        variant: 'destructive',
      });
    }
  };

  const handleAssignMechanic = async (orderId: string, mechanicId: string) => {
    try {
      await assignMechanic(orderId, mechanicId);
      setWorkOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, mechanic_id: mechanicId } : o))
      );
      toast({ title: 'Mecanico asignado correctamente' });
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Error al asignar mecanico',
        variant: 'destructive',
      });
    }
  };

  const handleViewOrderItems = async (order: WorkOrder) => {
    setViewingOrder(order);
    setLoadingItems(true);
    try {
      const items = await getWorkOrderItems(order.id);
      setOrderItemsView(items);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudieron cargar los items',
        variant: 'destructive',
      });
    } finally {
      setLoadingItems(false);
    }
  };

 const handleGenerateDocument = (order: WorkOrder, type: 'invoice' | 'note') => {
  setDocumentModal({ order, type });
};

  const selectedCustomerId = watch('customer_id');
  
  useEffect(() => {
    if (selectedCustomerId) {
      const customer = customers.find(c => c.id === selectedCustomerId);
      setSelectedCustomer(customer || null);
      setValue('vehicle_id', '');
    }
  }, [selectedCustomerId, customers, setValue]);

  if (!selectedBranch) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-gray-500">Seleccione una sucursal para ver las ordenes</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Ordenes de Trabajo</h1>
          <p className="text-gray-500">Gestion de reparaciones y servicios</p>
        </div>
        <Button onClick={handleOpenDialog}>
          <Plus className="h-4 w-4 mr-2" />
          Nueva Orden
        </Button>
      </div>

      {/* Stats con Ganancias */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Total Ordenes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Pendientes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">En Progreso</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{stats.inProgress}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Ingresos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(stats.totalRevenue)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500 flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Ganancia Est.
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">
              {formatCurrency(stats.profit)}
            </div>
            <p className="text-xs text-gray-400 mt-1">~30% margen estimado</p>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between bg-gray-50 p-4 rounded-lg">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-gray-500" />
          <span className="text-sm font-medium text-gray-700">Filtrar por:</span>
          <Select value={dateFilter} onValueChange={(v: any) => setDateFilter(v)}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="3days">Últimos 3 días</SelectItem>
              <SelectItem value="week">Última semana</SelectItem>
              <SelectItem value="month">Último mes</SelectItem>
              <SelectItem value="all">Todas las fechas</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Calendar className="h-4 w-4" />
          <span>
            {dateFilter === '3days' && `Desde ${format(subDays(new Date(), 3), 'dd/MM/yyyy')}`}
            {dateFilter === 'week' && `Desde ${format(subDays(new Date(), 7), 'dd/MM/yyyy')}`}
            {dateFilter === 'month' && `Desde ${format(subDays(new Date(), 30), 'dd/MM/yyyy')}`}
            {dateFilter === 'all' && 'Todas las fechas'}
          </span>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          placeholder="Buscar ordenes..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Work Orders List */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      ) : (
        <div className="space-y-4">
          {filteredWorkOrders.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No se encontraron ordenes de trabajo en este período
            </div>
          ) : (
            filteredWorkOrders.map((order) => {
              const customer = customers.find(c => c.id === order.customer_id);
              const vehicle = customer?.vehicles?.find(v => v.id === order.vehicle_id);
              const mechanic = workers.find(w => w.id === order.mechanic_id);

              return (
                <Card key={order.id}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                          <Wrench className="h-5 w-5 text-blue-600" />
                        </div>
                        <div>
                          <CardTitle className="text-lg">
                            {customer?.name || 'Cliente no encontrado'}
                          </CardTitle>
                          <div className="flex items-center gap-4 text-sm text-gray-500 mt-1">
                            <span className="flex items-center gap-1">
                              <Car className="h-3 w-3" />
                              {vehicle ? `${vehicle.brand} ${vehicle.model} (${vehicle.plate})` : 'Vehiculo no encontrado'}
                            </span>
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {format(parseISO(order.created_at), 'dd/MM/yyyy HH:mm', { locale: es })}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={`${statusColors[order.status]} text-white`}>
                          {statusLabels[order.status]}
                        </Badge>
                        <span className="font-bold text-lg">
                          {formatCurrency(order.total)}
                        </span>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div>
                        <p className="text-sm text-gray-600">{order.description}</p>
                      </div>
                      
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-gray-500">Mecanico:</span>
                          <Select
                            value={order.mechanic_id || ''}
                            onValueChange={(v) => handleAssignMechanic(order.id, v)}
                          >
                            <SelectTrigger className="w-48">
                              <SelectValue placeholder="Asignar mecanico" />
                            </SelectTrigger>
                            <SelectContent>
                              {workers.map((worker) => (
                                <SelectItem key={worker.id} value={worker.id}>
                                  {worker.full_name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="flex items-center gap-2">
                          {(order.status === 'pending' || order.status === 'in_progress') && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleOpenEditOrder(order)}
                            >
                              <Plus className="h-4 w-4 mr-2" />
                              Agregar Item
                            </Button>
                          )}
                          
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleViewOrderItems(order)}
                          >
                            <Package className="h-4 w-4 mr-2" />
                            Ver Items
                          </Button>
                          
                          {order.status === 'completed' && (
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleGenerateDocument(order, 'note')}
                              >
                                <FileText className="h-4 w-4 mr-2" />
                                Nota de Venta
                              </Button>
                              <Button
                                variant="default"
                                size="sm"
                                onClick={() => handleGenerateDocument(order, 'invoice')}
                              >
                                <FileText className="h-4 w-4 mr-2" />
                                Factura
                              </Button>
                            </>
                          )}
                          
                          {order.status === 'pending' && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleStatusChange(order.id, 'in_progress')}
                            >
                              <Clock className="h-4 w-4 mr-2" />
                              Iniciar
                            </Button>
                          )}
                          
                          {order.status === 'in_progress' && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleStatusChange(order.id, 'completed')}
                            >
                              <CheckCircle className="h-4 w-4 mr-2" />
                              Completar
                            </Button>
                          )}
                          
                          {order.status === 'completed' && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleStatusChange(order.id, 'delivered')}
                            >
                              <CheckCircle className="h-4 w-4 mr-2" />
                              Entregar
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      )}

      {/* New Work Order Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nueva Orden de Trabajo</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Cliente *</Label>
                <Select
                  value={watch('customer_id')}
                  onValueChange={(v) => setValue('customer_id', v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar cliente" />
                  </SelectTrigger>
                  <SelectContent>
                    {customers.map((customer) => (
                      <SelectItem key={customer.id} value={customer.id}>
                        {customer.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.customer_id && (
                  <p className="text-sm text-red-500">{errors.customer_id.message}</p>
                )}
              </div>

              {selectedCustomer && (
                <div className="space-y-2">
                  <Label>Vehiculo *</Label>
                  <Select
                    value={watch('vehicle_id')}
                    onValueChange={(v) => setValue('vehicle_id', v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar vehiculo" />
                    </SelectTrigger>
                    <SelectContent>
                      {selectedCustomer.vehicles?.map((vehicle) => (
                        <SelectItem key={vehicle.id} value={vehicle.id}>
                          {vehicle.brand} {vehicle.model} ({vehicle.plate})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.vehicle_id && (
                    <p className="text-sm text-red-500">{errors.vehicle_id.message}</p>
                  )}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label>Descripcion del trabajo *</Label>
              <Textarea
                {...register('description')}
                placeholder="Describa el trabajo a realizar..."
                rows={2}
              />
              {errors.description && (
                <p className="text-sm text-red-500">{errors.description.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Mecanico asignado</Label>
              <Select
                value={watch('mechanic_id') || ''}
                onValueChange={(v) => setValue('mechanic_id', v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar mecanico (opcional)" />
                </SelectTrigger>
                <SelectContent>
                  {workers.map((worker) => (
                    <SelectItem key={worker.id} value={worker.id}>
                      {worker.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Sección de Productos/Servicios con Filtros */}
            <div className="border rounded-lg p-4 space-y-4 bg-gray-50">
              <h3 className="font-semibold flex items-center gap-2">
                <Package className="h-4 w-4" />
                Productos y Servicios
              </h3>
              
              {/* Filtros de Productos (NUEVO) */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-white p-3 rounded border">
                <div>
                  <Label className="text-xs text-gray-500">Filtrar por Tipo</Label>
                  <Select value={selectedType} onValueChange={setSelectedType}>
                    <SelectTrigger>
                      <SelectValue placeholder="Todos los tipos" />
                    </SelectTrigger>
                    <SelectContent>
  <SelectItem value="all">Todos los tipos</SelectItem>
  <SelectItem value="A">Tipo A (Repuestos)</SelectItem>
  <SelectItem value="B">Tipo B (Lubricantes)</SelectItem>
  <SelectItem value="C">Tipo C (Baterías)</SelectItem>
  <SelectItem value="D">Tipo D (Mini Tienda)</SelectItem>
</SelectContent>
                  </Select>
                </div>
                
                <div className="md:col-span-2">
                  <Label className="text-xs text-gray-500">Buscar por nombre</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      placeholder="Escriba para buscar producto..."
                      value={productSearch}
                      onChange={(e) => setProductSearch(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
              </div>

              {/* Lista de productos filtrados */}
              {filteredProducts.length > 0 && (
                <div className="bg-white rounded border max-h-48 overflow-y-auto">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 p-2">
                    {filteredProducts.map((product) => (
                      <div
                        key={product.id}
                        className="flex items-center justify-between p-2 hover:bg-blue-50 rounded cursor-pointer border border-transparent hover:border-blue-200 transition-colors"
                        onClick={() => handleAddProduct(product)}
                      >
                        <div className="flex-1">
                          <p className="font-medium text-sm">{product.name}</p>
                          <p className="text-xs text-gray-500">
                            Stock: {product.stock} | ${product.sale_price}
                          </p>
                        </div>
                        <Badge variant="secondary" className="text-xs">
                          {product.type}
                        </Badge>
                        <Button type="button" size="sm" variant="ghost" className="ml-2">
                          <Plus className="h-4 w-4 text-blue-600" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {filteredProducts.length === 0 && (selectedType || productSearch) && (
                <div className="text-center py-4 text-gray-500 text-sm bg-white rounded border">
                  No se encontraron productos con esos filtros
                </div>
              )}

              {/* Agregar servicio manual */}
              <div className="border-t pt-3">
                <Label className="text-xs text-gray-500 mb-2 block">O agregar servicio manual:</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="Descripción del servicio"
                    value={manualDescription}
                    onChange={(e) => setManualDescription(e.target.value)}
                    className="flex-1"
                  />
                  <Input
                    type="number"
                    min="0.01"
                    step="0.01"
                    placeholder="Precio"
                    value={manualPrice}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === '' || parseFloat(val) >= 0) {
                        setManualPrice(val);
                      }
                    }}
                    className="w-28"
                  />
                  <Button 
                    type="button" 
                    onClick={handleAddManualItem} 
                    disabled={!manualDescription || !manualPrice}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Lista de items agregados */}
              {orderItems.length > 0 && (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Descripción</TableHead>
                      <TableHead className="text-center">Cant</TableHead>
                      <TableHead className="text-right">Precio</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orderItems.map((item, index) => (
                      <TableRow key={index}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {item.is_product && <Package className="h-3 w-3 text-blue-500" />}
                            <span className="text-sm">{item.description}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <Input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) => {
                              const newItems = [...orderItems];
                              newItems[index].quantity = Math.max(1, parseInt(e.target.value) || 1);
                              setOrderItems(newItems);
                            }}
                            className="w-16 mx-auto text-center"
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          ${item.unit_price.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          ${(item.quantity * item.unit_price).toFixed(2)}
                        </TableCell>
                        <TableCell>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveItem(index)}
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="border-t-2 bg-blue-50">
                      <TableCell colSpan={2} className="text-right font-bold text-blue-900">
                        Total:
                      </TableCell>
                      <TableCell colSpan={2} className="text-right font-bold text-lg text-blue-900">
                        ${calculateTotal().toFixed(2)}
                      </TableCell>
                      <TableCell></TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              )}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={submitting || orderItems.length === 0}>
                {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Crear Orden (${calculateTotal().toFixed(2)})
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog para agregar items a orden existente */}
      <Dialog open={!!editingOrder} onOpenChange={() => setEditingOrder(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Agregar Items a Orden #{editingOrder?.id.slice(0, 8)}</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="text-sm text-gray-500">
              Estado: <Badge className={editingOrder ? statusColors[editingOrder.status] : ''}>
                {editingOrder && statusLabels[editingOrder.status]}
              </Badge>
            </div>

            {/* Filtros para orden existente */}
            <div className="space-y-2">
              <Label>Agregar Productos</Label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                <Select value={selectedType} onValueChange={setSelectedType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Todos</SelectItem>
                    <SelectItem value="A">Tipo A</SelectItem>
                    <SelectItem value="B">Tipo B</SelectItem>
                    <SelectItem value="C">Tipo C</SelectItem>
                    <SelectItem value="D">Tipo D</SelectItem>
                  </SelectContent>
                </Select>
                <div className="md:col-span-2">
                  <Input
                    placeholder="Buscar producto..."
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                  />
                </div>
              </div>
              
              {/* Lista filtrada para agregar */}
              {filteredProducts.length > 0 && (
                <div className="border rounded max-h-32 overflow-y-auto bg-white">
                  {filteredProducts.map((product) => (
                    <div
                      key={product.id}
                      className="flex items-center justify-between p-2 hover:bg-blue-50 cursor-pointer border-b last:border-0"
                      onClick={() => handleAddItemToExisting(product)}
                    >
                      <span className="text-sm">{product.name}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500">Stock: {product.stock}</span>
                        <Badge variant="secondary" className="text-xs">${product.sale_price}</Badge>
                        <Plus className="h-4 w-4 text-blue-600" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
              
              {/* Servicio manual */}
              <div className="flex gap-2 pt-2">
                <Input
                  placeholder="Servicio manual..."
                  value={manualDescription}
                  onChange={(e) => setManualDescription(e.target.value)}
                />
                <Input
                  type="number"
                  placeholder="Precio"
                  value={manualPrice}
                  onChange={(e) => setManualPrice(e.target.value)}
                  className="w-24"
                />
                <Button type="button" onClick={() => handleAddItemToExisting()}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Items nuevos pendientes */}
            {newItems.length > 0 && (
              <div className="border rounded p-3 bg-yellow-50 space-y-2">
                <p className="text-sm font-medium text-yellow-800">Nuevos items a agregar:</p>
                {newItems.map((item, idx) => (
                  <div key={idx} className="flex justify-between text-sm">
                    <span>{item.quantity}x {item.description}</span>
                    <span>${(item.quantity * item.unit_price).toFixed(2)}</span>
                  </div>
                ))}
                <div className="border-t pt-2 flex justify-between font-bold text-yellow-900">
                  <span>Total nuevo:</span>
                  <span>${newItems.reduce((sum, i) => sum + (i.quantity * i.unit_price), 0).toFixed(2)}</span>
                </div>
              </div>
            )}

            {/* Items existentes */}
            <div className="border rounded p-3 bg-gray-50">
              <p className="text-sm font-medium text-gray-700 mb-2">Items actuales:</p>
              {loadingItems ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <div className="space-y-1">
                  {orderItemsView.map((item) => (
                    <div key={item.id} className="flex justify-between text-sm text-gray-600">
                      <span>{item.quantity}x {item.description}</span>
                      <span>${item.total_price.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setEditingOrder(null)}>
                Cancelar
              </Button>
              <Button 
                onClick={handleSaveNewItems} 
                disabled={newItems.length === 0 || submitting}
              >
                {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Guardar Cambios
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog para ver items de orden existente */}
      <Dialog open={!!viewingOrder} onOpenChange={() => setViewingOrder(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Detalle de Orden</DialogTitle>
          </DialogHeader>
          {viewingOrder && (
            <div className="space-y-4">
              <div className="text-sm text-gray-500">
                Orden #{viewingOrder.id.slice(0, 8)} - {statusLabels[viewingOrder.status]}
              </div>
              
              {loadingItems ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Descripción</TableHead>
                      <TableHead className="text-center">Cant</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orderItemsView.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="flex items-center gap-2">
                          {item.is_product && <Package className="h-3 w-3 text-blue-500" />}
                          {item.description}
                        </TableCell>
                        <TableCell className="text-center">{item.quantity}</TableCell>
                        <TableCell className="text-right">${item.total_price.toFixed(2)}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="border-t-2">
                      <TableCell colSpan={2} className="text-right font-bold">Total:</TableCell>
                      <TableCell className="text-right font-bold">
                        ${viewingOrder.total.toFixed(2)}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
      <DocumentModal
  order={documentModal.order}
  type={documentModal.type}
  onClose={() => setDocumentModal({ order: null, type: null })}
  onPrinted={() => {
    toast({ title: 'Documento impreso correctamente' });
    setDocumentModal({ order: null, type: null });
  }} />
    </div>
  );
}