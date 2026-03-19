'use client';

import { useState, useMemo, useEffect } from 'react';
import { Search, Plus, Minus, Trash2, ShoppingCart, Banknote, Loader2 } from 'lucide-react';
import { motion, AnimatePresence, Variants } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
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
import { Checkbox } from '@/components/ui/checkbox';
import { useBranchStore } from '@/store/useBranchStore';
import { useAuthStore } from '@/store/useAuthStore';
import { useCartStore } from '@/store/useCartStore';
import { getProducts } from '@/lib/actions/products';
import { getWorkers } from '@/lib/actions/workers';
import { getCustomers } from '@/lib/actions/customers';
import { createSale } from '@/lib/actions/sales';
import { createConsumption } from '@/lib/actions/consumptions';
import { getBranchConfig } from '@/lib/actions/branches';
import {
  formatCurrency,
  getProductTypeColor,
  getProductTypeLabel,
} from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { Product, BranchConfig, Worker, Customer } from '@/types/database';
import { SaleReceiptPreview } from '@/components/SaleReceiptPreview';

type PaymentMethod = 'cash' | 'transfer';

// Variantes suaves consistentes con el dashboard
const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.03,
      delayChildren: 0.1,
    },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.3,
      ease: [0.4, 0, 0.2, 1],
    },
  },
};

