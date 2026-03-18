export interface Branch {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
}

export interface Profile {
  id: string;
  full_name: string;
  email: string;
  role: 'admin' | 'cashier' | 'mechanic';
  branch_id: string | null; // null = admin
}

export interface Product {
  id: string;
  branch_id: string;
  barcode: string | null;
  name: string;
  description?: string;
  type: 'A' | 'B' | 'C' | 'D';
  cost_price: number;
  sale_price: number;
  stock: number;
  min_stock: number;
  unit: string;
  is_active: boolean;
}

export interface CartItem {
  product_id: string;
  product_name: string;
  product_type: 'A' | 'B' | 'C' | 'D';
  quantity: number;
  unit_price: number;
  total: number;
}

export interface Sale {
  id: string;
  branch_id: string;
  user_id: string;
  customer_name: string;
  customer_id?: string;
  subtotal: number;
  iva_amount: number;
  total: number;
  payment_method: 'cash' | 'card' | 'transfer' | 'credit';
  status: 'completed' | 'cancelled' | 'refunded';
  created_at: string;
  items?: SaleItem[];
}

export interface SaleItem {
  id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  total: number;
}

export interface WorkOrder {
  id: string;
  branch_id: string;
  customer_id: string;
  vehicle_id: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'delivered';
  mechanic_id?: string;
  total: number;
  created_at: string;
  completed_at?: string;
}

export interface Customer {
  id: string;
  branch_id: string;
  name: string;
  phone?: string;
  email?: string;
  total_spent: number;
  vehicles: Vehicle[];
}

export interface Vehicle {
  id: string;
  customer_id: string;
  plate: string;
  brand: string;
  model: string;
  year?: number;
  color?: string;
  current_km: number;
}

export interface Worker {
  id: string;
  branch_id: string;
  full_name: string;
  phone?: string;
  role: 'mecanico' | 'electricista' | 'ayudante' | 'otro';
  is_active: boolean;
}

export interface WorkerConsumption {
  id: string;
  worker_id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  total: number;
  status: 'pending' | 'paid';
  consumed_at: string;
  paid_at?: string;
  notes?: string;
}
export interface BranchConfig {
  id: string;
  branch_id: string;
  business_name: string;
  ruc: string;
  company_name: string;
  company_ruc: string;
  company_address: string;
  company_phone: string;
  company_email: string;
  establishment_code: string;
  emission_point: string;
  iva_percent: number;
  receipt_header?: string;
  receipt_footer?: string;
}

export interface DocumentSequence {
  id: string;
  branch_id: string;
  document_type: 'nota_venta' | 'factura';
  establishment_code: string;
  emission_point: string;
  current_number: number;
  year: number;
}

// Actualizar Sale para incluir documentos
export interface Sale {
  id: string;
  branch_id: string;
  user_id: string;
  customer_name: string;
  customer_id?: string;
  customer_ruc?: string;
  subtotal: number;
  iva_amount: number;
  total: number;
  payment_method: 'cash' | 'card' | 'transfer' | 'credit';
  status: 'completed' | 'cancelled' | 'refunded';
  document_number?: string;
  document_type?: string;
  created_at: string;
  items?: SaleItem[];
}

export interface Worker {
  id: string;
  branch_id: string;
  full_name: string;
  phone?: string;
  role: 'mecanico' | 'electricista' | 'ayudante' | 'otro';
  is_active: boolean;
  email?: string;          // Nuevo
  user_id?: string;        // Nuevo
  created_at?: string;
  updated_at?: string;
}

export interface WorkOrderItem {
  id: string;
  work_order_id: string;
  product_id?: string;
  description: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  is_product: boolean;
  created_at: string;
  product?: Product; // Para joins
}