'use client';

import { useMemo, useState, useEffect } from 'react';
import {
  DollarSign,
  ShoppingCart,
  Package,
  TrendingUp,
  AlertTriangle,
  Loader2,
  UserX,
  Coffee,
  Users,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useBranchStore } from '@/store/useBranchStore';
import { getDashboardStats, getSalesByDay } from '@/lib/actions/dashboard';
import { getProducts } from '@/lib/actions/products';
import { getWorkerDebtSummary } from '@/lib/actions/consumptions';
import {
  formatCurrency,
  getStockStatusColor,
  getProductTypeColor,
  getProductTypeLabel,
} from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { Product } from '@/types/database';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

interface ChartData {
  date: string;
  ventas: number;
}

export default function CashierDashboard() {
  const { selectedBranch } = useBranchStore();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalSales: 0,
    transactionCount: 0,
    lowStockCount: 0,
    outOfStockCount: 0,
    criticalStock: [] as Product[],
  });
  const [products, setProducts] = useState<Product[]>([]);
  const [chartData, setChartData] = useState<ChartData[]>([]);
  const [debtSummary, setDebtSummary] = useState<any[]>([]);

  useEffect(() => {
    async function loadDashboard() {
      if (!selectedBranch) return;

      try {
        setLoading(true);
        const [dashboardData, productsData, salesData, debtsData] = await Promise.all([
          getDashboardStats(selectedBranch.id),
          getProducts(selectedBranch.id),
          getSalesByDay(selectedBranch.id, 7),
          getWorkerDebtSummary(selectedBranch.id),
        ]);

        setStats(dashboardData);
        setProducts(productsData);
        setChartData(salesData);
        setDebtSummary(debtsData);
      } catch (error: any) {
        toast({
          title: 'Error',
          description: 'No se pudieron cargar los datos del dashboard',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    }

    loadDashboard();
  }, [selectedBranch]);

  const criticalStock = useMemo(() => {
    return products
      .filter((p) => p.stock < p.min_stock || p.stock === 0)
      .sort((a, b) => a.stock - b.stock)
      .slice(0, 10);
  }, [products]);

  const totalDebtAmount = useMemo(() => {
    return debtSummary.reduce((sum, d) => sum + (d.total_debt || 0), 0);
  }, [debtSummary]);

  if (loading) {
    return (
      <div className="h-[calc(100vh-8rem)] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          <p className="text-gray-500">Cargando dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Dashboard - {selectedBranch?.name || 'Sucursal'}
        </h1>
        <p className="text-gray-500">Resumen del dia</p>
      </div>

      {/* Stats Cards - VENTAS */}
      <div>
        <h2 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
          <ShoppingCart className="h-5 w-5 text-blue-600" />
          Ventas POS
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">
                Ventas Hoy
              </CardTitle>
              <DollarSign className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatCurrency(stats.totalSales)}
              </div>
              <p className="text-xs text-gray-500">Total del dia</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">
                Transacciones
              </CardTitle>
              <ShoppingCart className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.transactionCount}</div>
              <p className="text-xs text-gray-500">Ventas realizadas</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">
                Stock Bajo
              </CardTitle>
              <TrendingUp className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.lowStockCount}</div>
              <p className="text-xs text-gray-500">Productos por reponer</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">
                Sin Stock
              </CardTitle>
              <Package className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.outOfStockCount}</div>
              <p className="text-xs text-gray-500">Productos agotados</p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Stats Cards - CONSUMO INTERNO */}
      <div>
        <h2 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
          <Coffee className="h-5 w-5 text-orange-600" />
          Consumo Interno (Mini Tienda)
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="border-orange-200 bg-orange-50/50">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-orange-800">
                Deuda Total Pendiente
              </CardTitle>
              <UserX className="h-4 w-4 text-orange-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-900">
                {formatCurrency(totalDebtAmount)}
              </div>
              <p className="text-xs text-orange-700">
                {debtSummary.length} trabajadores deben
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">
                Total Consumos Hoy
              </CardTitle>
              <Coffee className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">
                {debtSummary.reduce((sum, d) => sum + d.pending_count, 0)}
              </div>
              <p className="text-xs text-gray-500">Consumos registrados</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">
                Promedio por Deuda
              </CardTitle>
              <Users className="h-4 w-4 text-purple-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600">
                {debtSummary.length > 0 
                  ? formatCurrency(totalDebtAmount / debtSummary.length)
                  : formatCurrency(0)
                }
              </div>
              <p className="text-xs text-gray-500">Por trabajador</p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Chart and Critical Stock */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sales Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Ventas Ultimos 7 Dias</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip
                    formatter={(value: number) => formatCurrency(value)}
                  />
                  <Line
                    type="monotone"
                    dataKey="ventas"
                    stroke="#3b82f6"
                    strokeWidth={2}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Critical Stock */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              Stock Critico
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Producto</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Stock</TableHead>
                    <TableHead>Minimo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {criticalStock.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={4}
                        className="text-center text-gray-500"
                      >
                        No hay productos con stock critico
                      </TableCell>
                    </TableRow>
                  ) : (
                    criticalStock.map((product) => (
                      <TableRow key={product.id}>
                        <TableCell className="font-medium">
                          {product.name}
                        </TableCell>
                        <TableCell>
                          <Badge
                            className={`${getProductTypeColor(
                              product.type
                            )} text-white`}
                          >
                            {getProductTypeLabel(product.type)}
                          </Badge>
                        </TableCell>
                        <TableCell
                          className={getStockStatusColor(
                            product.stock,
                            product.min_stock
                          )}
                        >
                          {product.stock}
                        </TableCell>
                        <TableCell>{product.min_stock}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top Deudores */}
      {debtSummary.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-orange-800">
              <UserX className="h-5 w-5" />
              Top Deudores - Consumo Interno
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {debtSummary.slice(0, 4).map((debt) => (
                <div key={debt.worker_id} className="p-4 border rounded-lg bg-orange-50/30 hover:bg-orange-50 transition-colors cursor-pointer">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium text-gray-900">{debt.full_name}</p>
                      <p className="text-sm text-gray-500">{debt.pending_count} consumos</p>
                    </div>
                    <span className="font-bold text-orange-600 text-lg">
                      {formatCurrency(debt.total_debt)}
                    </span>
                  </div>
                  <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-orange-500 h-2 rounded-full" 
                      style={{ width: `${Math.min((debt.total_debt / totalDebtAmount) * 100, 100)}%` }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}