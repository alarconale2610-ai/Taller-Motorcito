'use server';

import { createClient } from '@/lib/supabase-server';
import { format } from 'date-fns';

export async function getNextDocumentNumber(
  branchId: string, 
  type: 'factura' | 'nota_venta'
): Promise<string> {
  const supabase = await createClient();
  
  // Obtener configuración de secuencia
  const { data: sequence, error } = await supabase
    .from('document_sequences')
    .select('*')
    .eq('branch_id', branchId)
    .eq('document_type', type)
    .eq('year', new Date().getFullYear())
    .single();
  
  if (error || !sequence) {
    // Si no existe, crear con número 1
    const { data: branch } = await supabase
      .from('branch_config')
      .select('establishment_code, emission_point')
      .eq('branch_id', branchId)
      .single();
    
    const estab = branch?.establishment_code || '001';
    const ptoEmi = branch?.emission_point || '001';
    
    await supabase.from('document_sequences').insert({
      branch_id: branchId,
      document_type: type,
      establishment_code: estab,
      emission_point: ptoEmi,
      current_number: 1,
      year: new Date().getFullYear(),
    });
    
    return `${estab}-${ptoEmi}-000000001`;
  }
  
  // Incrementar número
  const nextNum = sequence.current_number + 1;
  await supabase
    .from('document_sequences')
    .update({ current_number: nextNum })
    .eq('id', sequence.id);
  
  const secuencial = nextNum.toString().padStart(9, '0');
  return `${sequence.establishment_code}-${sequence.emission_point}-${secuencial}`;
}

export async function createDocument(data: {
  order_id: string;
  branch_id: string;
  document_type: string;
  document_number: string;
  total: number;
}) {
  const supabase = await createClient();
  
  const { error } = await supabase
    .from('sale_documents')
    .insert({
      ...data,
      created_at: new Date().toISOString(),
    });
  
  if (error) throw new Error('Error al guardar documento: ' + error.message);
}

export async function getDocumentByOrder(orderId: string) {
  const supabase = await createClient();
  
  const { data, error } = await supabase
    .from('sale_documents')
    .select('*')
    .eq('order_id', orderId)
    .order('created_at', { ascending: false });
  
  if (error) throw error;
  return data;
}