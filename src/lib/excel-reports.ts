import ExcelJS from 'exceljs';
import { createClient } from './supabase-server';
import { Branch, BranchConfig } from '@/types/database';

// Interfaces...
interface Sale {
  id: string;
  created_at: string;
  document_number?: string;
  customer_name: string;
  customer_ruc?: string;
  payment_method: 'cash' | 'card' | 'transfer' | 'credit';
  subtotal: number;
  iva_amount: number;
  total: number;
  status: 'completed' | 'cancelled' | 'refunded';
}

interface Product {
  id: string;
  name: string;
  type: 'A' | 'B' | 'C' | 'D';
  stock: number;
  cost_price: number;
  sale_price: number;
  min_stock: number;
  is_active: boolean;
}

interface Worker {
  id: string;
  full_name: string;
  branch_id: string;
  is_active: boolean;
}

interface WorkerConsumption {
  id: string;
  worker_id: string;
  worker_name: string;
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  total: number;
  status: 'pending' | 'paid';
  consumed_at: string;
}

interface WorkOrder {
  id: string;
  created_at: string;
  customer_id: string;
  customer_name?: string;
  vehicle_id: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'delivered';
  mechanic_id?: string;
  total: number;
  mechanic_name?: string;
}

interface ReportData {
  sales: Sale[];
  inventory: Product[];
  consumptions: WorkerConsumption[];
  orders: WorkOrder[];
  branch: Branch;
  branchConfig: BranchConfig | null;
  workers: Worker[];
  dateRange?: { start: string; end: string }; // Para mostrar en el reporte
}

const BLUE_THEME = {
  primary: '3B82F6',
  secondary: '1E40AF',
  accent: '60A5FA',
  success: '10B981',
  warning: 'F59E0B',
  danger: 'EF4444',
  light: 'F8FAFC'
};

