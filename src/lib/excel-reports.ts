import ExcelJS from 'exceljs';
import { createClient } from './supabase-server';
import { Branch } from '@/types/database';

// Interfaces basadas en tu estructura
interface Sale {
  id: string;
  created_at: string;
  document_number: string;
  customer_name: string;
  payment_method: string;
  subtotal: number;
  tax: number;
  total: number;
}

interface Product {
  id: string;
  name: string;
  type: 'A' | 'B' | 'C' | 'D';
  stock: number;
  price: number;
}

interface WorkerConsumption {
  id: string;
  worker_id: string;
  worker_name: string;
  product_name: string;
  quantity: number;
  total: number;
  status: 'pending' | 'paid';
  consumed_at: string;
}

interface WorkOrder {
  id: string;
  created_at: string;
  customer_name: string;
  status: string;
  total: number;
}

interface ReportData {
  sales: Sale[];
  inventory: Product[];
  consumptions: WorkerConsumption[];
  orders: WorkOrder[];
  branch: Branch;
}

const BLUE_THEME = {
  primary: '3B82F6',    // Azul Tailwind
  secondary: '1E40AF',  // Azul oscuro
  accent: '60A5FA',     // Azul claro
  success: '10B981',    // Verde
  warning: 'F59E0B',    // Naranja
  danger: 'EF4444'      // Rojo
};

