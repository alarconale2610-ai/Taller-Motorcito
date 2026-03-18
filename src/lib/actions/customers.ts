'use server';

import { createClient } from '@/lib/supabase-server';
import { Customer, Vehicle } from '@/types/database';
import { revalidatePath } from 'next/cache';

// ============ CUSTOMERS ============

export async function getCustomers(branchId: string): Promise<Customer[]> {
  if (!branchId) throw new Error('Branch ID requerido');

  const supabase = await createClient();
  
  const { data, error } = await supabase
    .from('customers')
    .select(`
      *,
      vehicles(*)
    `)
    .eq('branch_id', branchId)
    .order('name');
  
  if (error) {
    console.error('Error fetching customers:', error);
    throw new Error('Error al cargar clientes: ' + error.message);
  }
  
  return data || [];
}

export async function getCustomerById(customerId: string): Promise<Customer | null> {
  const supabase = await createClient();
  
  const { data, error } = await supabase
    .from('customers')
    .select(`
      *,
      vehicles(*)
    `)
    .eq('id', customerId)
    .single();
  
  if (error) {
    console.error('Error fetching customer:', error);
    throw new Error('Error al cargar cliente: ' + error.message);
  }
  
  return data;
}

export async function createCustomer(data: Omit<Customer, 'id' | 'vehicles' | 'total_spent'>): Promise<Customer> {
  const supabase = await createClient();
  
  // Validar duplicado por telefono o email en misma sucursal
  if (data.phone) {
    const { data: existing } = await supabase
      .from('customers')
      .select('id')
      .eq('branch_id', data.branch_id)
      .eq('phone', data.phone.trim())
      .maybeSingle();
    
    if (existing) {
      throw new Error('Ya existe un cliente con ese telefono en esta sucursal');
    }
  }

  const { data: newCustomer, error } = await supabase
    .from('customers')
    .insert({
      ...data,
      name: data.name.trim(),
      phone: data.phone?.trim() || null,
      email: data.email?.trim().toLowerCase() || null,
      total_spent: 0,
    })
    .select()
    .single();
  
  if (error) {
    console.error('Error creating customer:', error);
    throw new Error('Error al crear cliente: ' + error.message);
  }
  
  revalidatePath('/customers');
  return { ...newCustomer, vehicles: [] };
}

export async function updateCustomer(id: string, data: Partial<Customer>): Promise<Customer> {
  const supabase = await createClient();
  
  const { data: updatedCustomer, error } = await supabase
    .from('customers')
    .update({
      ...data,
      name: data.name?.trim(),
      phone: data.phone?.trim(),
      email: data.email?.trim().toLowerCase(),
    })
    .eq('id', id)
    .select()
    .single();
  
  if (error) {
    console.error('Error updating customer:', error);
    throw new Error('Error al actualizar cliente: ' + error.message);
  }
  
  revalidatePath('/customers');
  return updatedCustomer;
}

export async function deleteCustomer(id: string): Promise<void> {
  const supabase = await createClient();
  
  // Verificar si tiene ordenes de trabajo
  const { data: workOrders } = await supabase
    .from('work_orders')
    .select('id')
    .eq('customer_id', id)
    .limit(1);
  
  if (workOrders && workOrders.length > 0) {
    throw new Error('No se puede eliminar: el cliente tiene ordenes de trabajo asociadas');
  }

  // Eliminar vehiculos primero (cascade manual)
  await supabase.from('vehicles').delete().eq('customer_id', id);
  
  const { error } = await supabase
    .from('customers')
    .delete()
    .eq('id', id);
  
  if (error) {
    console.error('Error deleting customer:', error);
    throw new Error('Error al eliminar cliente: ' + error.message);
  }
  
  revalidatePath('/customers');
}

// ============ VEHICLES ============

export async function getVehiclesByCustomer(customerId: string): Promise<Vehicle[]> {
  const supabase = await createClient();
  
  const { data, error } = await supabase
    .from('vehicles')
    .select('*')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false });
  
  if (error) {
    console.error('Error fetching vehicles:', error);
    throw new Error('Error al cargar vehiculos: ' + error.message);
  }
  
  return data || [];
}

export async function createVehicle(data: Omit<Vehicle, 'id'>): Promise<Vehicle> {
  const supabase = await createClient();
  
  // Validar placa unica
  const { data: existing } = await supabase
    .from('vehicles')
    .select('id')
    .ilike('plate', data.plate.trim())
    .maybeSingle();
  
  if (existing) {
    throw new Error('Ya existe un vehiculo con esa placa');
  }

  const { data: newVehicle, error } = await supabase
    .from('vehicles')
    .insert({
      ...data,
      plate: data.plate.trim().toUpperCase(),
      brand: data.brand.trim(),
      model: data.model.trim(),
      color: data.color?.trim(),
    })
    .select()
    .single();
  
  if (error) {
    console.error('Error creating vehicle:', error);
    throw new Error('Error al crear vehiculo: ' + error.message);
  }
  
  revalidatePath('/customers');
  return newVehicle;
}

export async function updateVehicle(id: string, data: Partial<Vehicle>): Promise<Vehicle> {
  const supabase = await createClient();
  
  const { data: updatedVehicle, error } = await supabase
    .from('vehicles')
    .update({
      ...data,
      plate: data.plate?.trim().toUpperCase(),
      brand: data.brand?.trim(),
      model: data.model?.trim(),
      color: data.color?.trim(),
    })
    .eq('id', id)
    .select()
    .single();
  
  if (error) {
    console.error('Error updating vehicle:', error);
    throw new Error('Error al actualizar vehiculo: ' + error.message);
  }
  
  revalidatePath('/customers');
  return updatedVehicle;
}

export async function deleteVehicle(id: string): Promise<void> {
  const supabase = await createClient();
  
  // Verificar si esta en ordenes de trabajo
  const { data: workOrders } = await supabase
    .from('work_orders')
    .select('id')
    .eq('vehicle_id', id)
    .limit(1);
  
  if (workOrders && workOrders.length > 0) {
    throw new Error('No se puede eliminar: el vehiculo tiene ordenes de trabajo asociadas');
  }

  const { error } = await supabase
    .from('vehicles')
    .delete()
    .eq('id', id);
  
  if (error) {
    console.error('Error deleting vehicle:', error);
    throw new Error('Error al eliminar vehiculo: ' + error.message);
  }
  
  revalidatePath('/customers');
}
