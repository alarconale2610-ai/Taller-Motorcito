'use server';

import { createClient } from '@/lib/supabase-server';
import { Product } from '@/types/database';

interface DashboardStats {
  totalSales: number;
  transactionCount: number;
  lowStockCount: number;
  outOfStockCount: number;
  criticalStock: Product[];
}

export async function getDashboardStats(branchId: string): Promise<DashboardStats> {
  const supabase = await createClient();

  // Obtener fecha de hoy en zona horaria local (Ecuador)
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // Ventas de HOY únicamente
  const { data: todaySales, error: salesError } = await supabase
    .from('sales')
    .select('total')
    .eq('branch_id', branchId)
    .gte('created_at', today.toISOString())
    .lt('created_at', tomorrow.toISOString())
    .eq('status', 'completed'); // Solo ventas completadas

  if (salesError) throw new Error('Error al obtener ventas: ' + salesError.message);

  // Productos con stock crítico (bajo o agotado) - SOLO 10
  const { data: criticalStock, error: stockError } = await supabase
    .from('products')
    .select('*')
    .eq('branch_id', branchId)
    .eq('is_active', true)
    .lt('stock', 10)  // Stock menor a 10
    .order('stock', { ascending: true })
    .limit(10);

  if (stockError) throw new Error('Error al obtener productos: ' + stockError.message);

  // Calcular métricas
  const totalSales = todaySales?.reduce((sum, s) => sum + (s.total || 0), 0) || 0;
  const transactionCount = todaySales?.length || 0;
  
  // Separar conteos
  const lowStockCount = criticalStock?.filter(p => p.stock > 0 && p.stock < p.min_stock).length || 0;
  const outOfStockCount = criticalStock?.filter(p => p.stock === 0).length || 0;

  return {
    totalSales,
    transactionCount,
    lowStockCount,
    outOfStockCount,
    criticalStock: criticalStock || [],
  };
}

export async function getSalesReport(branchId: string, days: number = 7) {
  const supabase = await createClient();

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  startDate.setHours(0, 0, 0, 0);

  const { data, error } = await supabase
    .from('sales')
    .select('total, created_at')
    .eq('branch_id', branchId)
    .gte('created_at', startDate.toISOString())
    .eq('status', 'completed')  // Solo completadas
    .order('created_at', { ascending: false });

  if (error) throw new Error('Error al obtener reporte: ' + error.message);
  return data || [];
}

// Ventas por día para el gráfico (últimos 7 días)
export async function getSalesByDay(branchId: string, days: number = 7) {
  const supabase = await createClient();

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - (days - 1));
  startDate.setHours(0, 0, 0, 0);

  const { data, error } = await supabase
    .from('sales')
    .select('total, created_at')
    .eq('branch_id', branchId)
    .gte('created_at', startDate.toISOString())
    .eq('status', 'completed')  // Solo ventas completadas
    .order('created_at', { ascending: true });

  if (error) throw new Error('Error al obtener ventas por día: ' + error.message);

  // Agrupar por fecha
  const grouped = new Map<string, number>();

  data?.forEach((sale) => {
    const date = new Date(sale.created_at).toISOString().split('T')[0];
    const current = grouped.get(date) || 0;
    grouped.set(date, current + (sale.total || 0));
  });

  // Convertir a array y llenar días faltantes
  const result = [];
  for (let i = 0; i < days; i++) {
    const d = new Date();
    d.setDate(d.getDate() - (days - 1 - i));
    d.setHours(0, 0, 0, 0);
    const dateStr = d.toISOString().split('T')[0];
    const displayDate = dateStr.slice(5); // MM-DD

    result.push({
      date: displayDate,
      ventas: grouped.get(dateStr) || 0,
    });
  }

  return result;
}