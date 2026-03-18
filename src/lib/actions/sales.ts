'use server';

import { createClient } from '@/lib/supabase-server';
import { Sale } from '@/types/database';

export async function getSales(branchId: string, date?: string): Promise<Sale[]> {
  const supabase = await createClient();

  let query = supabase
    .from('sales')
    .select('*, items:sale_items(*)')
    .eq('branch_id', branchId)
    .order('created_at', { ascending: false });

  if (date) {
    query = query.gte('created_at', date).lt('created_at', date + 'T23:59:59');
  }

  const { data, error } = await query;
  if (error) throw new Error('Error al obtener ventas: ' + error.message);
  return data || [];
}

export async function createSale(data: {
  branch_id: string;
  user_id: string;
  customer_name: string;
  customer_ruc?: string;
  items: Array<{
    product_id: string;
    product_name: string;
    product_type: string;
    quantity: number;
    unit_price: number;
    total: number;
  }>;
  payment_method: 'cash' | 'card' | 'transfer' | 'credit';
  subtotal: number;
  iva_amount: number;
  total: number;
}): Promise<{ saleId: string; documentNumber: string }> {
  const supabase = await createClient();

  try {
    // 1. Obtener configuración de la sucursal
    const { data: branchConfig, error: configError } = await supabase
      .from('branch_config')
      .select('establishment_code, emission_point, iva_percent')
      .eq('branch_id', data.branch_id)
      .single();

    if (configError || !branchConfig) {
      throw new Error('Error al obtener configuración de sucursal: ' + configError?.message);
    }

    // 2. Generar número de documento único
    const { data: documentNumber, error: docError } = await supabase.rpc(
      'get_next_document_number',
      {
        p_branch_id: data.branch_id,
        p_document_type: 'nota_venta',
        p_establishment_code: branchConfig.establishment_code || '001',
        p_emission_point: branchConfig.emission_point || '001'
      }
    );

    if (docError || !documentNumber) {
      throw new Error('Error al generar número de documento: ' + docError?.message);
    }

    // 3. Crear venta completa con función atómica (incluye stock)
    // IMPORTANTE: Pasar items directamente como array, no como JSON.stringify
    const { data: saleId, error: saleError } = await supabase.rpc(
      'create_sale_complete',
      {
        p_branch_id: data.branch_id,
        p_user_id: data.user_id,
        p_customer_name: data.customer_name,
        p_customer_ruc: data.customer_ruc || null,
        p_payment_method: data.payment_method,
        p_subtotal: data.subtotal,
        p_iva_amount: data.iva_amount,
        p_total: data.total,
        p_document_number: documentNumber,
        p_items: data.items  // <-- SIN JSON.stringify()
      }
    );

    if (saleError || !saleId) {
      throw new Error('Error al procesar venta: ' + saleError?.message);
    }

    return { saleId, documentNumber };
  } catch (error: any) {
    console.error('Error en createSale:', error);
    throw error;
  }
}

export async function cancelSale(saleId: string, reason: string, userId: string): Promise<void> {
  const supabase = await createClient();

  const { error } = await supabase
    .from('sales')
    .update({
      status: 'cancelled',
      cancelled_at: new Date().toISOString(),
      cancelled_by: userId,
      cancellation_reason: reason
    })
    .eq('id', saleId);

  if (error) throw new Error('Error al cancelar venta: ' + error.message);
}