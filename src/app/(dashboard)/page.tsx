'use client';

import { useMemo, useState, useEffect } from 'react';
import { motion, useSpring, useTransform, AnimatePresence, Variants } from 'framer-motion';
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
  TrendingDown,
  Activity,
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
import { getWorkerDebtSummary, getTodayConsumptionsCount } from '@/lib/actions/consumptions';
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

interface DashboardStats {
  totalSales: number;
  transactionCount: number;
  lowStockCount: number;
  outOfStockCount: number;
  criticalStock: Product[];
}

// Componente para números animados suavemente
function AnimatedNumber({ value, prefix = '', suffix = '' }: { value: number; prefix?: string; suffix?: string }) {
  const spring = useSpring(value, { mass: 0.5, stiffness: 60, damping: 20 });
  const display = useTransform(spring, (current) => 
    `${prefix}${Math.round(current).toLocaleString()}${suffix}`
  );
  
  useEffect(() => {
    spring.set(value);
  }, [spring, value]);

  return <motion.span>{display}</motion.span>;
}

// Variantes de animación suaves y consistentes
const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.1,
    },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 10 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.4,
      ease: [0.4, 0, 0.2, 1], // ease-out suave
    },
  },
};

// Configuración de colores SUAVES y ELEGANTES (sin saturación alta)
const cardConfigs = {
  sales: {
    bg: 'bg-slate-50',
    border: 'border-slate-200',
    accent: 'text-slate-700',
    iconBg: 'bg-slate-200',
    iconColor: 'text-slate-600',
    label: 'Ventas Hoy',
    subtext: 'Total del día',
  },
  transactions: {
    bg: 'bg-stone-50',
    border: 'border-stone-200',
    accent: 'text-stone-700',
    iconBg: 'bg-stone-200',
    iconColor: 'text-stone-600',
    label: 'Transacciones',
    subtext: 'Ventas realizadas hoy',
  },
  lowStock: {
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    accent: 'text-amber-700',
    iconBg: 'bg-amber-100',
    iconColor: 'text-amber-600',
    label: 'Stock Bajo',
    subtext: 'Productos por reponer',
  },
  outOfStock: {
    bg: 'bg-red-50',
    border: 'border-red-200',
    accent: 'text-red-700',
    iconBg: 'bg-red-100',
    iconColor: 'text-red-600',
    label: 'Sin Stock',
    subtext: 'Productos agotados',
  },
  debt: {
    bg: 'bg-orange-50',
    border: 'border-orange-200',
    accent: 'text-orange-700',
    iconBg: 'bg-orange-100',
    iconColor: 'text-orange-600',
    label: 'Deuda Total',
    subtext: 'Trabajadores deben',
  },
  consumptions: {
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    accent: 'text-blue-700',
    iconBg: 'bg-blue-100',
    iconColor: 'text-blue-600',
    label: 'Consumos Hoy',
    subtext: 'Registrados hoy',
  },
  average: {
    bg: 'bg-indigo-50',
    border: 'border-indigo-200',
    accent: 'text-indigo-700',
    iconBg: 'bg-indigo-100',
    iconColor: 'text-indigo-600',
    label: 'Promedio por Deuda',
    subtext: 'Por trabajador',
  },
};

// Componente de Stat Card con animación suave
interface AnimatedStatCardProps {
  type: keyof typeof cardConfigs;
  value: number;
  icon: React.ReactNode;
  prefix?: string;
  suffix?: string;
  delay?: number;
}

function AnimatedStatCard({ type, value, icon, prefix = '', suffix = '', delay = 0 }: AnimatedStatCardProps) {
  const config = cardConfigs[type];
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.4,
        delay: delay,
        ease: [0.4, 0, 0.2, 1],
      }}
      whileHover={{ 
        y: -4, 
        transition: { duration: 0.2 }
      }}
      className="group cursor-pointer"
    >
      <Card className={`${config.bg} ${config.border} border shadow-sm hover:shadow-md transition-shadow duration-300`}>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className={`text-sm font-medium ${config.accent}`}>
            {config.label}
          </CardTitle>
          <div className={`${config.iconBg} p-2 rounded-lg transition-transform duration-300 group-hover:scale-110`}>
            <div className={config.iconColor}>{icon}</div>
          </div>
        </CardHeader>
        <CardContent>
          <div className={`text-2xl font-bold ${config.accent}`}>
            <AnimatedNumber value={value} prefix={prefix} suffix={suffix} />
          </div>
          <p className="text-xs text-gray-500 mt-1">
            {config.subtext}
          </p>
        </CardContent>
      </Card>
    </motion.div>
  );
}

