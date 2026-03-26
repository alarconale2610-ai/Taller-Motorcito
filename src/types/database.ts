// src/types/database.ts - CORREGIDO Y LIMPIO

export interface Branch {
  id: string;
  name: string;
  address: string | null;
  config?: BranchConfig;
  business_name?: string;
  phone: string | null;
  branch_config?: {
    business_name: string;
  } | null;
  is_active?: boolean;  // ✅ AGREGADO (lo usa PublicThemeLoader)
  created_at?: string;  // ✅ AGREGADO (lo usa PublicThemeLoader)
}

export interface Profile {
  id: string;
  full_name: string;
  email: string;
  role: 'admin' | 'cashier' | 'mechanic';
  branch_id: string | null;
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

export interface SaleItem {
  id: string;
  sale_id?: string;
  product_id: string;
  product_name: string;
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
  vehicles?: Vehicle[];
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
  email?: string;
  user_id?: string;
  created_at?: string;
  updated_at?: string;
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
  payment_method?: 'cash' | 'transfer' | 'card';
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
  primary_color?: string;
  sidebar_color?: string;
  logo_text?: string;
  logo_subtitle?: string;
  logo_url?: string;
  logo_base64?: string;
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
  product?: Product;
}

export interface InvoiceHtmlTemp {
  id: string;
  invoice_id: string;
  html_content: string;
  created_at: string;
  expires_at: string;
}

export interface EmailLog {
  id?: string;
  invoice_id: string;
  recipient: string;
  subject: string;
  message_id?: string;
  sent_by: string;
  status: 'sent' | 'failed' | 'pending';
  sent_at: string;
  error_message?: string;
}

// Database type ÚNICO Y COMPLETO
export type Database = {
  public: {
    Tables: {
      branches: {
        Row: Branch;
        Insert: Partial<Branch>;
        Update: Partial<Branch>;
      };
      products: {
        Row: Product;
        Insert: Partial<Product>;
        Update: Partial<Product>;
      };
      sales: {
        Row: Sale;
        Insert: Partial<Sale>;
        Update: Partial<Sale>;
      };
      sale_items: {
        Row: SaleItem;
        Insert: Partial<SaleItem>;
        Update: Partial<SaleItem>;
      };
      workers: {
        Row: Worker;
        Insert: Partial<Worker>;
        Update: Partial<Worker>;
      };
      worker_consumptions: {
        Row: WorkerConsumption;
        Insert: Partial<WorkerConsumption>;
        Update: Partial<WorkerConsumption>;
      };
      work_orders: {
        Row: WorkOrder;
        Insert: Partial<WorkOrder>;
        Update: Partial<WorkOrder>;
      };
      customers: {
        Row: Customer;
        Insert: Partial<Customer>;
        Update: Partial<Customer>;
      };
      vehicles: {
        Row: Vehicle;
        Insert: Partial<Vehicle>;
        Update: Partial<Vehicle>;
      };
      branch_config: {
        Row: BranchConfig;
        Insert: Partial<BranchConfig>;
        Update: Partial<BranchConfig>;
      };
      document_sequences: {
        Row: DocumentSequence;
        Insert: Partial<DocumentSequence>;
        Update: Partial<DocumentSequence>;
      };
      work_order_items: {
        Row: WorkOrderItem;
        Insert: Partial<WorkOrderItem>;
        Update: Partial<WorkOrderItem>;
      };
      invoice_html_temp: {
        Row: InvoiceHtmlTemp;
        Insert: Partial<InvoiceHtmlTemp>;
        Update: Partial<InvoiceHtmlTemp>;
      };
      email_logs: {
        Row: EmailLog;
        Insert: Partial<EmailLog>;
        Update: Partial<EmailLog>;
      };
    };
  };
};