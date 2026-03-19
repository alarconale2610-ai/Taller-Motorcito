'use client';

import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence, Variants } from 'framer-motion';
import {
  Search, Plus, Edit2, Trash2, AlertTriangle, Package,
  Loader2, Upload, Download, Scan, FileDown
} from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useBranchStore } from '@/store/useBranchStore';
import { getProducts, createProduct, updateProduct, deleteProduct } from '@/lib/actions/products';
import { importProducts } from '@/lib/actions/products-import';
import {
  exportProductsToExcel,
  downloadTemplate,
  parseExcelFile,
  validateProductRow,
} from '@/lib/excel';
import {
  formatCurrency,
  getProductTypeColor,
  getProductTypeLabel,
  getStockStatusColor,
} from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { Product } from '@/types/database';
import { BarcodeScanner } from '@/components/BarcodeScanner';
import { InventoryTable } from '@/components/inventory/InventoryTable';

const productSchema = z.object({
  name: z.string().min(1, 'Nombre requerido'),
  barcode: z.string().optional(),
  description: z.string().optional(),
  type: z.enum(['A', 'B', 'C', 'D']),
  cost_price: z.number().min(0, 'Precio debe ser positivo'),
  sale_price: z.number().min(0, 'Precio debe ser positivo'),
  stock: z.number().min(0, 'Stock debe ser positivo'),
  min_stock: z.number().min(0, 'Stock mínimo debe ser positivo'),
  unit: z.string().min(1, 'Unidad requerida'),
  is_active: z.boolean(),
});

type ProductForm = z.infer<typeof productSchema>;

// Variantes de animación suaves (consistentes con dashboard)
const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.1,
    },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 10 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.4,
      ease: [0.4, 0, 0.2, 1],
    },
  },
};

const dialogVariants: Variants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: {
      duration: 0.3,
      ease: [0.4, 0, 0.2, 1],
    },
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    transition: {
      duration: 0.2,
    },
  },
};

// Hook useDebounce local (puedes moverlo a hooks/useDebounce.ts)
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