export async function generateCompleteReport(
  branchId: string, 
  startDate?: string, 
  endDate?: string
): Promise<Blob> {
  const data = await fetchAllData(branchId, startDate, endDate);
  const workbook = new ExcelJS.Workbook();

  workbook.creator = getBusinessName(data);
  workbook.lastModifiedBy = 'TallerWeb System';
  workbook.created = new Date();
  workbook.modified = new Date();

  await createSummarySheet(workbook, data);
  await createSalesSheet(workbook, data);
  await createInventorySheet(workbook, data);
  await createConsumptionSheet(workbook, data);
  await createOrdersSheet(workbook, data);

  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

async function fetchAllData(
  branchId: string, 
  startDate?: string, 
  endDate?: string
): Promise<ReportData> {
  const supabase = await createClient();

  // Convertir fechas a formato ISO si existen
  let startISO: string | undefined;
  let endISO: string | undefined;
  
  if (startDate && endDate) {
    startISO = new Date(startDate + 'T00:00:00').toISOString();
    endISO = new Date(endDate + 'T23:59:59.999').toISOString();
    console.log(`Filtrando datos desde ${startISO} hasta ${endISO}`);
  }

  // 1. TRABAJADORES primero (para filtrar consumos)
  const { data: workers } = await supabase
    .from('workers')
    .select('id, full_name, branch_id, is_active')
    .eq('branch_id', branchId)
    .eq('is_active', true);

  const workerIds = workers?.map(w => w.id) || [];

  // 2. Construir queries base
  let salesQuery = supabase
    .from('sales')
    .select('*')
    .eq('branch_id', branchId)
    .order('created_at', { ascending: false });

  let ordersQuery = supabase
    .from('work_orders')
    .select('*, customer:customers(name)')
    .eq('branch_id', branchId)
    .order('created_at', { ascending: false });

  let consumptionsQuery = workerIds.length > 0 
    ? supabase
        .from('worker_consumptions')
        .select('*, product:products(name)')
        .in('worker_id', workerIds)
        .order('consumed_at', { ascending: false })
    : null;

  // Aplicar filtros de fecha si existen
  if (startISO && endISO) {
    salesQuery = salesQuery.gte('created_at', startISO).lte('created_at', endISO);
    ordersQuery = ordersQuery.gte('created_at', startISO).lte('created_at', endISO);
    if (consumptionsQuery) {
      consumptionsQuery = consumptionsQuery.gte('consumed_at', startISO).lte('consumed_at', endISO);
    }
  }

  // 3. Ejecutar queries en paralelo
  const [
    { data: sales },
    { data: inventory },
    { data: consumptions },
    { data: orders },
    { data: branch },
    { data: branchConfig }
  ] = await Promise.all([
    salesQuery,
    supabase.from('products').select('*').eq('branch_id', branchId).eq('is_active', true).order('stock', { ascending: false }),
    consumptionsQuery || Promise.resolve({ data: [], error: null }),
    ordersQuery,
    supabase.from('branches').select('*').eq('id', branchId).single(),
    supabase.from('branch_config').select('*').eq('branch_id', branchId).single()
  ]);

  // Transformar consumos
  const formattedConsumptions: WorkerConsumption[] = (consumptions || []).map((c: any) => ({
    ...c,
    worker_name: workers?.find(w => w.id === c.worker_id)?.full_name || 'N/A',
    product_name: c.product?.name || 'N/A'
  }));

  // Transformar órdenes
  const formattedOrders: WorkOrder[] = (orders || []).map((o: any) => ({
    ...o,
    customer_name: o.customer?.name || 'N/A'
  }));

  return {
    sales: sales || [],
    inventory: inventory || [],
    consumptions: formattedConsumptions,
    orders: formattedOrders,
    branch: branch,
    branchConfig: branchConfig,
    workers: workers || [],
    dateRange: startISO && endISO ? { start: startDate!, end: endDate! } : undefined
  };
}

// Helpers para datos de Settings
function getBusinessName(data: ReportData): string {
  return data.branchConfig?.business_name?.trim() || data.branch?.name || 'Taller';
}

function getCompanyRUC(data: ReportData): string {
  return data.branchConfig?.company_ruc?.trim() || data.branchConfig?.ruc || '0000000000000';
}

function getFullAddress(data: ReportData): string {
  const parts = [];
  if (data.branchConfig?.company_address) parts.push(data.branchConfig.company_address);
  if (data.branchConfig?.company_phone) parts.push(`Tel: ${data.branchConfig.company_phone}`);
  if (data.branchConfig?.company_email) parts.push(`Email: ${data.branchConfig.company_email}`);
  return parts.join(' | ') || 'Sin datos de contacto';
}

// Función para crear encabezado estándar en todas las hojas
function createStandardHeader(sheet: ExcelJS.Worksheet, data: ReportData, subtitle: string, columns: number) {
  const businessName = getBusinessName(data);
  const companyRUC = getCompanyRUC(data);
  const companyName = data.branchConfig?.company_name || businessName;
  const address = getFullAddress(data);
  const ivaPercent = data.branchConfig?.iva_percent || 15;

  // Fila 1: Nombre Comercial (grande)
  sheet.mergeCells(1, 1, 1, columns);
  const titleCell = sheet.getCell(1, 1);
  titleCell.value = businessName.toUpperCase();
  titleCell.font = { size: 18, bold: true, color: { argb: 'FFFFFF' } };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BLUE_THEME.primary } };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  sheet.getRow(1).height = 30;

  // Fila 2: Razón Social + RUC
  sheet.mergeCells(2, 1, 2, columns);
  const companyCell = sheet.getCell(2, 1);
  companyCell.value = `${companyName} | RUC: ${companyRUC}`;
  companyCell.font = { size: 11, color: { argb: 'FFFFFF' }, italic: true };
  companyCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BLUE_THEME.secondary } };
  companyCell.alignment = { horizontal: 'center', vertical: 'middle' };
  sheet.getRow(2).height = 20;

  // Fila 3: Dirección, Teléfono, Email
  sheet.mergeCells(3, 1, 3, columns);
  const contactCell = sheet.getCell(3, 1);
  contactCell.value = address;
  contactCell.font = { size: 10, color: { argb: '666666' } };
  contactCell.alignment = { horizontal: 'center', vertical: 'middle' };
  sheet.getRow(3).height = 18;

  // Fila 4: Subtítulo del reporte + Período (si existe) + IVA
  sheet.mergeCells(4, 1, 4, columns);
  const subtitleCell = sheet.getCell(4, 1);
  
  let periodText = '';
  if (data.dateRange) {
    periodText = ` | Período: ${data.dateRange.start} al ${data.dateRange.end}`;
  } else {
    periodText = ' | Período: Todo el historial';
  }
  
  subtitleCell.value = `${subtitle}${periodText} | IVA ${ivaPercent}% | Generado: ${new Date().toLocaleString('es-EC')}`;
  subtitleCell.font = { size: 11, bold: true };
  subtitleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  sheet.getRow(4).height = 22;

  // Fila 5: Separador vacío
  sheet.getRow(5).height = 5;

  return 6; // Retorna la fila donde empiezan los datos
}

