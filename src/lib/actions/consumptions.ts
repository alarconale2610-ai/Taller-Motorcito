'use server';

import { createClient } from '@/lib/supabase-server';
import { WorkerConsumption } from '@/types/database';
import { revalidatePath } from 'next/cache';

export async function getConsumptions(branchId: string): Promise<WorkerConsumption[]> {
  if (!branchId) throw new Error('Branch ID requerido');

  const supabase = await createClient();

  // Obtener IDs de trabajadores de esta sucursal primero
  const { data: workerIds, error: workerError } = await supabase
    .from('workers')
    .select('id')
    .eq('branch_id', branchId)
    .eq('is_active', true);

  if (workerError) {
    console.error('Error fetching workers:', workerError);
    throw new Error('Error al cargar trabajadores: ' + workerError.message);
  }

  if (!workerIds || workerIds.length === 0) {
    return []; // No hay trabajadores en esta sucursal
  }

  const ids = workerIds.map(w => w.id);

  // Obtener consumos solo de esos trabajadores
  const { data, error } = await supabase
    .from('worker_consumptions')
    .select(`
      *,
      worker:workers(full_name),
      product:products(name)
    `)
    .in('worker_id', ids)
    .order('consumed_at', { ascending: false });

  if (error) {
    console.error('Error fetching consumptions:', error);
    throw new Error('Error al cargar consumos: ' + error.message);
  }

  return data || [];
}

export async function getConsumptionsByWorker(workerId: string): Promise<WorkerConsumption[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('worker_consumptions')
    .select(`
      *,
      product:products(name)
    `)
    .eq('worker_id', workerId)
    .order('consumed_at', { ascending: false });

  if (error) {
    console.error('Error fetching worker consumptions:', error);
    throw new Error('Error al cargar consumos del trabajador: ' + error.message);
  }

  return data || [];
}

export async function getPendingConsumptions(branchId: string): Promise<WorkerConsumption[]> {
  const supabase = await createClient();

  // Obtener IDs de trabajadores de esta sucursal
  const { data: workerIds, error: workerError } = await supabase
    .from('workers')
    .select('id')
    .eq('branch_id', branchId)
    .eq('is_active', true);

  if (workerError) {
    throw new Error('Error al cargar trabajadores: ' + workerError.message);
  }

  if (!workerIds || workerIds.length === 0) {
    return [];
  }

  const ids = workerIds.map(w => w.id);

  const { data, error } = await supabase
    .from('worker_consumptions')
    .select(`
      *,
      worker:workers(full_name),
      product:products(name)
    `)
    .in('worker_id', ids)
    .eq('status', 'pending')
    .order('consumed_at', { ascending: false });

  if (error) {
    throw new Error('Error al cargar deudas: ' + error.message);
  }

  return data || [];
}

export async function getWorkerDebtSummary(branchId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('worker_debt_summary')
    .select('*')
    .eq('branch_id', branchId)
    .gt('total_debt', 0)
    .order('total_debt', { ascending: false });

  if (error) {
    throw new Error('Error al cargar resumen de deudas: ' + error.message);
  }

  return data || [];
}