export default function POSPage() {
  const { selectedBranch } = useBranchStore();
  const { user } = useAuthStore();
  const { items, addItem, removeItem, updateQuantity, clearCart, getItemQuantity, getSubtotal, getIva, getTotal, setIvaRate } = useCartStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<'all' | 'A' | 'B' | 'C' | 'D'>('all');
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [customerName, setCustomerName] = useState('Cliente General');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [cashReceived, setCashReceived] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingSale, setProcessingSale] = useState(false);
  const [isInternalConsumption, setIsInternalConsumption] = useState(false);
  const [selectedWorkerId, setSelectedWorkerId] = useState('');
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [lastSaleData, setLastSaleData] = useState<any>(null);
  const [branchConfig, setBranchConfig] = useState<BranchConfig | null>(null);

  useEffect(() => {
    async function loadData() {
      if (!selectedBranch) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const [productsData, configData, workersData, customersData] = await Promise.all([
          getProducts(selectedBranch.id),
          getBranchConfig(selectedBranch.id),
          getWorkers(selectedBranch.id),
          getCustomers(selectedBranch.id)
        ]);

        const activeProducts = productsData.filter((p: Product) => p.is_active);
        setProducts(activeProducts);
        setWorkers(workersData);
        setCustomers(customersData);
        setBranchConfig(configData);

        if (configData?.iva_percent !== undefined) {
          setIvaRate(configData.iva_percent / 100);
        }
      } catch (error: any) {
        toast({
          title: 'Error',
          description: 'No se pudieron cargar los datos: ' + error.message,
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [selectedBranch, setIvaRate]);

  const refreshProducts = async () => {
    if (!selectedBranch) return;
    try {
      const productsData = await getProducts(selectedBranch.id);
      const activeProducts = productsData.filter((p: Product) => p.is_active);
      setProducts(activeProducts);
    } catch (error) {
      console.error('Error actualizando productos:', error);
    }
  };

  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      const matchesSearch =
        product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        product.barcode?.includes(searchQuery);
      const matchesType = selectedType === 'all' || product.type === selectedType;
      return matchesSearch && matchesType;
    });
  }, [products, searchQuery, selectedType]);

  const subtotal = getSubtotal();
  const iva = getIva();
  const total = getTotal();
  const ivaPercent = branchConfig?.iva_percent ?? 15;

  const handleAddToCart = (product: Product) => {
    if (!product.is_active || product.stock <= 0) {
      toast({
        title: 'Sin stock',
        description: 'Este producto no tiene stock disponible',
        variant: 'destructive',
      });
      return;
    }

    const qtyInCart = getItemQuantity(product.id);
    if (qtyInCart >= product.stock) {
      toast({
        title: 'Stock máximo alcanzado',
        description: `No hay más unidades disponibles. Stock: ${product.stock}`,
        variant: 'destructive',
      });
      return;
    }

    addItem(product, qtyInCart);
    toast({
      title: 'Producto agregado',
      description: `${product.name} x1 agregado al carrito`,
    });
  };

  const handleCompleteSale = async () => {
    if (!user || !selectedBranch) return;

    if (isInternalConsumption) {
      if (!selectedWorkerId) {
        toast({ title: 'Error', description: 'Seleccione un trabajador', variant: 'destructive' });
        return;
      }

      try {
        setProcessingSale(true);
        for (const item of items) {
          await createConsumption({
            worker_id: selectedWorkerId,
            product_id: item.product_id,
            quantity: item.quantity,
            unit_price: item.unit_price,
            total: item.total,
            status: 'pending',
            notes: `Registrado desde POS - Producto: ${item.product_name}`,
          }, user.id);
        }

        toast({ title: 'Éxito', description: 'Consumos registrados correctamente' });
        resetForm();
        setCheckoutOpen(false);
        await refreshProducts();
      } catch (error: any) {
        toast({ title: 'Error', description: error.message, variant: 'destructive' });
      } finally {
        setProcessingSale(false);
      }
      return;
    }

    const cashReceivedNum = paymentMethod === 'cash' ? parseFloat(cashReceived || '0') : 0;
    const changeAmount = paymentMethod === 'cash' ? cashReceivedNum - total : 0;

    if (paymentMethod === 'cash' && cashReceivedNum < total) {
      toast({ title: 'Error', description: 'Efectivo insuficiente', variant: 'destructive' });
      return;
    }

    try {
      setProcessingSale(true);
      const currentItems = [...items];
      const currentSubtotal = subtotal;
      const currentIva = iva;
      const currentTotal = total;

      const result = await createSale({
        branch_id: selectedBranch.id,
        user_id: user.id,
        customer_name: customerName,
        items: items.map(item => ({
          product_id: item.product_id,
          product_name: item.product_name,
          product_type: item.product_type,
          quantity: item.quantity,
          unit_price: item.unit_price,
          total: item.total
        })),
        payment_method: paymentMethod,
        subtotal: subtotal,
        iva_amount: iva,
        total: total,
      });

      toast({ title: '¡Venta exitosa!', description: `Documento ${result.documentNumber} generado` });

      setLastSaleData({
        documentNumber: result.documentNumber,
        saleDate: new Date().toISOString(),
        change: changeAmount,
        cashReceived: cashReceivedNum,
        documentType: 'NOTA DE VENTA',
        items: currentItems,
        subtotal: currentSubtotal,
        iva: currentIva,
        total: currentTotal,
        paymentMethod: paymentMethod,
        customerName: customerName,
      });

      resetForm();
      setCheckoutOpen(false);
      setReceiptOpen(true);
      await refreshProducts();

    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setProcessingSale(false);
    }
  };

  const resetForm = () => {
    clearCart();
    setCashReceived('');
    setCustomerName('Cliente General');
    setIsInternalConsumption(false);
    setSelectedWorkerId('');
    setPaymentMethod('cash');
  };

  const handleNewSale = () => {
    resetForm();
    setReceiptOpen(false);
    setLastSaleData(null);
  };

  const getProductById = (productId: string) => {
    return products.find(p => p.id === productId);
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
          <p className="text-gray-400 text-sm">Cargando productos...</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-8rem)] flex gap-4">
      {/* Área de Productos */}
      <div className="flex-1 flex flex-col">
        <motion.div 
          className="mb-4 space-y-4"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-semibold text-gray-800">Punto de Venta</h1>
            <Badge variant="secondary" className="bg-slate-100 text-slate-700 font-normal">
              {selectedBranch?.branch_config?.business_name || selectedBranch?.name}
            </Badge>
          </div>

          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Buscar por nombre o código..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-white border-gray-200"
              />
            </div>
            <Select value={selectedType} onValueChange={(v: any) => setSelectedType(v)}>
              <SelectTrigger className="w-[140px] bg-white border-gray-200">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="A">Tipo A</SelectItem>
                <SelectItem value="B">Tipo B</SelectItem>
                <SelectItem value="C">Tipo C</SelectItem>
                <SelectItem value="D">Tipo D</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </motion.div>

        <ScrollArea className="flex-1">
          <motion.div 
            className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 pb-4"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            <AnimatePresence mode='popLayout'>
              {filteredProducts.map((product) => {
                const qtyInCart = getItemQuantity(product.id);
                const isMaxStock = qtyInCart >= product.stock;
                const isOutOfStock = product.stock === 0;
                const isLowStock = product.stock <= product.min_stock && product.stock > 0;

                return (
                  <motion.div
                    key={product.id}
                    layout
                    variants={itemVariants}
                    exit={{ opacity: 0, scale: 0.95 }}
                    whileHover={{ 
                      y: isOutOfStock ? 0 : -3,
                      transition: { duration: 0.2 }
                    }}
                    onClick={() => handleAddToCart(product)}
                    className={`
                      relative cursor-pointer rounded-lg overflow-hidden border
                      ${isOutOfStock 
                        ? 'bg-red-50/50 border-red-200 opacity-70' 
                        : isLowStock
                          ? 'bg-amber-50/50 border-amber-200 hover:border-amber-300'
                          : 'bg-white border-gray-200 hover:border-gray-300 hover:shadow-md'
                      }
                      ${qtyInCart > 0 ? 'ring-1 ring-slate-400' : ''}
                      transition-all duration-200
                    `}
                  >
                    {/* Badge de SIN STOCK - sutil */}
                    {isOutOfStock && (
                      <div className="absolute inset-0 flex items-center justify-center bg-white/60 backdrop-blur-[1px] z-10">
                        <span className="bg-red-100 text-red-700 px-3 py-1 rounded-full text-xs font-medium border border-red-200">
                          Sin stock
                        </span>
                      </div>
                    )}

                    {/* Contador en la esquina - sutil */}
                    {qtyInCart > 0 && (
                      <div className="absolute -top-1 -right-1 bg-slate-700 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium shadow-sm z-20">
                        {qtyInCart}
                      </div>
                    )}

                    <div className="p-3">
                      <div className="flex justify-between items-start mb-2">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full text-white font-medium ${getProductTypeColor(product.type)}`}>
                          {getProductTypeLabel(product.type)}
                        </span>

                        <span className={`text-[10px] font-medium ${isOutOfStock ? 'text-red-600' : isLowStock ? 'text-amber-600' : 'text-emerald-600'}`}>
                          {isOutOfStock ? 'Agotado' : `${product.stock} disp.`}
                        </span>
                      </div>

                      <h3 className="font-medium text-gray-800 mb-1 line-clamp-2 min-h-[36px] text-sm leading-tight">
                        {product.name}
                      </h3>

                      <div className="flex items-baseline gap-1 mt-2">
                        <span className="text-lg font-semibold text-slate-700">
                          {formatCurrency(product.sale_price)}
                        </span>
                        <span className="text-xs text-gray-400">/{product.unit}</span>
                      </div>

                      {/* Barra de progreso sutil */}
                      {!isOutOfStock && (
                        <div className="mt-2 h-1 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${isLowStock ? 'bg-amber-400' : 'bg-emerald-400'}`}
                            style={{ width: `${Math.min((product.stock / (product.min_stock * 3)) * 100, 100)}%` }}
                          />
                        </div>
                      )}

                      {/* Indicador de "En carrito" sutil */}
                      {qtyInCart > 0 && (
                        <div className="mt-2 py-1 px-2 bg-slate-100 rounded border border-slate-200">
                          <p className="text-[10px] text-center text-slate-600">
                            En carrito: {qtyInCart} {isMaxStock && '(máx)'}
                          </p>
                        </div>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </motion.div>
        </ScrollArea>
      </div>

      {/* Carrito - Lado derecho */}
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.3, delay: 0.2 }}
        className="w-80 flex-shrink-0"
      >
        <Card className="h-full flex flex-col border-gray-200 shadow-sm">
          <CardHeader className="pb-3 border-b border-gray-100">
            <CardTitle className="flex items-center gap-2 text-base font-medium text-gray-700">
              <ShoppingCart className="h-4 w-4 text-slate-500" />
              Carrito
              {items.length > 0 && (
                <span className="bg-slate-700 text-white text-[10px] rounded-full w-5 h-5 flex items-center justify-center font-normal">
                  {items.length}
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col p-3">
            <ScrollArea className="flex-1 -mx-3 px-3">
              <AnimatePresence mode="popLayout">
                {items.length === 0 ? (
                  <motion.div
                    className="text-center text-gray-400 py-8"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.3 }}
                  >
                    <ShoppingCart className="h-10 w-10 mx-auto mb-2 opacity-20" />
                    <p className="text-sm">El carrito está vacío</p>
                  </motion.div>
                ) : (
                  <div className="space-y-2">
                    {items.map((item) => {
                      const product = getProductById(item.product_id);
                      const maxStock = product?.stock || item.quantity;

                      return (
                        <motion.div
                          key={item.product_id}
                          layout
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: 10 }}
                          transition={{ duration: 0.2 }}
                          className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg border border-slate-100"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm text-gray-700 truncate">{item.product_name}</p>
                            <p className="text-[10px] text-gray-400">
                              {formatCurrency(item.unit_price)} c/u
                            </p>
                          </div>

                          <div className="flex items-center gap-1">
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-6 w-6 border-gray-200"
                              onClick={() => updateQuantity(item.product_id, item.quantity - 1)}
                            >
                              <Minus className="h-3 w-3" />
                            </Button>

                            <span className="w-6 text-center text-sm font-medium text-gray-700">
                              {item.quantity}
                            </span>

                            <Button
                              variant="outline"
                              size="icon"
                              className="h-6 w-6 border-gray-200"
                              onClick={() => handleAddToCart(product!)}
                              disabled={item.quantity >= maxStock}
                            >
                              <Plus className="h-3 w-3" />
                            </Button>
                          </div>

                          <div className="text-right min-w-[50px]">
                            <p className="font-semibold text-sm text-slate-700">
                              {formatCurrency(item.total)}
                            </p>
                          </div>

                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-gray-400 hover:text-red-500 hover:bg-red-50"
                            onClick={() => removeItem(item.product_id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </motion.div>
                      );
                    })}
                  </div>
                )}
              </AnimatePresence>
            </ScrollArea>

            <Separator className="my-3" />

            <div className="space-y-1.5">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Subtotal:</span>
                <span className="text-gray-700">{formatCurrency(subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">IVA ({ivaPercent}%):</span>
                <span className="text-gray-700">{formatCurrency(iva)}</span>
              </div>
              <div className="flex justify-between text-base font-semibold border-t border-gray-100 pt-2 mt-2">
                <span className="text-gray-800">Total:</span>
                <span className="text-slate-700">{formatCurrency(total)}</span>
              </div>
            </div>

            <div className="mt-3 space-y-2">
              <Button
                className="w-full bg-slate-800 hover:bg-slate-700"
                size="lg"
                onClick={() => setCheckoutOpen(true)}
                disabled={items.length === 0}
              >
                <Banknote className="h-4 w-4 mr-2" />
                Procesar Venta
              </Button>
              <Button
                variant="outline"
                className="w-full border-gray-200 text-gray-600"
                onClick={clearCart}
                disabled={items.length === 0}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Limpiar
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Modal Checkout */}
      <Dialog open={checkoutOpen} onOpenChange={setCheckoutOpen}>
        <DialogContent className="sm:max-w-md border-gray-200">
          <DialogHeader>
            <DialogTitle className="text-lg font-medium text-gray-800">Finalizar Venta</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="flex items-center space-x-2 p-3 bg-slate-50 rounded-lg border border-slate-100">
              <Checkbox
                id="internal"
                checked={isInternalConsumption}
                onCheckedChange={(checked) => {
                  setIsInternalConsumption(checked as boolean);
                  if (!checked) setSelectedWorkerId('');
                }}
              />
              <Label htmlFor="internal" className="text-sm text-gray-700 cursor-pointer">
                Agregar a cuenta de trabajador
              </Label>
            </div>

            {isInternalConsumption && (
              <Select value={selectedWorkerId} onValueChange={setSelectedWorkerId}>
                <SelectTrigger className="border-gray-200">
                  <SelectValue placeholder="Seleccionar trabajador..." />
                </SelectTrigger>
                <SelectContent>
                  {workers.filter(w => w.is_active).map((worker) => (
                    <SelectItem key={worker.id} value={worker.id}>
                      {worker.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {!isInternalConsumption && (
              <>
                <div>
                  <Label className="text-sm text-gray-600 mb-1.5 block">Cliente</Label>
                  <Select onValueChange={(value) => {
                    if (value === 'general') {
                      setCustomerName('Cliente General');
                    } else {
                      const c = customers.find(x => x.id === value);
                      setCustomerName(c?.name || value);
                    }
                  }}>
                    <SelectTrigger className="border-gray-200">
                      <SelectValue placeholder="Seleccionar..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="general">Cliente General</SelectItem>
                      {customers.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-sm text-gray-600 mb-1.5 block">Método de Pago</Label>
                  <div className="flex gap-2">
                    <Button
                      variant={paymentMethod === 'cash' ? 'default' : 'outline'}
                      className={`flex-1 ${paymentMethod === 'cash' ? 'bg-slate-800' : 'border-gray-200'}`}
                      onClick={() => setPaymentMethod('cash')}
                    >
                      Efectivo
                    </Button>
                    <Button
                      variant={paymentMethod === 'transfer' ? 'default' : 'outline'}
                      className={`flex-1 ${paymentMethod === 'transfer' ? 'bg-slate-800' : 'border-gray-200'}`}
                      onClick={() => setPaymentMethod('transfer')}
                    >
                      Transferencia
                    </Button>
                  </div>
                </div>

                {paymentMethod === 'cash' && (
                  <div>
                    <Label className="text-sm text-gray-600 mb-1.5 block">Efectivo Recibido</Label>
                    <Input
                      type="number"
                      value={cashReceived}
                      onChange={(e) => setCashReceived(e.target.value)}
                      className="border-gray-200"
                      placeholder="0.00"
                    />
                    {parseFloat(cashReceived || '0') >= total && (
                      <p className="text-sm text-emerald-600 mt-1.5 font-medium">
                        Cambio: {formatCurrency(parseFloat(cashReceived || '0') - total)}
                      </p>
                    )}
                  </div>
                )}
              </>
            )}

            <div className="bg-slate-50 p-4 rounded-lg border border-slate-100 mt-4">
              <div className="flex justify-between text-base font-semibold">
                <span className="text-gray-700">Total a pagar:</span>
                <span className="text-slate-800 text-lg">{formatCurrency(total)}</span>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button 
              variant="outline" 
              onClick={() => setCheckoutOpen(false)}
              className="border-gray-200 text-gray-600"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleCompleteSale}
              disabled={processingSale || (isInternalConsumption && !selectedWorkerId)}
              className="bg-slate-800 hover:bg-slate-700"
            >
              {processingSale ? 'Procesando...' : isInternalConsumption ? 'Registrar Deuda' : 'Completar Venta'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {lastSaleData && (
        <SaleReceiptPreview
          isOpen={receiptOpen}
          onClose={() => setReceiptOpen(false)}
          onNewSale={handleNewSale}
          {...lastSaleData}
          branchConfig={branchConfig}
          userName={user?.full_name || user?.email}
          ivaPercent={ivaPercent}
        />
      )}
    </div>
  );
}