'use server';

import { createClient } from '@/lib/supabase-server';
import { revalidatePath } from 'next/cache';

interface ImportProduct {
  barcode?: string;
  name: string;
  description?: string;
  type: 'A' | 'B' | 'C' | 'D';
  cost_price: number;
  sale_price: number;
  stock: number;
  min_stock: number;
  unit: string;
}

export async function importProducts(
  branchId: string,
  products: ImportProduct[]
): Promise<{ success: number; errors: string[] }> {
  const supabase = await createClient();

  try {
    // IMPORTANTE: Pasar el array directamente, NO hacer JSON.stringify
    const { data, error } = await supabase.rpc('import_products_batch', {
      p_branch_id: branchId,
      p_products: products  // <-- Quitar JSON.stringify, pasar array directo
    });

    if (error) {
      throw new Error(error.message);
    }

    const result = data?.[0] || { success_count: 0, error_messages: [] };
    
    if (result.success_count > 0) {
      revalidatePath('/inventory');
    }

    return {
      success: result.success_count,
      errors: result.error_messages || []
    };
    
  } catch (error: any) {
    console.error('Error en importación:', error);
    return {
      success: 0,
      errors: [error.message || 'Error desconocido en la importación']
    };
  }
}