export async function generateCompleteReport(branchId: string): Promise<Blob> {
  const data = await fetchAllData(branchId);
  const workbook = new ExcelJS.Workbook();
  
  // Propiedades del documento
  workbook.creator = 'TallerWeb';
  workbook.lastModifiedBy = 'TallerWeb System';
  workbook.created = new Date();
  workbook.modified = new Date();
  
  // Crear hojas en orden
  await createSummarySheet(workbook, data);
  await createSalesSheet(workbook, data);
  await createInventorySheet(workbook, data);
  await createConsumptionSheet(workbook, data);
  await createOrdersSheet(workbook, data);
  
  // Generar buffer
  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

async function fetchAllData(branchId: string): Promise<ReportData> {
  const supabase = await createClient();
  
  // Fetch paralelo de todos los datos
  const [
    { data: sales },
    { data: inventory },
    { data: consumptions },
    { data: orders },
    { data: branch }
  ] = await Promise.all([
    supabase
      .from('sales')
      .select('*')
      .eq('branch_id', branchId)
      .order('created_at', { ascending: false }),
      
    supabase
      .from('products')
      .select('*')
      .eq('branch_id', branchId)
      .order('stock', { ascending: false }),
      
    supabase
      .from('worker_consumptions')
      .select(`
        *,
        worker:workers(full_name),
        product:products(name)
      `)
      .eq('branch_id', branchId)
      .order('consumed_at', { ascending: false }),
      
    supabase
      .from('work_orders')
      .select('*')
      .eq('branch_id', branchId)
      .order('created_at', { ascending: false }),
      
    supabase
      .from('branches')
      .select('*')
      .eq('id', branchId)
      .single()
  ]);
  
  // Transformar consumos para facilitar uso
  const formattedConsumptions = consumptions?.map(c => ({
    ...c,
    worker_name: c.worker?.full_name || 'N/A',
    product_name: c.product?.name || 'N/A'
  })) || [];
  
  return {
    sales: sales || [],
    inventory: inventory || [],
    consumptions: formattedConsumptions,
    orders: orders || [],
    branch
  };
}

// Hoja 1: Resumen Ejecutivo
async function createSummarySheet(workbook: ExcelJS.Workbook, data: ReportData) {
  const sheet = workbook.addWorksheet('Resumen Ejecutivo');
  
  // Título principal
  sheet.mergeCells('A1:F1');
  const titleCell = sheet.getCell('A1');
  titleCell.value = `REPORTE GENERAL - ${data.branch.name}`;
  titleCell.font = { size: 18, bold: true, color: { argb: BLUE_THEME.secondary } };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  sheet.getRow(1).height = 30;
  
  // Fecha
  sheet.mergeCells('A2:F2');
  sheet.getCell('A2').value = `Generado: ${new Date().toLocaleString('es-EC')}`;
  sheet.getCell('A2').alignment = { horizontal: 'center' };
  sheet.getCell('A2').font = { italic: true, color: { argb: '666666' } };
  
  // Métricas de Ventas
  let currentRow = 4;
  sheet.getCell(`A${currentRow}`).value = 'MÉTRICAS DE VENTAS';
  sheet.getCell(`A${currentRow}`).font = { bold: true, size: 14, color: { argb: BLUE_THEME.primary } };
  currentRow++;
  
  const totalSales = data.sales.reduce((sum, s) => sum + s.total, 0);
  const avgTicket = data.sales.length > 0 ? totalSales / data.sales.length : 0;
  
  const metricsData = [
    ['Ventas Totales', `$${totalSales.toFixed(2)}`, 'Transacciones', data.sales.length],
    ['Ticket Promedio', `$${avgTicket.toFixed(2)}`, 'Período', 'Últimos registros']
  ];
  
  metricsData.forEach((row, idx) => {
    const rowNum = currentRow + idx;
    sheet.getCell(`A${rowNum}`).value = row[0];
    sheet.getCell(`B${rowNum}`).value = row[1];
    sheet.getCell(`C${rowNum}`).value = row[2];
    sheet.getCell(`D${rowNum}`).value = row[3];
    
    [1, 3].forEach(col => {
      const cell = sheet.getCell(rowNum, col);
      cell.font = { bold: true };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'F3F4F6' }
      };
    });
  });
  
  currentRow += 3;
  
  // Métricas de Inventario
  sheet.getCell(`A${currentRow}`).value = 'MÉTRICAS DE INVENTARIO';
  sheet.getCell(`A${currentRow}`).font = { bold: true, size: 14, color: { argb: BLUE_THEME.primary } };
  currentRow++;
  
  const inventoryValue = data.inventory.reduce((sum, p) => sum + (p.price * p.stock), 0);
  const lowStock = data.inventory.filter(p => p.stock < 5).length;
  const outOfStock = data.inventory.filter(p => p.stock === 0).length;
  
  const invMetrics = [
    ['Total Productos', data.inventory.length, 'Stock Bajo', lowStock],
    ['Sin Stock', outOfStock, 'Valor Inventario', `$${inventoryValue.toFixed(2)}`]
  ];
  
  invMetrics.forEach((row, idx) => {
    const rowNum = currentRow + idx;
    sheet.getCell(`A${rowNum}`).value = row[0];
    sheet.getCell(`B${rowNum}`).value = row[1];
    sheet.getCell(`C${rowNum}`).value = row[2];
    sheet.getCell(`D${rowNum}`).value = row[3];
  });
  
  currentRow += 3;
  
  // Métricas de Consumo Interno
  sheet.getCell(`A${currentRow}`).value = 'CONSUMO INTERNO (MINI TIENDA)';
  sheet.getCell(`A${currentRow}`).font = { bold: true, size: 14, color: { argb: BLUE_THEME.primary } };
  currentRow++;
  
  const totalDebt = data.consumptions
    .filter(c => c.status === 'pending')
    .reduce((sum, c) => sum + c.total, 0);
  const workersWithDebt = new Set(data.consumptions.filter(c => c.status === 'pending').map(c => c.worker_id)).size;
  
  const debtMetrics = [
    ['Deuda Total', `$${totalDebt.toFixed(2)}`, 'Trabajadores con Deuda', workersWithDebt],
    ['Total Consumos', data.consumptions.length, 'Promedio por Deuda', workersWithDebt > 0 ? `$${(totalDebt / workersWithDebt).toFixed(2)}` : '$0.00']
  ];
  
  debtMetrics.forEach((row, idx) => {
    const rowNum = currentRow + idx;
    sheet.getCell(`A${rowNum}`).value = row[0];
    sheet.getCell(`B${rowNum}`).value = row[1];
    sheet.getCell(`C${rowNum}`).value = row[2];
    sheet.getCell(`D${rowNum}`).value = row[3];
  });
  
  // Ajustar anchos
  sheet.getColumn('A').width = 25;
  sheet.getColumn('B').width = 20;
  sheet.getColumn('C').width = 25;
  sheet.getColumn('D').width = 20;
}