// Hoja 1: Resumen Ejecutivo
async function createSummarySheet(workbook: ExcelJS.Workbook, data: ReportData) {
  const sheet = workbook.addWorksheet('Resumen Ejecutivo');
  const startRow = createStandardHeader(sheet, data, 'REPORTE GENERAL EJECUTIVO', 4);

  let currentRow = startRow;

  // VENTAS
  sheet.getCell(`A${currentRow}`).value = 'MÉTRICAS DE VENTAS';
  sheet.getCell(`A${currentRow}`).font = { bold: true, size: 13, color: { argb: BLUE_THEME.primary } };
  currentRow += 2;

  const completedSales = data.sales.filter(s => s.status === 'completed');
  const totalSales = completedSales.reduce((sum, s) => sum + s.total, 0);
  const avgTicket = completedSales.length > 0 ? totalSales / completedSales.length : 0;

  const salesRows = [
    ['Ventas Totales:', `$${totalSales.toFixed(2)}`, 'Transacciones Completadas:', completedSales.length],
    ['Ticket Promedio:', `$${avgTicket.toFixed(2)}`, 'Total Transacciones:', data.sales.length]
  ];

  salesRows.forEach((row) => {
    sheet.getCell(`A${currentRow}`).value = row[0];
    sheet.getCell(`A${currentRow}`).font = { bold: true };
    sheet.getCell(`B${currentRow}`).value = row[1];
    sheet.getCell(`C${currentRow}`).value = row[2];
    sheet.getCell(`C${currentRow}`).font = { bold: true };
    sheet.getCell(`D${currentRow}`).value = row[3];
    currentRow++;
  });

  currentRow += 2;

  // INVENTARIO
  sheet.getCell(`A${currentRow}`).value = 'MÉTRICAS DE INVENTARIO (Estado Actual)';
  sheet.getCell(`A${currentRow}`).font = { bold: true, size: 13, color: { argb: BLUE_THEME.primary } };
  currentRow += 2;

  const inventoryValue = data.inventory.reduce((sum, p) => sum + (p.sale_price * p.stock), 0);
  const inventoryCost = data.inventory.reduce((sum, p) => sum + (p.cost_price * p.stock), 0);
  const lowStock = data.inventory.filter(p => p.stock > 0 && p.stock < p.min_stock).length;
  const outOfStock = data.inventory.filter(p => p.stock === 0).length;

  const invRows = [
    ['Total Productos:', data.inventory.length, 'Stock Bajo:', lowStock],
    ['Sin Stock:', outOfStock, 'Valor Venta:', `$${inventoryValue.toFixed(2)}`],
    ['', '', 'Valor Costo:', `$${inventoryCost.toFixed(2)}`]
  ];

  invRows.forEach((row) => {
    sheet.getCell(`A${currentRow}`).value = row[0];
    if (row[0]) sheet.getCell(`A${currentRow}`).font = { bold: true };
    sheet.getCell(`B${currentRow}`).value = row[1];
    sheet.getCell(`C${currentRow}`).value = row[2];
    if (row[2]) sheet.getCell(`C${currentRow}`).font = { bold: true };
    sheet.getCell(`D${currentRow}`).value = row[3];
    currentRow++;
  });

  currentRow += 2;

  // CONSUMO INTERNO
  sheet.getCell(`A${currentRow}`).value = 'CONSUMO INTERNO (MINI TIENDA)';
  sheet.getCell(`A${currentRow}`).font = { bold: true, size: 13, color: { argb: BLUE_THEME.primary } };
  currentRow += 2;

  const pending = data.consumptions.filter(c => c.status === 'pending');
  const totalDebt = pending.reduce((sum, c) => sum + c.total, 0);
  const workersWithDebt = new Set(pending.map(c => c.worker_id)).size;

  const consRows = [
    ['Deuda Total Trabajadores:', `$${totalDebt.toFixed(2)}`, 'Trabajadores con Deuda:', workersWithDebt],
    ['Total Consumos:', data.consumptions.length, 'Pendientes / Pagados:', `${pending.length} / ${data.consumptions.filter(c => c.status === 'paid').length}`]
  ];

  consRows.forEach((row) => {
    sheet.getCell(`A${currentRow}`).value = row[0];
    sheet.getCell(`A${currentRow}`).font = { bold: true };
    sheet.getCell(`B${currentRow}`).value = row[1];
    if (totalDebt > 0 && String(row[0]).includes('Deuda')) {
      sheet.getCell(`B${currentRow}`).font = { color: { argb: BLUE_THEME.danger }, bold: true };
    }
    sheet.getCell(`C${currentRow}`).value = row[2];
    sheet.getCell(`C${currentRow}`).font = { bold: true };
    sheet.getCell(`D${currentRow}`).value = row[3];
    currentRow++;
  });

  // Ajustar anchos
  sheet.getColumn('A').width = 28;
  sheet.getColumn('B').width = 20;
  sheet.getColumn('C').width = 25;
  sheet.getColumn('D').width = 18;
}