export async function createConsumption(
  data: Omit<WorkerConsumption, 'id' | 'consumed_at' | 'paid_at' | 'user_id'>,
  userId?: string
): Promise<WorkerConsumption> {
  const supabase = await createClient();

  // Verificar stock del producto
  const { data: product, error: productError } = await supabase
    .from('products')
    .select('stock, name')
    .eq('id', data.product_id)
    .single();

  if (productError || !product) {
    throw new Error('Producto no encontrado');
  }

  if (product.stock < data.quantity) {
    throw new Error(`Stock insuficiente. Disponible: ${product.stock}, Solicitado: ${data.quantity}`);
  }

  // Crear consumo
  const { data: consumption, error: consumptionError } = await supabase
    .from('worker_consumptions')
    .insert({
      ...data,
      user_id: userId,
      consumed_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (consumptionError) {
    console.error('Error creating consumption:', consumptionError);
    throw new Error('Error al registrar consumo: ' + consumptionError.message);
  }

  // Descontar stock
  const { error: stockError } = await supabase
    .from('products')
    .update({ stock: product.stock - data.quantity })
    .eq('id', data.product_id);

  if (stockError) {
    // Rollback manual
    await supabase.from('worker_consumptions').delete().eq('id', consumption.id);
    throw new Error('Error al actualizar stock: ' + stockError.message);
  }

  revalidatePath('/internal-consumption');
  return consumption;
}

export async function payConsumption(
  id: string, 
  paymentMethod: 'cash' | 'transfer',
  referenceNumber?: string,
  partialAmount?: number
): Promise<void> {
  const supabase = await createClient();

  // Obtener consumo actual
  const { data: consumption, error: fetchError } = await supabase
    .from('worker_consumptions')
    .select('*')
    .eq('id', id)
    .single();

  if (fetchError || !consumption) {
    throw new Error('Consumo no encontrado');
  }

  if (consumption.status === 'paid') {
    throw new Error('Este consumo ya esta pagado');
  }

  // Verificar si es pago parcial
  const isPartialPayment = partialAmount && partialAmount > 0 && partialAmount < consumption.total;

  if (isPartialPayment) {
    const remaining = consumption.total - partialAmount;
    
    // 1. Actualizar el consumo original con el MONTO PAGADO (marcar como pagado)
    const { error: updateError } = await supabase
      .from('worker_consumptions')
      .update({
        total: partialAmount,
        status: 'paid',
        paid_at: new Date().toISOString(),
        payment_method: paymentMethod,
        reference_number: referenceNumber || null,
      })
      .eq('id', id);

    if (updateError) {
      throw new Error('Error al registrar pago parcial: ' + updateError.message);
    }

    // 2. Crear un NUEVO consumo con el monto RESTANTE (marcar como pendiente)
    const { error: createError } = await supabase
      .from('worker_consumptions')
      .insert({
        worker_id: consumption.worker_id,
        product_id: consumption.product_id,
        user_id: consumption.user_id,
        quantity: consumption.quantity,
        unit_price: consumption.unit_price,
        total: remaining,
        status: 'pending',
        notes: `Saldo pendiente de consumo #${id.slice(0,8)}. Pagó ${partialAmount} de ${consumption.total}`,
        consumed_at: consumption.consumed_at,
      });

    if (createError) {
      // Si falla la creación del nuevo registro, intentar revertir el original
      await supabase
        .from('worker_consumptions')
        .update({ 
          total: consumption.total, 
          status: 'pending', 
          paid_at: null,
          payment_method: null 
        })
        .eq('id', id);
        
      throw new Error('Error al crear registro de saldo pendiente: ' + createError.message);
    }

  } else {
    // PAGO COMPLETO
    const { error } = await supabase
      .from('worker_consumptions')
      .update({
        status: 'paid',
        paid_at: new Date().toISOString(),
        payment_method: paymentMethod,
        reference_number: referenceNumber || null,
      })
      .eq('id', id);

    if (error) {
      throw new Error('Error al registrar pago: ' + error.message);
    }
  }

  revalidatePath('/internal-consumption');
}

export async function payAllConsumptionsByWorker(
  workerId: string,
  paymentMethod: 'cash' | 'transfer',
  referenceNumber?: string
): Promise<number> {
  const supabase = await createClient();

  // Obtener total pendiente
  const { data: pending, error: fetchError } = await supabase
    .from('worker_consumptions')
    .select('total')
    .eq('worker_id', workerId)
    .eq('status', 'pending');

  if (fetchError) {
    throw new Error('Error al obtener deudas: ' + fetchError.message);
  }

  const totalPaid = pending?.reduce((sum, c) => sum + c.total, 0) || 0;

  const { error } = await supabase
    .from('worker_consumptions')
    .update({
      status: 'paid',
      paid_at: new Date().toISOString(),
      payment_method: paymentMethod,
      reference_number: referenceNumber || null,
    })
    .eq('worker_id', workerId)
    .eq('status', 'pending');

  if (error) {
    throw new Error('Error al pagar consumos: ' + error.message);
  }

  revalidatePath('/internal-consumption');
  return totalPaid;
}

export async function deleteConsumption(id: string): Promise<void> {
  const supabase = await createClient();

  const { data: consumption, error: fetchError } = await supabase
    .from('worker_consumptions')
    .select('status, product_id, quantity')
    .eq('id', id)
    .single();

  if (fetchError || !consumption) {
    throw new Error('Consumo no encontrado');
  }

  if (consumption.status === 'paid') {
    throw new Error('No se puede eliminar un consumo ya pagado');
  }

  // Devolver stock
  const { data: product } = await supabase
    .from('products')
    .select('stock')
    .eq('id', consumption.product_id)
    .single();

  if (product) {
    await supabase
      .from('products')
      .update({ stock: product.stock + consumption.quantity })
      .eq('id', consumption.product_id);
  }

  const { error } = await supabase
    .from('worker_consumptions')
    .delete()
    .eq('id', id);

  if (error) {
    throw new Error('Error al eliminar consumo: ' + error.message);
  }

  revalidatePath('/internal-consumption');
}