// Hoja 2: Ventas POS
async function createSalesSheet(workbook: ExcelJS.Workbook, data: ReportData) {
  const sheet = workbook.addWorksheet('Ventas POS');
  
  // Título
  sheet.getCell('A1').value = 'REPORTE DE VENTAS POS';
  sheet.getCell('A1').font = { size: 16, bold: true, color: { argb: BLUE_THEME.primary } };
  
  // Tabla de datos
  const headers = ['Fecha', 'Documento', 'Cliente', 'Método de Pago', 'Subtotal', 'IVA', 'Total'];
  const headerRow = sheet.getRow(3);
  
  headers.forEach((header, idx) => {
    const cell = headerRow.getCell(idx + 1);
    cell.value = header;
    cell.font = { bold: true, color: { argb: 'FFFFFF' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: BLUE_THEME.primary }
    };
    cell.alignment = { horizontal: 'center' };
  });
  
  // Datos
  data.sales.forEach((sale, idx) => {
    const row = sheet.getRow(4 + idx);
    row.getCell(1).value = new Date(sale.created_at);
    row.getCell(1).numFmt = 'DD/MM/YYYY HH:mm';
    row.getCell(2).value = sale.document_number;
    row.getCell(3).value = sale.customer_name;
    row.getCell(4).value = sale.payment_method;
    row.getCell(5).value = sale.subtotal;
    row.getCell(5).numFmt = '$#,##0.00';
    row.getCell(6).value = sale.tax;
    row.getCell(6).numFmt = '$#,##0.00';
    row.getCell(7).value = sale.total;
    row.getCell(7).numFmt = '$#,##0.00';
    row.getCell(7).font = { bold: true };
  });
  
  // Ajustar anchos
  [20, 20, 25, 15, 12, 12, 12].forEach((width, idx) => {
    sheet.getColumn(idx + 1).width = width;
  });
  
  // Gráfica: Ventas por Método de Pago (Pastel)
  const paymentMethods = data.sales.reduce((acc, sale) => {
    acc[sale.payment_method] = (acc[sale.payment_method] || 0) + sale.total;
    return acc;
  }, {} as Record<string, number>);
  
  const chartData = Object.entries(paymentMethods).map(([method, total]) => ({
    name: method.charAt(0).toUpperCase() + method.slice(1),
    value: total
  }));
  
  sheet.addChart({
    type: 'pie',
    title: { name: 'Ventas por Método de Pago', font: { size: 14, bold: true } },
    series: [{
      name: 'Métodos de Pago',
      labels: chartData.map(d => d.name),
      values: chartData.map(d => d.value),
      dataLabels: { showVal: true, showPercent: true }
    }],
    position: { tl: { col: 9, row: 3 }, ext: { width: 400, height: 300 } }
  });
  
  // Gráfica: Tendencia de Ventas (Barras por día)
  const salesByDay = data.sales.reduce((acc, sale) => {
    const date = new Date(sale.created_at).toLocaleDateString('es-EC');
    acc[date] = (acc[date] || 0) + sale.total;
    return acc;
  }, {} as Record<string, number>);
  
  const sortedDays = Object.entries(salesByDay).sort((a, b) => 
    new Date(a[0]).getTime() - new Date(b[0]).getTime()
  );
  
  if (sortedDays.length > 0) {
    sheet.addChart({
      type: 'line',
      title: { name: 'Tendencia de Ventas', font: { size: 14, bold: true } },
      series: [{
        name: 'Ventas',
        labels: sortedDays.map(d => d[0]),
        values: sortedDays.map(d => d[1]),
        marker: { size: 5 }
      }],
      position: { tl: { col: 9, row: 20 }, ext: { width: 500, height: 300 } },
      legend: { position: 'bottom' }
    });
  }
}