// Hoja 2: Ventas POS
async function createSalesSheet(workbook: ExcelJS.Workbook, data: ReportData) {
  const sheet = workbook.addWorksheet('Ventas POS');
  const startRow = createStandardHeader(sheet, data, 'REPORTE DE VENTAS POS', 8);

  const headers = ['Fecha', 'Documento', 'Cliente', 'RUC', 'Método de Pago', 'Subtotal', 'IVA', 'Total'];
  const headerRow = sheet.getRow(startRow);
  
  headers.forEach((h, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = h;
    cell.font = { bold: true, color: { argb: 'FFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BLUE_THEME.primary } };
    cell.alignment = { horizontal: 'center' };
  });

  let dataRow = startRow + 1;
  data.sales.forEach((sale, idx) => {
    const row = sheet.getRow(dataRow + idx);
    row.getCell(1).value = new Date(sale.created_at);
    row.getCell(1).numFmt = 'DD/MM/YYYY HH:mm';
    row.getCell(2).value = sale.document_number || 'N/A';
    row.getCell(3).value = sale.customer_name;
    row.getCell(4).value = sale.customer_ruc || 'N/A';
    row.getCell(5).value = sale.payment_method.toUpperCase();
    row.getCell(6).value = sale.subtotal;
    row.getCell(6).numFmt = '$#,##0.00';
    row.getCell(7).value = sale.iva_amount;
    row.getCell(7).numFmt = '$#,##0.00';
    row.getCell(8).value = sale.total;
    row.getCell(8).numFmt = '$#,##0.00';
    row.getCell(8).font = { bold: true };

    if (idx % 2 === 0) {
      for (let i = 1; i <= 8; i++) row.getCell(i).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BLUE_THEME.light } };
    }
  });

  // Totales
  if (data.sales.length > 0) {
    const totalRow = sheet.getRow(dataRow + data.sales.length);
    totalRow.getCell(5).value = 'TOTALES:';
    totalRow.getCell(5).font = { bold: true };
    totalRow.getCell(6).value = data.sales.reduce((sum, s) => sum + s.subtotal, 0);
    totalRow.getCell(6).numFmt = '$#,##0.00';
    totalRow.getCell(7).value = data.sales.reduce((sum, s) => sum + s.iva_amount, 0);
    totalRow.getCell(7).numFmt = '$#,##0.00';
    totalRow.getCell(8).value = data.sales.reduce((sum, s) => sum + s.total, 0);
    totalRow.getCell(8).numFmt = '$#,##0.00';
    totalRow.getCell(8).font = { bold: true, size: 12, color: { argb: BLUE_THEME.primary } };
  }

  [20, 20, 30, 15, 15, 12, 12, 12].forEach((w, i) => sheet.getColumn(i + 1).width = w);
}

