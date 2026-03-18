'use server';

import { createClient } from '@/lib/supabase-server';
import { WorkOrder, WorkOrderItem } from '@/types/database';
import { revalidatePath } from 'next/cache';

export async function getWorkOrders(branchId: string): Promise<WorkOrder[]> {
  if (!branchId) throw new Error('Branch ID requerido');

  const supabase = await createClient();
  
  const { data, error } = await supabase
    .from('work_orders')
    .select(`
      *,
      customer:customers(name, phone),
      vehicle:vehicles(plate, brand, model),
      mechanic:workers(full_name)
    `)
    .eq('branch_id', branchId)
    .order('created_at', { ascending: false });
  
  if (error) {
    console.error('Error fetching work orders:', error);
    throw new Error('Error al cargar ordenes de trabajo: ' + error.message);
  }
  
  return data || [];
}

export async function getWorkOrderById(id: string): Promise<WorkOrder | null> {
  const supabase = await createClient();
  
  const { data, error } = await supabase
    .from('work_orders')
    .select(`
      *,
      customer:customers(*),
      vehicle:vehicles(*),
      mechanic:workers(*)
    `)
    .eq('id', id)
    .single();
  
  if (error) {
    console.error('Error fetching work order:', error);
    throw new Error('Error al cargar orden de trabajo: ' + error.message);
  }
  
  return data;
}

export async function getWorkOrderItems(workOrderId: string): Promise<WorkOrderItem[]> {
  const supabase = await createClient();
  
  const { data, error } = await supabase
    .from('work_order_items')
    .select(`
      *,
      product:products(name, type, unit)
    `)
    .eq('work_order_id', workOrderId)
    .order('created_at');
  
  if (error) {
    throw new Error('Error al cargar items: ' + error.message);
  }
  
  return data || [];
}

export async function createWorkOrder(
  data: Omit<WorkOrder, 'id' | 'created_at' | 'completed_at'>
): Promise<WorkOrder> {
  const supabase = await createClient();
  
  const { data: newOrder, error } = await supabase
    .from('work_orders')
    .insert({
      ...data,
      created_at: new Date().toISOString(),
      status: 'pending',
    })
    .select()
    .single();
  
  if (error) {
    console.error('Error creating work order:', error);
    throw new Error('Error al crear orden de trabajo: ' + error.message);
  }
  
  revalidatePath('/work-orders');
  return newOrder;
}

export async function addWorkOrderItem(
  data: Omit<WorkOrderItem, 'id' | 'created_at' | 'total_price'>
): Promise<WorkOrderItem> {
  const supabase = await createClient();
  
  const total_price = data.quantity * data.unit_price;
  
  const { data: newItem, error } = await supabase
    .from('work_order_items')
    .insert({
      ...data,
      total_price,
    })
    .select()
    .single();
  
  if (error) {
    throw new Error('Error al agregar item: ' + error.message);
  }
  
  // Si es producto, descontar del stock (solo cuando se complete la orden, no aquí)
  revalidatePath('/work-orders');
  return newItem;
}

export async function removeWorkOrderItem(itemId: string): Promise<void> {
  const supabase = await createClient();
  
  const { error } = await supabase
    .from('work_order_items')
    .delete()
    .eq('id', itemId);
  
  if (error) {
    throw new Error('Error al eliminar item: ' + error.message);
  }
  
  revalidatePath('/work-orders');
}

export async function updateWorkOrder(
  id: string, 
  data: Partial<WorkOrder>
): Promise<WorkOrder> {
  const supabase = await createClient();
  
  const updateData: Partial<WorkOrder> = { ...data };
  
  if (data.status === 'completed') {
    updateData.completed_at = new Date().toISOString();
    
    // Descontar stock de los productos usados
    await deductStockFromOrder(id);
  }
  
  if (data.status && data.status !== 'completed' && data.status !== 'delivered') {
    updateData.completed_at = undefined;
  }

  const { data: updatedOrder, error } = await supabase
    .from('work_orders')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();
  
  if (error) {
    console.error('Error updating work order:', error);
    throw new Error('Error al actualizar orden de trabajo: ' + error.message);
  }
  
  revalidatePath('/work-orders');
  return updatedOrder;
}

// Función para descontar stock cuando se completa la orden
async function deductStockFromOrder(orderId: string): Promise<void> {
  const supabase = await createClient();
  
  // Obtener items de la orden
  const { data: items } = await supabase
    .from('work_order_items')
    .select('product_id, quantity, is_product')
    .eq('work_order_id', orderId);
  
  if (!items) return;
  
  // Descontar stock de cada producto
  for (const item of items) {
    if (item.is_product && item.product_id) {
      // Obtener stock actual
      const { data: product } = await supabase
        .from('products')
        .select('stock, branch_id')
        .eq('id', item.product_id)
        .single();
      
      if (product) {
        await supabase
          .from('products')
          .update({ stock: Math.max(0, product.stock - item.quantity) })
          .eq('id', item.product_id);
      }
    }
  }
}

export async function assignMechanic(
  orderId: string, 
  mechanicId: string
): Promise<void> {
  const supabase = await createClient();
  
  const { data: mechanic } = await supabase
    .from('workers')
    .select('id, is_active')
    .eq('id', mechanicId)
    .single();
  
  if (!mechanic) throw new Error('Mecanico no encontrado');
  if (!mechanic.is_active) throw new Error('El mecanico esta inactivo');

  const { error } = await supabase
    .from('work_orders')
    .update({ mechanic_id: mechanicId })
    .eq('id', orderId);
  
  if (error) throw new Error('Error al asignar mecanico: ' + error.message);
  
  revalidatePath('/work-orders');
}

export async function deleteWorkOrder(id: string): Promise<void> {
  const supabase = await createClient();
  
  const { data: order } = await supabase
    .from('work_orders')
    .select('status')
    .eq('id', id)
    .single();
  
  if (!order) throw new Error('Orden no encontrada');
  if (order.status !== 'pending') throw new Error('Solo se pueden eliminar ordenes pendientes');

  const { error } = await supabase
    .from('work_orders')
    .delete()
    .eq('id', id);
  
  if (error) throw new Error('Error al eliminar: ' + error.message);
  
  revalidatePath('/work-orders');
}