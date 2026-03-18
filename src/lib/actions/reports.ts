'use server';

import { createClient } from '@/lib/supabase-server';

export async function getSalesReport(branchId: string, days: number = 7) {
  const supabase = await createClient();
  
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  // Obtener ventas del período
  const { data: sales, error } = await supabase
    .from('sales')
    .select('*')
    .eq('branch_id', branchId)
    .gte('created_at', startDate.toISOString())
    .order('created_at', { ascending: true });
    
  if (error) throw new Error('Error al cargar ventas: ' + error.message);
  
  // Calcular métricas
  const totalSales = sales?.reduce((sum, s) => sum + s.total, 0) || 0;
  const transactionCount = sales?.length || 0;
  const averageTicket = transactionCount > 0 ? totalSales / transactionCount : 0;
  
  // Agrupar por día
  const salesByDay = [];
  const groupedByDay = new Map();
  
  sales?.forEach((sale) => {
    const date = new Date(sale.created_at).toLocaleDateString('es-ES', {
      weekday: 'short',
      day: 'numeric',
    });
    
    if (!groupedByDay.has(date)) {
      groupedByDay.set(date, { amount: 0, transactions: 0 });
    }
    
    const current = groupedByDay.get(date);
    current.amount += sale.total;
    current.transactions += 1;
  });
  
  groupedByDay.forEach((value, key) => {
    salesByDay.push({ date: key, ...value });
  });
  
  // Agrupar por método de pago
  const paymentMethods = { cash: 0, card: 0, transfer: 0 };
  sales?.forEach((sale) => {
    if (paymentMethods.hasOwnProperty(sale.payment_method)) {
      paymentMethods[sale.payment_method as keyof typeof paymentMethods] += sale.total;
    }
  });
  
  const salesByPayment = [
    { name: 'Efectivo', value: paymentMethods.cash, color: '#22c55e' },
    { name: 'Tarjeta', value: paymentMethods.card, color: '#3b82f6' },
    { name: 'Transferencia', value: paymentMethods.transfer, color: '#f59e0b' },
  ].filter(p => p.value > 0);
  
  return {
    totalSales,
    transactionCount,
    averageTicket,
    salesByDay,
    salesByPayment,
  };
}