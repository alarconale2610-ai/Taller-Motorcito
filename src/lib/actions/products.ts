'use server';

import { createClient } from '@/lib/supabase-server';
import { Product } from '@/types/database';
import { revalidatePath } from 'next/cache';

export async function getProducts(branchId: string): Promise<Product[]> {
  console.log('=== GET PRODUCTS DEBUG ===');
  console.log('BranchId recibido:', branchId);

  const supabase = await createClient();

  console.log('Ejecutando query...');
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('branch_id', branchId)
    .eq('is_active', true)
    .order('name');

  console.log('Resultado:', {
    dataLength: data?.length,
    error: error?.message,
    firstProduct: data?.[0]
  });

  if (error) {
    console.log('Error en query:', error);
    throw new Error('Error al obtener productos: ' + error.message);
  }

  console.log('Productos encontrados:', data?.length || 0);
  return data || [];
}

export async function getAllProducts(branchId: string): Promise<Product[]> {
  const supabase = await createClient();
  
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('branch_id', branchId)
    .order('name');
  
  if (error) {
    throw new Error('Error al obtener productos: ' + error.message);
  }
  
  return data || [];
}

export async function getProductById(id: string): Promise<Product | null> {
  const supabase = await createClient();
  
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('id', id)
    .single();
  
  if (error) {
    throw new Error('Error al obtener producto: ' + error.message);
  }
  
  return data;
}

export async function createProduct(data: Omit<Product, 'id' | 'created_at'>): Promise<Product> {
  const supabase = await createClient();
  
  // Validar codigo de barras unico si se proporciona
  if (data.barcode) {
    const { data: existing } = await supabase
      .from('products')
      .select('id')
      .eq('barcode', data.barcode)
      .eq('branch_id', data.branch_id)
      .maybeSingle();
    
    if (existing) {
      throw new Error('Ya existe un producto con ese codigo de barras');
    }
  }

  const { data: newProduct, error } = await supabase
    .from('products')
    .insert({
      ...data,
      name: data.name.trim(),
      barcode: data.barcode?.trim() || null,
      description: data.description?.trim() || null,
    })
    .select()
    .single();
  
  if (error) {
    console.error('Error creating product:', error);
    throw new Error('Error al crear producto: ' + error.message);
  }
  
  revalidatePath('/inventory');
  return newProduct;
}

export async function updateProduct(id: string, data: Partial<Product>): Promise<Product> {
  const supabase = await createClient();
  
  const { data: updatedProduct, error } = await supabase
    .from('products')
    .update({
      ...data,
      name: data.name?.trim(),
      barcode: data.barcode?.trim(),
      description: data.description?.trim(),
    })
    .eq('id', id)
    .select()
    .single();
  
  if (error) {
    console.error('Error updating product:', error);
    throw new Error('Error al actualizar producto: ' + error.message);
  }
  
  revalidatePath('/inventory');
  return updatedProduct;
}

export async function deleteProduct(id: string): Promise<void> {
  const supabase = await createClient();
  
  // Soft delete - marcar como inactivo en lugar de eliminar
  const { error } = await supabase
    .from('products')
    .update({ is_active: false })
    .eq('id', id);
  
  if (error) {
    console.error('Error deleting product:', error);
    throw new Error('Error al eliminar producto: ' + error.message);
  }
  
  revalidatePath('/inventory');
}

export async function updateStock(id: string, newStock: number): Promise<void> {
  const supabase = await createClient();
  
  const { error } = await supabase
    .from('products')
    .update({ stock: newStock })
    .eq('id', id);
  
  if (error) {
    throw new Error('Error al actualizar stock: ' + error.message);
  }
  
  revalidatePath('/inventory');
}
