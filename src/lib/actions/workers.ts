'use server';

import { createClient } from '@/lib/supabase-server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { Worker } from '@/types/database';
import { revalidatePath } from 'next/cache';



// Cliente con service role para crear usuarios (solo admin)
const supabaseAdmin = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function getWorkers(branchId: string): Promise<Worker[]> {
  if (!branchId) throw new Error('Branch ID requerido');

  const supabase = await createClient();
  
  const { data, error } = await supabase
    .from('workers')
    .select('*')
    .eq('branch_id', branchId)
    .order('full_name');
  
  if (error) {
    console.error('Error fetching workers:', error);
    throw new Error('Error al cargar trabajadores: ' + error.message);
  }
  
  return data || [];
}

export async function createWorker(data: {
  full_name: string;
  phone?: string;
  role: 'mecanico' | 'electricista' | 'ayudante' | 'otro';
  is_active: boolean;
  branch_id: string;
  email?: string;
  password?: string;
  create_user?: boolean;
  

}): Promise<Worker> {
  const supabase = await createClient();
  
  // Validar duplicados por nombre en la misma sucursal
  const { data: existing } = await supabase
    .from('workers')
    .select('id')
    .eq('branch_id', data.branch_id)
    .ilike('full_name', data.full_name.trim())
    .maybeSingle();
  
  if (existing) {
    throw new Error('Ya existe un trabajador con ese nombre en esta sucursal');
  }

  // 1. Crear trabajador primero
  const { data: worker, error: workerError } = await supabase
    .from('workers')
    .insert([{
      full_name: data.full_name.trim(),
      phone: data.phone?.trim() || null,
      role: data.role,
      is_active: data.is_active,
      branch_id: data.branch_id,
      email: data.email || null,
    }])
    .select()
    .single();

  if (workerError) {
    console.error('Error creating worker:', workerError);
    throw new Error('Error al crear trabajador: ' + workerError.message);
  }

  // 2. Si se solicitó crear usuario de sistema
  if (data.create_user && data.email && data.password) {
    try {
      // Determinar rol del sistema basado en el rol del trabajador
      const systemRole = data.role === 'otro' ? 'cashier' : 'mechanic';
      
      // Crear usuario en Supabase Auth
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: data.email,
        password: data.password,
        email_confirm: true,
        user_metadata: {
          full_name: data.full_name,
          role: systemRole,
          branch_id: data.branch_id,
        }
      });

      if (authError) {
        // Si falla la creación del usuario, eliminar el trabajador
        await supabase.from('workers').delete().eq('id', worker.id);
        throw new Error('Error al crear usuario: ' + authError.message);
      }

      // Actualizar worker con el user_id
      await supabase
        .from('workers')
        .update({ user_id: authData.user.id })
        .eq('id', worker.id);

      worker.user_id = authData.user.id;

    } catch (error: any) {
      throw new Error('Error creando usuario del sistema: ' + error.message);
    }
  }
  
  revalidatePath('/workers');
  return worker;
}

export async function updateWorker(id: string, data: Partial<Worker>): Promise<Worker> {
  const supabase = await createClient();
  
  const { data: updatedWorker, error } = await supabase
    .from('workers')
    .update({
      ...data,
      full_name: data.full_name?.trim(),
      phone: data.phone?.trim() || null,
    })
    .eq('id', id)
    .select()
    .single();
  
  if (error) {
    console.error('Error updating worker:', error);
    throw new Error('Error al actualizar trabajador: ' + error.message);
  }
  
  revalidatePath('/workers');
  return updatedWorker;
}

export async function deleteWorker(id: string): Promise<void> {
  const supabase = await createClient();
  
  // Obtener worker para ver si tiene usuario asociado
  const { data: worker } = await supabase
    .from('workers')
    .select('user_id')
    .eq('id', id)
    .single();
  
  // Verificar si tiene consumos pendientes
  const { data: pendingConsumptions } = await supabase
    .from('worker_consumptions')
    .select('id')
    .eq('worker_id', id)
    .eq('status', 'pending')
    .limit(1);
  
  if (pendingConsumptions && pendingConsumptions.length > 0) {
    throw new Error('No se puede eliminar: el trabajador tiene consumos pendientes por pagar');
  }

  const { error } = await supabase
    .from('workers')
    .delete()
    .eq('id', id);
  
  if (error) {
    console.error('Error deleting worker:', error);
    throw new Error('Error al eliminar trabajador: ' + error.message);
  }
  
  // Si tenía usuario de sistema, eliminarlo también
  if (worker?.user_id) {
    try {
      await supabaseAdmin.auth.admin.deleteUser(worker.user_id);
    } catch (e) {
      console.error('Error eliminando usuario auth:', e);
    }
  }
  
  revalidatePath('/workers');
}

export async function toggleWorkerStatus(id: string, isActive: boolean): Promise<void> {
  const supabase = await createClient();
  
  const { error } = await supabase
    .from('workers')
    .update({ is_active: isActive })
    .eq('id', id);
  
  if (error) {
    throw new Error('Error al cambiar estado: ' + error.message);
  }
  
  revalidatePath('/workers');
}

