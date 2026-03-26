'use server';

import { createClient } from '@/lib/supabase-server';

export async function saveInvoiceHTML(invoiceId: string, htmlContent: string): Promise<string> {
  console.log('💾 Server Action: Guardando HTML...');
  console.log('  - invoiceId:', invoiceId);
  console.log('  - htmlContent length:', htmlContent?.length);
  
  const supabase = await createClient();
  
  // Limpiar registros anteriores del mismo invoice
  await supabase
    .from('invoice_html_temp')
    .delete()
    .eq('invoice_id', invoiceId);
  
  // Insertar nuevo
  const { data, error } = await supabase
    .from('invoice_html_temp')
    .insert({
      invoice_id: invoiceId,
      html_content: htmlContent,
      expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString()
    })
    .select('id')
    .single();
  
  if (error) {
    console.error('❌ Error guardando HTML:', error);
    throw new Error('Error guardando HTML: ' + error.message);
  }
  
  if (!data || !data.id) {
    console.error('❌ No se retornó ID');
    throw new Error('No se pudo obtener el ID del registro');
  }
  
  console.log('✅ HTML guardado, ID:', data.id);
  return data.id; // Retornar explícitamente el string
}

export async function getInvoiceHTML(tempId: string) {
  const supabase = await createClient();
  
  const { data, error } = await supabase
    .from('invoice_html_temp')
    .select('html_content, invoice_id')
    .eq('id', tempId)
    .single();
  
  if (error || !data) throw new Error('HTML no encontrado o expirado');
  
  return data;
}

export async function deleteInvoiceHTML(tempId: string) {
  const supabase = await createClient();
  
  await supabase
    .from('invoice_html_temp')
    .delete()
    .eq('id', tempId);
}