export default function CashierDashboard() {
  const { selectedBranch } = useBranchStore();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats>({
    totalSales: 0,
    transactionCount: 0,
    lowStockCount: 0,
    outOfStockCount: 0,
    criticalStock: [],
  });
  const [chartData, setChartData] = useState<ChartData[]>([]);
  const [debtSummary, setDebtSummary] = useState<any[]>([]);
  const [todayConsumptionsCount, setTodayConsumptionsCount] = useState(0);

  useEffect(() => {
    async function loadDashboard() {
      if (!selectedBranch) return;

      try {
        setLoading(true);
        const [dashboardData, salesData, debtsData, todayConsumptions] = await Promise.all([
          getDashboardStats(selectedBranch.id),
          getSalesByDay(selectedBranch.id, 7),
          getWorkerDebtSummary(selectedBranch.id),
          getTodayConsumptionsCount(selectedBranch.id),
        ]);

        setStats(dashboardData);
        setChartData(salesData);
        setDebtSummary(debtsData);
        setTodayConsumptionsCount(todayConsumptions);
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

  const totalDebtAmount = useMemo(() => {
    return debtSummary.reduce((sum, d) => sum + (d.total_debt || 0), 0);
  }, [debtSummary]);

  if (loading) {
    return (
      <div className="h-[calc(100vh-8rem)] flex items-center justify-center">
        <motion.div 
          className="flex flex-col items-center gap-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
        >
          <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
          <p className="text-gray-400">Cargando dashboard...</p>
        </motion.div>
      </div>
    );
  }

  return (
    <motion.div 
      className="space-y-6"
      initial="hidden"
      animate="visible"
      variants={containerVariants}
    >
      {/* Header */}
      <motion.div variants={itemVariants}>
        <h1 className="text-2xl font-bold text-gray-800">
          Dashboard - {selectedBranch?.branch_config?.business_name || selectedBranch?.name || 'Sucursal'}
        </h1>
        <p className="text-gray-500 text-sm mt-1">Resumen del día</p>
      </motion.div>

      {/* Stats Cards - VENTAS */}
      <motion.div variants={itemVariants}>
        <h2 className="text-base font-medium text-gray-700 mb-3 flex items-center gap-2">
          <ShoppingCart className="h-4 w-4 text-slate-500" />
          Ventas POS
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <AnimatedStatCard
            type="sales"
            value={stats.totalSales}
            icon={<DollarSign className="h-4 w-4" />}
            prefix="$"
            delay={0}
          />
          <AnimatedStatCard
            type="transactions"
            value={stats.transactionCount}
            icon={<ShoppingCart className="h-4 w-4" />}
            delay={0.05}
          />
          <AnimatedStatCard
            type="lowStock"
            value={stats.lowStockCount}
            icon={<TrendingUp className="h-4 w-4" />}
            delay={0.1}
          />
          <AnimatedStatCard
            type="outOfStock"
            value={stats.outOfStockCount}
            icon={<Package className="h-4 w-4" />}
            delay={0.15}
          />
        </div>
      </motion.div>

      {/* Stats Cards - CONSUMO INTERNO */}
      <motion.div variants={itemVariants}>
        <h2 className="text-base font-medium text-gray-700 mb-3 flex items-center gap-2">
          <Coffee className="h-4 w-4 text-slate-500" />
          Consumo Interno (Mini Tienda)
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <AnimatedStatCard
            type="debt"
            value={totalDebtAmount}
            icon={<UserX className="h-4 w-4" />}
            prefix="$"
            delay={0.2}
          />
          <AnimatedStatCard
            type="consumptions"
            value={todayConsumptionsCount}
            icon={<Coffee className="h-4 w-4" />}
            delay={0.25}
          />
          <AnimatedStatCard
            type="average"
            value={debtSummary.length > 0 ? totalDebtAmount / debtSummary.length : 0}
            icon={<Users className="h-4 w-4" />}
            prefix="$"
            delay={0.3}
          />
        </div>
      </motion.div>

      {/* Chart and Critical Stock */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sales Chart */}
        <motion.div variants={itemVariants}>
          <Card className="border border-gray-200 shadow-sm bg-white">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base font-medium text-gray-700">
                <Activity className="h-4 w-4 text-slate-500" />
                Ventas Últimos 7 Días
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <defs>
                      <linearGradient id="colorVentas" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#64748b" stopOpacity={0.1}/>
                        <stop offset="95%" stopColor="#64748b" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis 
                      dataKey="date" 
                      stroke="#94a3b8" 
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis 
                      stroke="#94a3b8" 
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(value) => `$${value}`}
                    />
                    <Tooltip
                      formatter={(value: number) => formatCurrency(value)}
                      contentStyle={{ 
                        backgroundColor: 'rgba(255, 255, 255, 0.95)', 
                        borderRadius: '6px',
                        border: '1px solid #e2e8f0',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                        fontSize: '12px'
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="ventas"
                      stroke="#64748b"
                      strokeWidth={2}
                      dot={{ fill: '#64748b', r: 3, strokeWidth: 0 }}
                      activeDot={{ r: 5, fill: '#475569' }}
                      animationDuration={1000}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Critical Stock */}
        <motion.div variants={itemVariants}>
          <Card className="border border-gray-200 shadow-sm bg-white">
            <CardHeader className="flex flex-row items-center justify-between pb-2 bg-red-50/50 border-b border-red-100">
              <CardTitle className="flex items-center gap-2 text-base font-medium text-red-800">
                <AlertTriangle className="h-4 w-4 text-red-500" />
                Stock Crítico
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50/50 hover:bg-slate-50/50">
                      <TableHead className="text-xs font-medium text-gray-500">Producto</TableHead>
                      <TableHead className="text-xs font-medium text-gray-500">Tipo</TableHead>
                      <TableHead className="text-xs font-medium text-gray-500">Stock</TableHead>
                      <TableHead className="text-xs font-medium text-gray-500">Mínimo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stats.criticalStock.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={4}
                          className="text-center text-gray-400 py-8 text-sm"
                        >
                          <div className="flex flex-col items-center gap-2">
                            <Package className="h-8 w-8 text-gray-300" />
                            <p>No hay productos con stock crítico</p>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      stats.criticalStock.map((product, index) => (
                        <motion.tr
                          key={product.id}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: 0.4 + index * 0.03 }}
                          className="hover:bg-slate-50/50 transition-colors border-b border-gray-50 last:border-0"
                        >
                          <TableCell className="font-medium text-sm text-gray-700 py-3">
                            {product.name}
                          </TableCell>
                          <TableCell>
                            <Badge
                              className={`${getProductTypeColor(product.type)} text-white text-xs font-normal shadow-none`}
                            >
                              {getProductTypeLabel(product.type)}
                            </Badge>
                          </TableCell>
                          <TableCell
                            className={`text-sm font-semibold ${getStockStatusColor(product.stock, product.min_stock)}`}
                          >
                            {product.stock === 0 ? (
                              <span className="text-red-600">Agotado</span>
                            ) : (
                              product.stock
                            )}
                          </TableCell>
                          <TableCell className="text-sm text-gray-500">{product.min_stock}</TableCell>
                        </motion.tr>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Top Deudores */}
      <AnimatePresence>
        {debtSummary.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
          >
            <Card className="border border-gray-200 shadow-sm bg-white">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base font-medium text-orange-800">
                  <UserX className="h-4 w-4" />
                  Top Deudores - Consumo Interno
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                  {debtSummary.slice(0, 4).map((debt, index) => (
                    <motion.div
                      key={debt.worker_id}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.5 + index * 0.05, duration: 0.3 }}
                      whileHover={{ 
                        scale: 1.02,
                        transition: { duration: 0.15 }
                      }}
                      className="p-3 border border-orange-100 rounded-lg bg-orange-50/30 hover:bg-orange-50/60 transition-colors cursor-pointer"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <p className="font-medium text-sm text-gray-800">{debt.full_name}</p>
                          <p className="text-xs text-gray-500">{debt.pending_count} consumos</p>
                        </div>
                        <span className="font-bold text-orange-700 text-sm">
                          {formatCurrency(debt.total_debt)}
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-1.5">
                        <motion.div
                          className="bg-orange-400 h-1.5 rounded-full"
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.min((debt.total_debt / totalDebtAmount) * 100, 100)}%` }}
                          transition={{ delay: 0.6 + index * 0.05, duration: 0.5 }}
                        />
                      </div>
                    </motion.div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}