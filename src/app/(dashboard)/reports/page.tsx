'use client';

import React, { useState, useEffect } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, AreaChart, Area
} from 'recharts';
import { 
  Download, Filter, Package, ShoppingCart, Coffee, Wrench,
  Calendar, TrendingUp, DollarSign, Users, AlertCircle, Loader2, Info
} from 'lucide-react';
import { format, subDays, startOfDay, endOfDay, parseISO } from 'date-fns';
import { useBranchStore } from '@/store/useBranchStore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';

type ReportType = 'sales' | 'inventory' | 'orders' | 'internal_consumption';
type DateRange = 'today' | 'week' | 'month' | 'custom';

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];

export default function ReportsPage() {
  const { selectedBranch } = useBranchStore();
  const { toast } = useToast();
  const [reportType, setReportType] = useState<ReportType>('sales');
  const [dateRange, setDateRange] = useState<DateRange>('week');
  const [isLoading, setIsLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  
  const [salesData, setSalesData] = useState<any>(null);
  const [inventoryData, setInventoryData] = useState<any>(null);
  const [consumptionData, setConsumptionData] = useState<any>(null);

  useEffect(() => {
    if (selectedBranch?.id) {
      loadReportData();
    }
  }, [selectedBranch?.id, reportType, dateRange]);

  const getDateRange = () => {
    const now = new Date();
    let start: Date;
    let end: Date = endOfDay(now);

    switch (dateRange) {
      case 'today':
        start = startOfDay(now);
        break;
      case 'week':
        start = startOfDay(subDays(now, 7));
        break;
      case 'month':
        start = startOfDay(subDays(now, 30));
        break;
      default:
        start = startOfDay(subDays(now, 7));
    }

    return { 
      start: start.toISOString(), 
      end: end.toISOString()
    };
  };

  const loadReportData = async () => {
    if (!selectedBranch?.id) return;
    setIsLoading(true);
    
    try {
      const { start, end } = getDateRange();
      console.log(`Cargando ${reportType} para sucursal ${selectedBranch.id}`);
      
      if (reportType === 'sales') {
        const { data: sales, error } = await supabase
          .from('sales')
          .select('*')
          .eq('branch_id', selectedBranch.id)
          .gte('created_at', start)
          .lte('created_at', end)
          .order('created_at', { ascending: false });
          
        if (error) throw error;
        
        if (sales && sales.length > 0) {
          const grouped = sales.reduce((acc: any, sale: any) => {
            const date = format(parseISO(sale.created_at), 'dd/MM');
            if (!acc[date]) acc[date] = { date, total: 0, count: 0 };
            acc[date].total += sale.total;
            acc[date].count += 1;
            return acc;
          }, {});
          
          const paymentMethods = sales.reduce((acc: any, sale: any) => {
            acc[sale.payment_method] = (acc[sale.payment_method] || 0) + sale.total;
            return acc;
          }, {});
          
          setSalesData({
            total: sales.reduce((sum, s) => sum + s.total, 0),
            count: sales.length,
            averageTicket: sales.length > 0 ? sales.reduce((sum, s) => sum + s.total, 0) / sales.length : 0,
            chartData: Object.values(grouped),
            paymentMethods,
            sales
          });
        } else {
          setSalesData({ total: 0, count: 0, averageTicket: 0, chartData: [], paymentMethods: {}, sales: [] });
        }
      } 
      else if (reportType === 'inventory') {
        const { data: products, error } = await supabase
          .from('products')
          .select('*')
          .eq('branch_id', selectedBranch.id);
          
        if (error) throw error;
        
        if (products) {
          const byType = products.reduce((acc: any, p: any) => {
            acc[p.type] = (acc[p.type] || 0) + 1;
            return acc;
          }, {});
          
          setInventoryData({
            totalProducts: products.length,
            lowStock: products.filter((p: any) => p.stock > 0 && p.stock < 5).length,
            outOfStock: products.filter((p: any) => p.stock === 0).length,
            totalValue: products.reduce((sum, p) => sum + (p.price * p.stock), 0),
            byType,
            topStock: [...products].sort((a: any, b: any) => b.stock - a.stock).slice(0, 10)
          });
        }
      }
      else if (reportType === 'internal_consumption') {
        console.log('Cargando consumos internos...');
        
        // Primero obtener los trabajadores de la sucursal
        const { data: workers, error: workersError } = await supabase
          .from('workers')
          .select('id, full_name')
          .eq('branch_id', selectedBranch.id)
          .eq('is_active', true);
          
        if (workersError) throw workersError;
        
        console.log('Trabajadores encontrados:', workers?.length || 0);
        
        if (!workers || workers.length === 0) {
          setConsumptionData({
            totalDebt: 0,
            workersWithDebt: 0,
            totalConsumptions: 0,
            pendingCount: 0,
            paidCount: 0,
            byWorker: [],
            recentConsumptions: []
          });
          setIsLoading(false);
          return;
        }
        
        const workerIds = workers.map(w => w.id);
        
        // Obtener consumos de esos trabajadores
        const { data: consumptions, error: consError } = await supabase
          .from('worker_consumptions')
          .select(`
            *,
            product:products(name)
          `)
          .in('worker_id', workerIds)
          .order('consumed_at', { ascending: false });
          
        if (consError) throw consError;
        
        console.log('Consumos encontrados:', consumptions?.length || 0);
        
        if (consumptions && consumptions.length > 0) {
          const pending = consumptions.filter((c: any) => c.status === 'pending');
          const paid = consumptions.filter((c: any) => c.status === 'paid');
          
          // Calcular deuda por trabajador
          const debtsByWorker = pending.reduce((acc: any, c: any) => {
            const worker = workers.find(w => w.id === c.worker_id);
            const workerName = worker?.full_name || 'Desconocido';
            acc[workerName] = (acc[workerName] || 0) + c.total;
            return acc;
          }, {});
          
          const byWorkerData = Object.entries(debtsByWorker)
            .map(([name, debt]: [string, any]) => ({ name, debt }))
            .sort((a: any, b: any) => b.debt - a.debt);
          
          setConsumptionData({
            totalDebt: pending.reduce((sum, c) => sum + c.total, 0),
            workersWithDebt: Object.keys(debtsByWorker).length,
            totalConsumptions: consumptions.length,
            pendingCount: pending.length,
            paidCount: paid.length,
            byWorker: byWorkerData,
            recentConsumptions: consumptions.slice(0, 20).map((c: any) => ({
              ...c,
              worker_name: workers.find(w => w.id === c.worker_id)?.full_name || 'Desconocido',
              product_name: c.product?.name || 'Producto desconocido'
            }))
          });
        } else {
          // No hay consumos, establecer datos vacíos
          setConsumptionData({
            totalDebt: 0,
            workersWithDebt: 0,
            totalConsumptions: 0,
            pendingCount: 0,
            paidCount: 0,
            byWorker: [],
            recentConsumptions: []
          });
        }
      }
    } catch (error: any) {
      console.error('Error loading report:', error);
      toast({ 
        title: 'Error', 
        description: error.message || 'No se pudieron cargar los datos', 
        variant: 'destructive' 
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleExport = async () => {
    if (!selectedBranch?.id) return;
    setIsExporting(true);
    
    try {
      const response = await fetch(`/api/reports/export?branchId=${selectedBranch.id}`);
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Error al generar reporte');
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Reporte_Completo_${selectedBranch.name}_${format(new Date(), 'yyyy-MM-dd')}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      toast({ title: 'Éxito', description: 'Reporte exportado correctamente' });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setIsExporting(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-EC', {
      style: 'currency',
      currency: 'USD'
    }).format(amount || 0);
  };

  const renderSalesReport = () => {
    if (!salesData) return null;
    
    const pieData = Object.entries(salesData.paymentMethods || {}).map(([name, value]: [string, any]) => ({
      name: name === 'cash' ? 'Efectivo' : name === 'card' ? 'Tarjeta' : name === 'transfer' ? 'Transferencia' : name,
      value: value || 0
    }));

    if (salesData.count === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-12 text-gray-500">
          <Info className="h-12 w-12 mb-4 text-gray-300" />
          <p>No hay ventas registradas en este período</p>
        </div>
      );
    }
    
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Ventas Totales</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(salesData.total)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Transacciones</CardTitle>
              <ShoppingCart className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{salesData.count}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Ticket Promedio</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(salesData.averageTicket)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Período</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{dateRange === 'week' ? '7 días' : dateRange === 'today' ? 'Hoy' : '30 días'}</div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="col-span-1">
            <CardHeader>
              <CardTitle>Tendencia de Ventas</CardTitle>
            </CardHeader>
            <CardContent className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={salesData.chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip formatter={(value: number) => formatCurrency(value)} />
                  <Area 
                    type="monotone" 
                    dataKey="total" 
                    stroke="#3B82F6" 
                    fill="#3B82F6" 
                    fillOpacity={0.3} 
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="col-span-1">
            <CardHeader>
              <CardTitle>Ventas por Método de Pago</CardTitle>
            </CardHeader>
            <CardContent className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => formatCurrency(value)} />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  };

  const renderInventoryReport = () => {
    if (!inventoryData) return null;

    const typeData = Object.entries(inventoryData.byType || {}).map(([type, count]) => ({ 
      name: `Tipo ${type}`, 
      value: count 
    }));

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Productos</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{inventoryData.totalProducts}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Stock Bajo</CardTitle>
              <AlertCircle className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">{inventoryData.lowStock}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Sin Stock</CardTitle>
              <AlertCircle className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{inventoryData.outOfStock}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Valor Inventario</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(inventoryData.totalValue)}</div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Distribución por Tipo</CardTitle>
            </CardHeader>
            <CardContent className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={typeData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, value }) => `${name}: ${value}`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {typeData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Productos con Mayor Stock</CardTitle>
            </CardHeader>
            <CardContent className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={inventoryData.topStock}
                  layout="vertical"
                  margin={{ top: 5, right: 30, left: 100, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis 
                    dataKey="name" 
                    type="category" 
                    width={150}
                    tick={{ fontSize: 11 }}
                  />
                  <Tooltip />
                  <Bar dataKey="stock" fill="#3B82F6" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  };

  const renderConsumptionReport = () => {
    if (!consumptionData) {
      return (
        <div className="flex items-center justify-center py-12">
          <p className="text-gray-500">Cargando datos de consumo...</p>
        </div>
      );
    }

    // Si no hay consumos, mostrar mensaje
    if (consumptionData.totalConsumptions === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-12 text-gray-500">
          <Coffee className="h-16 w-16 mb-4 text-gray-300" />
          <h3 className="text-lg font-semibold mb-2">No hay consumos registrados</h3>
          <p>Esta sucursal no tiene registros de consumo interno en el período seleccionado.</p>
        </div>
      );
    }

    const statusData = [
      { name: 'Pendiente', value: consumptionData.pendingCount || 0 },
      { name: 'Pagado', value: consumptionData.paidCount || 0 }
    ];

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Deuda Total</CardTitle>
              <DollarSign className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                {formatCurrency(consumptionData.totalDebt)}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Trabajadores con Deuda</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{consumptionData.workersWithDebt}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Consumos</CardTitle>
              <Coffee className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{consumptionData.totalConsumptions}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Promedio por Deuda</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {consumptionData.workersWithDebt > 0 
                  ? formatCurrency(consumptionData.totalDebt / consumptionData.workersWithDebt)
                  : formatCurrency(0)}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Deudas por Trabajador</CardTitle>
            </CardHeader>
            <CardContent className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={consumptionData.byWorker || []}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis />
                  <Tooltip formatter={(value: number) => formatCurrency(value)} />
                  <Bar dataKey="debt" fill="#EF4444" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Estado de Consumos</CardTitle>
            </CardHeader>
            <CardContent className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, value }) => `${name}: ${value}`}
                    outerRadius={80}
                    dataKey="value"
                  >
                    <Cell fill="#EF4444" />
                    <Cell fill="#10B981" />
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {consumptionData.recentConsumptions && consumptionData.recentConsumptions.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Últimos Consumos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-gray-50">
                      <th className="text-left p-2">Fecha</th>
                      <th className="text-left p-2">Trabajador</th>
                      <th className="text-left p-2">Producto</th>
                      <th className="text-center p-2">Cantidad</th>
                      <th className="text-right p-2">Total</th>
                      <th className="text-center p-2">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {consumptionData.recentConsumptions.map((cons: any) => (
                      <tr key={cons.id} className="border-b hover:bg-gray-50">
                        <td className="p-2">{format(parseISO(cons.consumed_at), 'dd/MM/yyyy HH:mm')}</td>
                        <td className="p-2 font-medium">{cons.worker_name}</td>
                        <td className="p-2">{cons.product_name}</td>
                        <td className="p-2 text-center">{cons.quantity}</td>
                        <td className="p-2 text-right">{formatCurrency(cons.total)}</td>
                        <td className="p-2 text-center">
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                            cons.status === 'pending' ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
                          }`}>
                            {cons.status === 'pending' ? 'Pendiente' : 'Pagado'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    );
  };

  const renderOrdersReport = () => (
    <div className="flex flex-col items-center justify-center py-20 text-gray-500">
      <Wrench className="h-16 w-16 mb-4 text-gray-300" />
      <h3 className="text-lg font-semibold">Módulo en Desarrollo</h3>
      <p>El reporte de órdenes de trabajo estará disponible próximamente.</p>
    </div>
  );

  if (!selectedBranch) {
    return (
      <div className="container mx-auto p-6">
        <h1 className="text-3xl font-bold mb-4">Reportes</h1>
        <div className="flex items-center justify-center h-64 text-gray-500">
          <Loader2 className="h-8 w-8 animate-spin mr-2" />
          Cargando sucursal...
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Reportes</h1>
          <p className="text-gray-500 mt-1">Análisis de {selectedBranch.name}</p>
        </div>
        
        <Button 
          onClick={handleExport} 
          disabled={isExporting} 
          className="bg-blue-600 hover:bg-blue-700"
        >
          {isExporting ? (
            <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Generando...</>
          ) : (
            <><Download className="mr-2 h-4 w-4" />Exportar Excel</>
          )}
        </Button>
      </div>

      <Card>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div className="space-y-2">
              <label className="text-sm font-medium">Tipo de Reporte</label>
              <Select value={reportType} onValueChange={(v: ReportType) => setReportType(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="sales"><div className="flex items-center"><ShoppingCart className="mr-2 h-4 w-4" />Ventas POS</div></SelectItem>
                  <SelectItem value="inventory"><div className="flex items-center"><Package className="mr-2 h-4 w-4" />Inventario</div></SelectItem>
                  <SelectItem value="internal_consumption"><div className="flex items-center"><Coffee className="mr-2 h-4 w-4" />Consumo Interno</div></SelectItem>
                  <SelectItem value="orders"><div className="flex items-center"><Wrench className="mr-2 h-4 w-4" />Órdenes</div></SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Rango de Fechas</label>
              <Select value={dateRange} onValueChange={(v: DateRange) => setDateRange(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">Hoy</SelectItem>
                  <SelectItem value="week">Últimos 7 días</SelectItem>
                  <SelectItem value="month">Últimos 30 días</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button variant="outline" onClick={loadReportData} disabled={isLoading}>
              <Filter className="mr-2 h-4 w-4" />
              {isLoading ? 'Cargando...' : 'Aplicar Filtros'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      ) : (
        <>
          {reportType === 'sales' && renderSalesReport()}
          {reportType === 'inventory' && renderInventoryReport()}
          {reportType === 'internal_consumption' && renderConsumptionReport()}
          {reportType === 'orders' && renderOrdersReport()}
        </>
      )}
    </div>
  );
}