export default function InventoryPage() {
  const { selectedBranch } = useBranchStore();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebounce(searchQuery, 300); // 300ms debounce
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [saving, setSaving] = useState(false);

  // Estados para Excel
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importPreview, setImportPreview] = useState<any[]>([]);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Estado para escáner
  const [scannerOpen, setScannerOpen] = useState(false);
  const [continuousMode, setContinuousMode] = useState(true);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<ProductForm>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      type: 'A',
      cost_price: 0,
      sale_price: 0,
      stock: 0,
      min_stock: 5,
      unit: 'unidad',
      is_active: true,
    },
  });

  const costPrice = watch('cost_price');
  const productType = watch('type');

  // Mapa de productos para validación rápida en escáner
  const productsMap = useMemo(() => {
    const map = new Map<string, { name: string; stock: number }>();
    products.forEach(p => {
      if (p.barcode) {
        map.set(p.barcode, { name: p.name, stock: p.stock });
      }
    });
    return map;
  }, [products]);

  // Productos con stock bajo
  const lowStockProducts = useMemo(() => {
    return products.filter((p) => p.stock < p.min_stock || p.stock === 0);
  }, [products]);

  // Precio sugerido basado en tipo
  const suggestedPrice = useMemo(() => {
    if (costPrice && productType) {
      const multipliers: Record<string, number> = { A: 1.4, B: 1.6, C: 1.5, D: 2.0 };
      return Math.round(costPrice * multipliers[productType] * 100) / 100;
    }
    return 0;
  }, [costPrice, productType]);

  useEffect(() => {
    async function loadProducts() {
      if (!selectedBranch) return;

      try {
        setLoading(true);
        const data = await getProducts(selectedBranch.id);
        setProducts(data);
      } catch (error: any) {
        toast({
          title: 'Error',
          description: 'No se pudieron cargar los productos',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    }

    loadProducts();
  }, [selectedBranch]);

  const handleExport = () => {
    if (!selectedBranch) return;
    exportProductsToExcel(products, selectedBranch.name);
    toast({ title: 'Excel exportado correctamente' });
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const data = await parseExcelFile(file);
      const errors: string[] = [];
      const validRows: any[] = [];

      data.forEach((row, index) => {
        const validation = validateProductRow(row, index);
        if (!validation.valid) {
          errors.push(...validation.errors);
        } else {
          validRows.push({
            barcode: row['Código de Barras']?.toString() || undefined,
            name: row['Nombre'],
            description: row['Descripción'] || undefined,
            type: String(row['Tipo (A/B/C/D)']).toUpperCase() as 'A' | 'B' | 'C' | 'D',
            cost_price: Number(row['Precio Costo']),
            sale_price: Number(row['Precio Venta']),
            stock: Number(row['Stock']),
            min_stock: Number(row['Stock Mínimo']),
            unit: row['Unidad'],
          });
        }
      });

      setImportPreview(validRows);
      setImportErrors(errors);
      setImportDialogOpen(true);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleImportConfirm = async () => {
    if (!selectedBranch || importPreview.length === 0) return;

    try {
      setImporting(true);
      const result = await importProducts(selectedBranch.id, importPreview);

      if (result.success > 0) {
        toast({
          title: 'Importación completada',
          description: `${result.success} productos importados correctamente`,
        });

        // Recargar productos
        const updatedProducts = await getProducts(selectedBranch.id);
        setProducts(updatedProducts);
        setImportDialogOpen(false);
        setImportPreview([]);
      }

      if (result.errors.length > 0) {
        setImportErrors(result.errors);
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setImporting(false);
    }
  };

  const handleScanBarcode = (barcode: string, mode: 'camera' | 'hid') => {
    const existingProduct = products.find(p => p.barcode === barcode);

    if (existingProduct) {
      // Si existe y NO estamos en modo continuo, abrir para editar
      if (!continuousMode) {
        handleOpenDialog(existingProduct);
      }
      
      toast({
        title: mode === 'hid' ? '📟 Escáner USB' : '📷 Cámara',
        description: `${existingProduct.name} - Stock: ${existingProduct.stock}`,
      });
    } else {
      // Si no existe, abrir formulario nuevo con barcode prellenado
      setEditingProduct(null);
      reset({
        name: '',
        barcode: barcode,
        description: '',
        type: 'A',
        cost_price: 0,
        sale_price: 0,
        stock: 0,
        min_stock: 5,
        unit: 'unidad',
        is_active: true,
      });
      setDialogOpen(true);
      
      toast({
        title: 'Nuevo producto detectado',
        description: `Código: ${barcode}. Complete los datos.`,
      });
    }
  };

  const handleOpenDialog = (product?: Product) => {
    if (product) {
      setEditingProduct(product);
      reset({
        name: product.name,
        barcode: product.barcode || '',
        description: product.description || '',
        type: product.type,
        cost_price: product.cost_price,
        sale_price: product.sale_price,
        stock: product.stock,
        min_stock: product.min_stock,
        unit: product.unit,
        is_active: product.is_active,
      });
    } else {
      setEditingProduct(null);
      reset({
        name: '',
        barcode: '',
        description: '',
        type: 'A',
        cost_price: 0,
        sale_price: 0,
        stock: 0,
        min_stock: 5,
        unit: 'unidad',
        is_active: true,
      });
    }
    setDialogOpen(true);
  };

  const onSubmit = async (data: ProductForm) => {
    if (!selectedBranch) return;

    try {
      setSaving(true);

      if (editingProduct) {
        await updateProduct(editingProduct.id, {
          ...data,
          barcode: data.barcode || null,
        });
        toast({ title: 'Producto actualizado' });
      } else {
        await createProduct({
          ...data,
          branch_id: selectedBranch.id,
          barcode: data.barcode || null,
        });
        toast({ title: 'Producto creado' });
      }

      const updatedProducts = await getProducts(selectedBranch.id);
      setProducts(updatedProducts);
      setDialogOpen(false);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'No se pudo guardar el producto',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (productId: string) => {
    if (!confirm('¿Está seguro de eliminar este producto?')) return;

    try {
      await deleteProduct(productId);
      setProducts((prev) => prev.filter((p) => p.id !== productId));
      toast({ title: 'Producto eliminado' });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'No se pudo eliminar el producto',
        variant: 'destructive',
      });
    }
  };

  const applySuggestedPrice = () => {
    setValue('sale_price', suggestedPrice);
  };

  if (loading) {
    return (
      <div className="h-[calc(100vh-8rem)] flex items-center justify-center">
        <motion.div
          className="flex flex-col items-center gap-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
        >
          <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
          <p className="text-gray-400">Cargando inventario...</p>
        </motion.div>
      </div>
    );
  }

  return (
    <motion.div
      className="space-y-6"
      initial="hidden"
      animate="visible"
      variants={containerVariants}
    >
      {/* Header */}
      <motion.div variants={itemVariants} className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Inventario</h1>
          <p className="text-gray-500 text-sm mt-1">
            Gestión de productos - {selectedBranch?.branch_config?.business_name || selectedBranch?.name}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button
            variant="outline"
            onClick={() => setScannerOpen(true)}
            className="border-slate-200 hover:bg-slate-50 text-slate-700"
          >
            <Scan className="h-4 w-4 mr-2" />
            Escanear
          </Button>
          <Button
            variant="outline"
            onClick={handleExport}
            className="border-slate-200 hover:bg-slate-50 text-slate-700"
          >
            <Download className="h-4 w-4 mr-2" />
            Exportar Excel
          </Button>
          <Button
            variant="outline"
            onClick={downloadTemplate}
            className="border-slate-200 hover:bg-slate-50 text-slate-700"
          >
            <FileDown className="h-4 w-4 mr-2" />
            Template
          </Button>
          <div className="relative">
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileUpload}
              ref={fileInputRef}
              className="hidden"
              id="excel-upload"
            />
            <Button
              variant="outline"
              onClick={() => document.getElementById('excel-upload')?.click()}
              className="border-slate-200 hover:bg-slate-50 text-slate-700"
            >
              <Upload className="h-4 w-4 mr-2" />
              Importar Excel
            </Button>
          </div>
          <Button
            onClick={() => handleOpenDialog()}
            className="bg-slate-800 hover:bg-slate-700 text-white"
          >
            <Plus className="h-4 w-4 mr-2" />
            Nuevo Producto
          </Button>
        </div>
      </motion.div>

      {/* Alerta Stock Bajo */}
      <AnimatePresence>
        {lowStockProducts.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
          >
            <Card className="border-amber-200 bg-amber-50/50 shadow-sm">
              <CardContent className="flex items-center gap-3 py-4">
                <div className="bg-amber-100 p-2 rounded-full">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                </div>
                <div>
                  <p className="font-medium text-amber-800 text-sm">
                    {lowStockProducts.length} productos con stock bajo
                  </p>
                  <p className="text-xs text-amber-600/80">
                    Revise el inventario y realice pedidos
                  </p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Search */}
      <motion.div variants={itemVariants} className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <Input
          placeholder="Buscar por nombre o código de barras..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 border-slate-200 focus:border-slate-400 focus:ring-slate-200"
        />
      </motion.div>

      {/* Products Table - VIRTUALIZADA */}
      <motion.div variants={itemVariants}>
        <InventoryTable
          products={products}
          onEdit={handleOpenDialog}
          onDelete={handleDelete}
          searchQuery={debouncedSearch}
        />
      </motion.div>

      {/* Product Dialog */}
      <AnimatePresence>
        {dialogOpen && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogContent className="sm:max-w-lg border border-gray-200 shadow-lg max-h-[90vh] overflow-y-auto">
              <motion.div
                variants={dialogVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
              >
                <DialogHeader>
                  <DialogTitle className="text-gray-800 font-semibold">
                    {editingProduct ? 'Editar Producto' : 'Nuevo Producto'}
                  </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-sm text-gray-600">Nombre *</Label>
                      <Input
                        {...register('name')}
                        className="border-slate-200 focus:border-slate-400 focus:ring-slate-200"
                      />
                      {errors.name && (
                        <p className="text-xs text-red-500">{errors.name.message}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm text-gray-600">Código de Barras</Label>
                      <div className="flex gap-2">
                        <Input
                          {...register('barcode')}
                          className="border-slate-200 focus:border-slate-400 focus:ring-slate-200"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={() => setScannerOpen(true)}
                          className="border-slate-200 hover:bg-slate-50"
                        >
                          <Scan className="h-4 w-4 text-slate-600" />
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm text-gray-600">Descripción</Label>
                    <Input
                      {...register('description')}
                      className="border-slate-200 focus:border-slate-400 focus:ring-slate-200"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-sm text-gray-600">Tipo *</Label>
                      <Select
                        value={watch('type')}
                        onValueChange={(v: 'A' | 'B' | 'C' | 'D') => setValue('type', v)}
                      >
                        <SelectTrigger className="border-slate-200 focus:ring-slate-200">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="A">Tipo A (1.4x)</SelectItem>
                          <SelectItem value="B">Tipo B (1.6x)</SelectItem>
                          <SelectItem value="C">Tipo C (1.5x)</SelectItem>
                          <SelectItem value="D">Tipo D (2.0x)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm text-gray-600">Unidad *</Label>
                      <Input
                        {...register('unit')}
                        className="border-slate-200 focus:border-slate-400 focus:ring-slate-200"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-sm text-gray-600">Precio de Costo *</Label>
                      <Input
                        type="number"
                        step="0.01"
                        {...register('cost_price', { valueAsNumber: true })}
                        className="border-slate-200 focus:border-slate-400 focus:ring-slate-200"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm text-gray-600">Precio de Venta *</Label>
                      <div className="flex gap-2">
                        <Input
                          type="number"
                          step="0.01"
                          {...register('sale_price', { valueAsNumber: true })}
                          className="border-slate-200 focus:border-slate-400 focus:ring-slate-200"
                        />
                      </div>
                    </div>
                  </div>

                  {suggestedPrice > 0 && (
                    <motion.div
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-3 bg-blue-50/50 border border-blue-100 rounded-lg flex items-center justify-between"
                    >
                      <div>
                        <p className="text-xs text-blue-700">
                          Precio sugerido ({productType === 'A' ? '1.4x' : productType === 'B' ? '1.6x' : productType === 'C' ? '1.5x' : '2.0x'}):
                        </p>
                        <p className="text-base font-semibold text-blue-800">
                          {formatCurrency(suggestedPrice)}
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={applySuggestedPrice}
                        className="border-blue-200 text-blue-700 hover:bg-blue-50"
                      >
                        Aplicar
                      </Button>
                    </motion.div>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-sm text-gray-600">Stock Actual *</Label>
                      <Input
                        type="number"
                        {...register('stock', { valueAsNumber: true })}
                        className="border-slate-200 focus:border-slate-400 focus:ring-slate-200"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm text-gray-600">Stock Mínimo *</Label>
                      <Input
                        type="number"
                        {...register('min_stock', { valueAsNumber: true })}
                        className="border-slate-200 focus:border-slate-400 focus:ring-slate-200"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-3 py-2">
                    <Switch
                      checked={watch('is_active')}
                      onCheckedChange={(v) => setValue('is_active', v)}
                      className="data-[state=checked]:bg-emerald-500"
                    />
                    <Label className="text-sm text-gray-600">Producto activo</Label>
                  </div>

                  <DialogFooter className="gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setDialogOpen(false)}
                      className="border-slate-200 text-slate-700 hover:bg-slate-50"
                    >
                      Cancelar
                    </Button>
                    <Button
                      type="submit"
                      disabled={saving}
                      className="bg-slate-800 hover:bg-slate-700 text-white"
                    >
                      {saving ? 'Guardando...' : editingProduct ? 'Guardar Cambios' : 'Crear Producto'}
                    </Button>
                  </DialogFooter>
                </form>
              </motion.div>
            </DialogContent>
          </Dialog>
        )}
      </AnimatePresence>

      {/* Import Preview Dialog */}
      <AnimatePresence>
        {importDialogOpen && (
          <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
            <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto border border-gray-200 shadow-lg">
              <motion.div
                variants={dialogVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
              >
                <DialogHeader>
                  <DialogTitle className="text-gray-800 font-semibold">Vista Previa de Importación</DialogTitle>
                </DialogHeader>

                <div className="space-y-4 mt-4">
                  {importErrors.length > 0 && (
                    <div className="p-4 bg-red-50/50 border border-red-100 rounded-lg">
                      <p className="font-medium text-red-800 mb-2 text-sm">Errores encontrados:</p>
                      <ul className="text-xs text-red-600 space-y-1 max-h-32 overflow-y-auto">
                        {importErrors.map((err, idx) => (
                          <li key={idx}>{err}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div>
                    <p className="text-sm text-gray-600 mb-2">
                      Productos válidos para importar: <span className="font-semibold text-gray-800">{importPreview.length}</span>
                    </p>
                    <ScrollArea className="max-h-64 overflow-y-auto border border-slate-200 rounded-lg">
                      <div className="min-w-[500px]">
                        <div className="grid grid-cols-4 gap-4 px-4 py-2 bg-slate-50 text-xs font-medium text-gray-500 border-b">
                          <div>Nombre</div>
                          <div>Tipo</div>
                          <div>Stock</div>
                          <div>Precio</div>
                        </div>
                        <div className="divide-y">
                          {importPreview.slice(0, 10).map((product, idx) => (
                            <div key={idx} className="grid grid-cols-4 gap-4 px-4 py-2 text-sm">
                              <div className="truncate">{product.name}</div>
                              <div>
                                <Badge className={`${getProductTypeColor(product.type)} text-white text-xs`}>
                                  {product.type}
                                </Badge>
                              </div>
                              <div className="text-gray-600">{product.stock}</div>
                              <div className="text-gray-600">${product.sale_price}</div>
                            </div>
                          ))}
                          {importPreview.length > 10 && (
                            <div className="text-center text-gray-400 text-sm py-3">
                              ... y {importPreview.length - 10} productos más
                            </div>
                          )}
                        </div>
                      </div>
                    </ScrollArea>
                  </div>
                </div>

                <DialogFooter className="flex-col sm:flex-row gap-2 mt-6">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setImportDialogOpen(false)}
                    className="w-full sm:w-auto border-slate-200 text-slate-700 hover:bg-slate-50"
                  >
                    Cancelar
                  </Button>
                  <Button
                    onClick={handleImportConfirm}
                    disabled={importing || importPreview.length === 0}
                    className="w-full sm:w-auto bg-slate-800 hover:bg-slate-700 text-white"
                  >
                    {importing ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Importando...
                      </>
                    ) : (
                      `Importar ${importPreview.length} Productos`
                    )}
                  </Button>
                </DialogFooter>
              </motion.div>
            </DialogContent>
          </Dialog>
        )}
      </AnimatePresence>

      {/* Barcode Scanner - MEJORADO CON DUAL MODE */}
      <BarcodeScanner
        isOpen={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScan={handleScanBarcode}
        continuous={continuousMode}
        existingProducts={productsMap}
      />
    </motion.div>
  );
}
