'use server';

import { createClient } from '@/lib/supabase-server';
import { Profile, Branch } from '@/types/database';

export async function login(email: string, password: string): Promise<{ profile: Profile; branch: Branch }> {
  console.log('=== LOGIN DEBUG ===');
  console.log('Email:', email);
  
  const supabase = await createClient();
  
  // Paso 1: Autenticar
  console.log('Intentando autenticar...');
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (authError) {
    console.log('Error de autenticacion:', authError.message);
    throw new Error('Credenciales invalidas');
  }
  
  if (!authData.user) {
    console.log('No se recibio usuario despues de autenticar');
    throw new Error('Credenciales invalidas');
  }

  console.log('Autenticacion exitosa. User ID:', authData.user.id);

  // Paso 2: Buscar perfil
  console.log('Buscando perfil en tabla profiles...');
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', authData.user.id)
    .single();

  if (profileError || !profile) {
    console.log('Error al buscar perfil:', profileError?.message);
    await supabase.auth.signOut();
    throw new Error('Perfil no encontrado. Contacte al administrador.');
  }

  console.log('Perfil encontrado:', profile);

  if (!profile.is_active) {
    console.log('Usuario inactivo');
    await supabase.auth.signOut();
    throw new Error('Usuario inactivo. Contacte al administrador.');
  }

  // Paso 3: Obtener sucursal automáticamente del perfil
  if (!profile.branch_id) {
    console.log('Usuario sin sucursal asignada');
    await supabase.auth.signOut();
    throw new Error('Usuario sin sucursal asignada. Contacte al administrador.');
  }

  const { data: branch, error: branchError } = await supabase
    .from('branches')
    .select('*')
    .eq('id', profile.branch_id)
    .single();

  if (branchError || !branch) {
    console.log('Error al obtener sucursal:', branchError?.message);
    await supabase.auth.signOut();
    throw new Error('Sucursal no encontrada.');
  }

  console.log('Login exitoso. Sucursal:', branch.name);
  return { profile, branch };
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
}

export async function getCurrentUser(): Promise<Profile | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
  return profile;
}