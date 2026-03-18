'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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

export default function InventoryPage() {
  const { selectedBranch } = useBranchStore();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
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
  const currentBarcode = watch('barcode');

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

  const suggestedPrice = useMemo(() => {
    if (costPrice && productType) {
      const multipliers: Record<string, number> = { A: 1.4, B: 1.6, C: 1.5, D: 2.0 };
      return Math.round(costPrice * multipliers[productType] * 100) / 100;
    }
    return 0;
  }, [costPrice, productType]);

  const filteredProducts = useMemo(() => {
    return products.filter(
      (product) =>
        product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        product.barcode?.includes(searchQuery)
    );
  }, [products, searchQuery]);

  const lowStockProducts = useMemo(() => {
    return products.filter((p) => p.stock < p.min_stock || p.stock === 0);
  }, [products]);

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

  const handleScanBarcode = (barcode: string) => {
    // Buscar si el producto existe
    const existingProduct = products.find(p => p.barcode === barcode);
    
    if (existingProduct) {
      // Si existe, abrir para editar
      handleOpenDialog(existingProduct);
      toast({ 
        title: 'Producto encontrado', 
        description: `${existingProduct.name} - Stock: ${existingProduct.stock}` 
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
        description: `Código: ${barcode}. Complete los datos.` 
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
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          <p className="text-gray-500">Cargando inventario...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Inventario</h1>
          <p className="text-gray-500">Gestión de productos - {selectedBranch?.name}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setScannerOpen(true)}>
            <Scan className="h-4 w-4 mr-2" />
            Escanear
          </Button>
          <Button variant="outline" onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            Exportar Excel
          </Button>
          <Button variant="outline" onClick={downloadTemplate}>
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
            >
              <Upload className="h-4 w-4 mr-2" />
              Importar Excel
            </Button>
          </div>
          <Button onClick={() => handleOpenDialog()}>
            <Plus className="h-4 w-4 mr-2" />
            Nuevo Producto
          </Button>
        </div>
      </div>

      {/* Alerts */}
      {lowStockProducts.length > 0 && (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardContent className="flex items-center gap-3 py-4">
            <AlertTriangle className="h-5 w-5 text-yellow-600" />
            <div>
              <p className="font-medium text-yellow-800">
                {lowStockProducts.length} productos con stock bajo
              </p>
              <p className="text-sm text-yellow-600">
                Revise el inventario y realice pedidos
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          placeholder="Buscar por nombre o código de barras..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Products Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Producto</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Stock</TableHead>
                  <TableHead>Costo</TableHead>
                  <TableHead>Venta</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProducts.map((product) => (
                  <TableRow key={product.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{product.name}</p>
                        {product.barcode && (
                          <p className="text-xs text-gray-500 font-mono">{product.barcode}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={`${getProductTypeColor(product.type)} text-white`}>
                        {getProductTypeLabel(product.type)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className={getStockStatusColor(product.stock, product.min_stock)}>
                        {product.stock} {product.unit}
                      </span>
                    </TableCell>
                    <TableCell>{formatCurrency(product.cost_price)}</TableCell>
                    <TableCell>{formatCurrency(product.sale_price)}</TableCell>
                    <TableCell>
                      {product.is_active ? (
                        <Badge variant="default">Activo</Badge>
                      ) : (
                        <Badge variant="secondary">Inactivo</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleOpenDialog(product)}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(product.id)}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Product Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingProduct ? 'Editar Producto' : 'Nuevo Producto'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nombre *</Label>
                <Input {...register('name')} />
                {errors.name && (
                  <p className="text-sm text-red-500">{errors.name.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Código de Barras</Label>
                <div className="flex gap-2">
                  <Input {...register('barcode')} />
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="icon"
                    onClick={() => setScannerOpen(true)}
                  >
                    <Scan className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Descripción</Label>
              <Input {...register('description')} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tipo *</Label>
                <Select
                  value={watch('type')}
                  onValueChange={(v: 'A' | 'B' | 'C' | 'D') => setValue('type', v)}
                >
                  <SelectTrigger>
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
                <Label>Unidad *</Label>
                <Input {...register('unit')} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Precio de Costo *</Label>
                <Input
                  type="number"
                  step="0.01"
                  {...register('cost_price', { valueAsNumber: true })}
                />
              </div>
              <div className="space-y-2">
                <Label>Precio de Venta *</Label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    step="0.01"
                    {...register('sale_price', { valueAsNumber: true })}
                  />
                </div>
              </div>
            </div>

            {suggestedPrice > 0 && (
              <div className="p-3 bg-blue-50 rounded-lg flex items-center justify-between">
                <div>
                  <p className="text-sm text-blue-700">
                    Precio sugerido ({productType === 'A' ? '1.4x' : productType === 'B' ? '1.6x' : productType === 'C' ? '1.5x' : '2.0x'}):
                  </p>
                  <p className="text-lg font-bold text-blue-800">
                    {formatCurrency(suggestedPrice)}
                  </p>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={applySuggestedPrice}>
                  Aplicar
                </Button>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Stock Actual *</Label>
                <Input
                  type="number"
                  {...register('stock', { valueAsNumber: true })}
                />
              </div>
              <div className="space-y-2">
                <Label>Stock Mínimo *</Label>
                <Input
                  type="number"
                  {...register('min_stock', { valueAsNumber: true })}
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Switch
                checked={watch('is_active')}
                onCheckedChange={(v) => setValue('is_active', v)}
              />
              <Label>Producto activo</Label>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? 'Guardando...' : editingProduct ? 'Guardar Cambios' : 'Crear Producto'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Import Preview Dialog */}
      <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Vista Previa de Importación</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            {importErrors.length > 0 && (
              <div className="p-4 bg-red-50 rounded-lg">
                <p className="font-medium text-red-800 mb-2">Errores encontrados:</p>
                <ul className="text-sm text-red-600 space-y-1 max-h-32 overflow-y-auto">
                  {importErrors.map((err, idx) => (
                    <li key={idx}>{err}</li>
                  ))}
                </ul>
              </div>
            )}
            
            <div>
              <p className="text-sm text-gray-600 mb-2">
                Productos válidos para importar: <strong>{importPreview.length}</strong>
              </p>
              <div className="max-h-64 overflow-y-auto border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nombre</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Stock</TableHead>
                      <TableHead>Precio</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {importPreview.slice(0, 10).map((product, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="text-sm">{product.name}</TableCell>
                        <TableCell>
                          <Badge className={`${getProductTypeColor(product.type)} text-white text-xs`}>
                            {product.type}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">{product.stock}</TableCell>
                        <TableCell className="text-sm">${product.sale_price}</TableCell>
                      </TableRow>
                    ))}
                    {importPreview.length > 10 && (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-gray-500 text-sm">
                          ... y {importPreview.length - 10} productos más
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => setImportDialogOpen(false)}
              className="w-full sm:w-auto"
            >
              Cancelar
            </Button>
            <Button 
              onClick={handleImportConfirm} 
              disabled={importing || importPreview.length === 0}
              className="w-full sm:w-auto"
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
        </DialogContent>
      </Dialog>

      {/* Barcode Scanner */}
      <BarcodeScanner
        isOpen={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScan={handleScanBarcode}
      />
    </div>
  );
}