// Hoja 3: Inventario
async function createInventorySheet(workbook: ExcelJS.Workbook, data: ReportData) {
  const sheet = workbook.addWorksheet('Inventario');
  const startRow = createStandardHeader(sheet, data, 'REPORTE DE INVENTARIO', 7);

  const headers = ['Producto', 'Tipo', 'Stock', 'Mínimo', 'Costo', 'Venta', 'Valor Total'];
  const headerRow = sheet.getRow(startRow);

  headers.forEach((h, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = h;
    cell.font = { bold: true, color: { argb: 'FFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BLUE_THEME.primary } };
  });

  let dataRow = startRow + 1;
  data.inventory.forEach((product, idx) => {
    const row = sheet.getRow(dataRow + idx);
    row.getCell(1).value = product.name;
    row.getCell(2).value = product.type;
    row.getCell(3).value = product.stock;
    row.getCell(4).value = product.min_stock;
    row.getCell(5).value = product.cost_price;
    row.getCell(5).numFmt = '$#,##0.00';
    row.getCell(6).value = product.sale_price;
    row.getCell(6).numFmt = '$#,##0.00';
    row.getCell(7).value = product.sale_price * product.stock;
    row.getCell(7).numFmt = '$#,##0.00';

    const stockCell = row.getCell(3);
    if (product.stock === 0) {
      stockCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FEE2E2' } };
      stockCell.font = { color: { argb: 'DC2626' }, bold: true };
    } else if (product.stock < product.min_stock) {
      stockCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FEF3C7' } };
      stockCell.font = { color: { argb: 'D97706' } };
    }

    if (idx % 2 === 0) {
      for (let i = 1; i <= 7; i++) {
        if (!row.getCell(i).fill || !(row.getCell(i).fill as any).fgColor) {
          row.getCell(i).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BLUE_THEME.light } };
        }
      }
    }
  });

  // Total
  if (data.inventory.length > 0) {
    const totalRow = sheet.getRow(dataRow + data.inventory.length + 1);
    totalRow.getCell(5).value = 'TOTAL:';
    totalRow.getCell(5).font = { bold: true };
    totalRow.getCell(7).value = data.inventory.reduce((sum, p) => sum + (p.sale_price * p.stock), 0);
    totalRow.getCell(7).numFmt = '$#,##0.00';
    totalRow.getCell(7).font = { bold: true, size: 12, color: { argb: BLUE_THEME.primary } };
  }

  [35, 10, 10, 10, 15, 15, 15].forEach((w, i) => sheet.getColumn(i + 1).width = w);
}

