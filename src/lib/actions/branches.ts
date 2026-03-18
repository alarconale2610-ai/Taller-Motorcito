'use server';

import { createClient } from '@/lib/supabase-server';
import { Branch } from '@/types/database';

export async function getBranches(): Promise<Branch[]> {
  const supabase = await createClient();
  
  const { data, error } = await supabase
    .from('branches')
    .select('*')
    .eq('is_active', true)
    .order('name');

  if (error) throw new Error('Error al obtener sucursales: ' + error.message);
  return data || [];
  
}

export async function getBranchConfig(branchId: string): Promise<BranchConfig | null> {
  const supabase = await createClient();
  
  const { data, error } = await supabase
    .from('branch_config')
    .select('*')
    .eq('branch_id', branchId)
    .single();
    
  if (error) {
    console.error('Error fetching branch config:', error);
    return null;
  }
  
  return data;
}

export async function updateBranchConfig(
  branchId: string, 
  data: Partial<BranchConfig>,
  userRole: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  
  // Verificación de seguridad: solo admins pueden editar
  if (userRole !== 'admin') {
    return { success: false, error: 'No tiene permisos para editar la configuración' };
  }
  
  const { error } = await supabase
    .from('branch_config')
    .update({
      ...data,
      updated_at: new Date().toISOString()
    })
    .eq('branch_id', branchId);
    
  if (error) {
    console.error('Error updating branch config:', error);
    return { success: false, error: error.message };
  }
  
  return { success: true };
}