// Hoja 3: Inventario
async function createInventorySheet(workbook: ExcelJS.Workbook, data: ReportData) {
  const sheet = workbook.addWorksheet('Inventario');
  
  sheet.getCell('A1').value = 'REPORTE DE INVENTARIO';
  sheet.getCell('A1').font = { size: 16, bold: true, color: { argb: BLUE_THEME.primary } };
  
  // Tabla
  const headers = ['Producto', 'Tipo', 'Stock', 'Precio Unitario', 'Valor Total'];
  const headerRow = sheet.getRow(3);
  
  headers.forEach((header, idx) => {
    const cell = headerRow.getCell(idx + 1);
    cell.value = header;
    cell.font = { bold: true, color: { argb: 'FFFFFF' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: BLUE_THEME.primary }
    };
  });
  
  data.inventory.forEach((product, idx) => {
    const row = sheet.getRow(4 + idx);
    row.getCell(1).value = product.name;
    row.getCell(2).value = `Tipo ${product.type}`;
    row.getCell(3).value = product.stock;
    row.getCell(4).value = product.price;
    row.getCell(4).numFmt = '$#,##0.00';
    row.getCell(5).value = product.price * product.stock;
    row.getCell(5).numFmt = '$#,##0.00';
    
    // Color si stock bajo
    if (product.stock === 0) {
      row.getCell(3).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FEE2E2' } };
    } else if (product.stock < 5) {
      row.getCell(3).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FEF3C7' } };
    }
  });
  
  [30, 12, 10, 15, 15].forEach((width, idx) => {
    sheet.getColumn(idx + 1).width = width;
  });
  
  // Gráfica: Distribución por Tipo (Pastel)
  const types = data.inventory.reduce((acc, prod) => {
    acc[prod.type] = (acc[prod.type] || 0) + prod.stock;
    return acc;
  }, {} as Record<string, number>);
  
  sheet.addChart({
    type: 'pie',
    title: { name: 'Distribución por Tipo', font: { size: 14, bold: true } },
    series: [{
      name: 'Stock por Tipo',
      labels: Object.keys(types).map(t => `Tipo ${t}`),
      values: Object.values(types),
      dataLabels: { showVal: true, showPercent: true }
    }],
    position: { tl: { col: 7, row: 3 }, ext: { width: 400, height: 300 } }
  });
  
  // Gráfica: Top 10 Productos con Mayor Stock (Barras horizontales)
  const topProducts = [...data.inventory]
    .sort((a, b) => b.stock - a.stock)
    .slice(0, 10);
  
  sheet.addChart({
    type: 'bar',
    title: { name: 'Top 10 - Mayor Stock', font: { size: 14, bold: true } },
    series: [{
      name: 'Stock',
      categories: topProducts.map(p => p.name.substring(0, 20)), // Truncar nombres largos
      values: topProducts.map(p => p.stock)
    }],
    position: { tl: { col: 7, row: 20 }, ext: { width: 500, height: 400 } },
    legend: { position: 'bottom' }
  });
}

