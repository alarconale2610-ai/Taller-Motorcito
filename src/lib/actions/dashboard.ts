'use server';

import { createClient } from '@/lib/supabase-server';

export async function getDashboardStats(branchId: string) {
  const supabase = await createClient();

  // Ventas de hoy
  const today = new Date().toISOString().split('T')[0];
  const { data: todaySales, error: salesError } = await supabase
    .from('sales')
    .select('total')
    .eq('branch_id', branchId)
    .gte('created_at', today)
    .lt('created_at', today + 'T23:59:59');

  if (salesError) throw new Error('Error al obtener ventas: ' + salesError.message);

  // Productos con stock bajo
  const { data: lowStockProducts, error: stockError } = await supabase
    .from('products')
    .select('*')
    .eq('branch_id', branchId)
    .lt('stock', 10)
    .order('stock', { ascending: true })
    .limit(10);

  if (stockError) throw new Error('Error al obtener productos: ' + stockError.message);

  const totalSales = todaySales?.reduce((sum, s) => sum + (s.total || 0), 0) || 0;
  const transactionCount = todaySales?.length || 0;
  const lowStockCount = lowStockProducts?.filter(p => p.stock > 0).length || 0;
  const outOfStockCount = lowStockProducts?.filter(p => p.stock === 0).length || 0;

  return {
    totalSales,
    transactionCount,
    lowStockCount,
    outOfStockCount,
    criticalStock: lowStockProducts || [],
  };
}

export async function getSalesReport(branchId: string, days: number = 7) {
  const supabase = await createClient();

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const { data, error } = await supabase
    .from('sales')
    .select('*')
    .eq('branch_id', branchId)
    .gte('created_at', startDate.toISOString())
    .order('created_at', { ascending: false });

  if (error) throw new Error('Error al obtener reporte: ' + error.message);
  return data || [];
}

// Nueva funcion para obtener ventas por dia para la grafica
export async function getSalesByDay(branchId: string, days: number = 7) {
  const supabase = await createClient();
  
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  const { data, error } = await supabase
    .from('sales')
    .select('total, created_at')
    .eq('branch_id', branchId)
    .gte('created_at', startDate.toISOString())
    .order('created_at', { ascending: true });
  
  if (error) throw new Error('Error al obtener ventas por dia: ' + error.message);
  
  // Agrupar por fecha
  const grouped = new Map<string, number>();
  
  data?.forEach((sale) => {
    const date = new Date(sale.created_at).toISOString().split('T')[0];
    const current = grouped.get(date) || 0;
    grouped.set(date, current + (sale.total || 0));
  });
  
  // Convertir a array y llenar dias faltantes
  const result = [];
  for (let i = 0; i < days; i++) {
    const d = new Date();
    d.setDate(d.getDate() - (days - 1 - i));
    const dateStr = d.toISOString().split('T')[0];
    const displayDate = dateStr.slice(5); // MM-DD
    
    result.push({
      date: displayDate,
      ventas: grouped.get(dateStr) || 0,
    });
  }
  
  return result;
}