// Hoja 4: Consumo Interno
async function createConsumptionSheet(workbook: ExcelJS.Workbook, data: ReportData) {
  const sheet = workbook.addWorksheet('Consumo Interno');
  const startRow = createStandardHeader(sheet, data, 'REPORTE DE CONSUMO INTERNO', 7);

  const headers = ['Fecha', 'Trabajador', 'Producto', 'Cantidad', 'Unitario', 'Total', 'Estado'];
  const headerRow = sheet.getRow(startRow);

  headers.forEach((h, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = h;
    cell.font = { bold: true, color: { argb: 'FFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BLUE_THEME.primary } };
  });

  let dataRow = startRow + 1;
  data.consumptions.forEach((cons, idx) => {
    const row = sheet.getRow(dataRow + idx);
    row.getCell(1).value = new Date(cons.consumed_at);
    row.getCell(1).numFmt = 'DD/MM/YYYY HH:mm';
    row.getCell(2).value = cons.worker_name;
    row.getCell(3).value = cons.product_name;
    row.getCell(4).value = cons.quantity;
    row.getCell(5).value = cons.unit_price;
    row.getCell(5).numFmt = '$#,##0.00';
    row.getCell(6).value = cons.total;
    row.getCell(6).numFmt = '$#,##0.00';
    row.getCell(7).value = cons.status === 'pending' ? 'PENDIENTE' : 'PAGADO';

    const statusCell = row.getCell(7);
    if (cons.status === 'pending') {
      statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FEE2E2' } };
      statusCell.font = { color: { argb: 'DC2626' }, bold: true };
    } else {
      statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'D1FAE5' } };
      statusCell.font = { color: { argb: '059669' }, bold: true };
    }

    if (idx % 2 === 0) {
      for (let i = 1; i <= 6; i++) row.getCell(i).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BLUE_THEME.light } };
    }
  });

  if (data.consumptions.length > 0) {
    const totalDebt = data.consumptions.filter(c => c.status === 'pending').reduce((sum, c) => sum + c.total, 0);
    const row = sheet.getRow(dataRow + data.consumptions.length + 1);
    row.getCell(4).value = 'DEUDA TOTAL:';
    row.getCell(4).font = { bold: true, size: 12 };
    row.getCell(6).value = totalDebt;
    row.getCell(6).numFmt = '$#,##0.00';
    row.getCell(6).font = { bold: true, size: 12, color: { argb: 'DC2626' } };
  }

  [18, 25, 30, 10, 12, 12, 15].forEach((w, i) => sheet.getColumn(i + 1).width = w);
}

// Hoja 5: Órdenes de Trabajo
async function createOrdersSheet(workbook: ExcelJS.Workbook, data: ReportData) {
  const sheet = workbook.addWorksheet('Órdenes de Trabajo');
  const startRow = createStandardHeader(sheet, data, 'REPORTE DE ÓRDENES DE TRABAJO', 6);

  const headers = ['Fecha', 'Cliente', 'Descripción', 'Estado', 'Total', 'Mecánico'];
  const headerRow = sheet.getRow(startRow);

  headers.forEach((h, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = h;
    cell.font = { bold: true, color: { argb: 'FFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BLUE_THEME.primary } };
  });

  let dataRow = startRow + 1;
  data.orders.forEach((order, idx) => {
    const row = sheet.getRow(dataRow + idx);
    row.getCell(1).value = new Date(order.created_at);
    row.getCell(1).numFmt = 'DD/MM/YYYY HH:mm';
    row.getCell(2).value = order.customer_name || 'N/A';
    row.getCell(3).value = order.description || 'N/A';
    row.getCell(4).value = order.status.toUpperCase();
    row.getCell(5).value = order.total || 0;
    row.getCell(5).numFmt = '$#,##0.00';
    row.getCell(6).value = order.mechanic_name || 'Sin asignar';

    if (idx % 2 === 0) {
      for (let i = 1; i <= 6; i++) row.getCell(i).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BLUE_THEME.light } };
    }
  });

  [18, 30, 40, 15, 15, 25].forEach((w, i) => sheet.getColumn(i + 1).width = w);
}