// Hoja 4: Consumo Interno
async function createConsumptionSheet(workbook: ExcelJS.Workbook, data: ReportData) {
  const sheet = workbook.addWorksheet('Consumo Interno');
  
  sheet.getCell('A1').value = 'REPORTE DE CONSUMO INTERNO (MINI TIENDA)';
  sheet.getCell('A1').font = { size: 16, bold: true, color: { argb: BLUE_THEME.primary } };
  
  // Tabla de consumos
  const headers = ['Fecha', 'Trabajador', 'Producto', 'Cantidad', 'Total', 'Estado'];
  const headerRow = sheet.getRow(3);
  
  headers.forEach((header, idx) => {
    const cell = headerRow.getCell(idx + 1);
    cell.value = header;
    cell.font = { bold: true, color: { argb: 'FFFFFF' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: BLUE_THEME.primary }
    };
  });
  
  data.consumptions.forEach((cons, idx) => {
    const row = sheet.getRow(4 + idx);
    row.getCell(1).value = new Date(cons.consumed_at);
    row.getCell(1).numFmt = 'DD/MM/YYYY HH:mm';
    row.getCell(2).value = cons.worker_name;
    row.getCell(3).value = cons.product_name;
    row.getCell(4).value = cons.quantity;
    row.getCell(5).value = cons.total;
    row.getCell(5).numFmt = '$#,##0.00';
    row.getCell(6).value = cons.status === 'pending' ? 'Pendiente' : 'Pagado';
    
    // Color según estado
    if (cons.status === 'pending') {
      row.getCell(6).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FEE2E2' } };
      row.getCell(6).font = { color: { argb: 'DC2626' } };
    } else {
      row.getCell(6).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'D1FAE5' } };
      row.getCell(6).font = { color: { argb: '059669' } };
    }
  });
  
  [18, 25, 25, 10, 12, 12].forEach((width, idx) => {
    sheet.getColumn(idx + 1).width = width;
  });
  
  // Gráfica: Deudas por Trabajador (Barras)
  const debtsByWorker = data.consumptions
    .filter(c => c.status === 'pending')
    .reduce((acc, c) => {
      acc[c.worker_name] = (acc[c.worker_name] || 0) + c.total;
      return acc;
    }, {} as Record<string, number>);
  
  if (Object.keys(debtsByWorker).length > 0) {
    sheet.addChart({
      type: 'bar',
      title: { name: 'Deudas por Trabajador', font: { size: 14, bold: true } },
      series: [{
        name: 'Deuda ($)',
        categories: Object.keys(debtsByWorker),
        values: Object.values(debtsByWorker)
      }],
      position: { tl: { col: 8, row: 3 }, ext: { width: 500, height: 300 } }
    });
  }
  
  // Gráfica: Estado de Consumos (Pastel)
  const statusCount = data.consumptions.reduce((acc, c) => {
    const key = c.status === 'pending' ? 'Pendiente' : 'Pagado';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  sheet.addChart({
    type: 'pie',
    title: { name: 'Distribución de Estados', font: { size: 14, bold: true } },
    series: [{
      name: 'Consumos',
      labels: Object.keys(statusCount),
      values: Object.values(statusCount),
      dataLabels: { showVal: true, showPercent: true }
    }],
    position: { tl: { col: 8, row: 20 }, ext: { width: 400, height: 300 } }
  });
}

// Hoja 5: Órdenes de Trabajo
async function createOrdersSheet(workbook: ExcelJS.Workbook, data: ReportData) {
  const sheet = workbook.addWorksheet('Órdenes de Trabajo');
  
  sheet.getCell('A1').value = 'REPORTE DE ÓRDENES DE TRABAJO (BETA)';
  sheet.getCell('A1').font = { size: 16, bold: true, color: { argb: BLUE_THEME.primary } };
  
  const headers = ['Fecha', 'Cliente', 'Estado', 'Total'];
  const headerRow = sheet.getRow(3);
  
  headers.forEach((header, idx) => {
    const cell = headerRow.getCell(idx + 1);
    cell.value = header;
    cell.font = { bold: true, color: { argb: 'FFFFFF' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: BLUE_THEME.primary }
    };
  });
  
  data.orders.forEach((order, idx) => {
    const row = sheet.getRow(4 + idx);
    row.getCell(1).value = new Date(order.created_at);
    row.getCell(1).numFmt = 'DD/MM/YYYY';
    row.getCell(2).value = order.customer_name;
    row.getCell(3).value = order.status;
    row.getCell(4).value = order.total;
    row.getCell(4).numFmt = '$#,##0.00';
  });
  
  [18, 30, 15, 15].forEach((width, idx) => {
    sheet.getColumn(idx + 1).width = width;
  });
}