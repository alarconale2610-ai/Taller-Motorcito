'use client';

import { useState, useMemo, useEffect } from 'react';
import { Search, Plus, Minus, Trash2, ShoppingCart, Banknote, ArrowRightLeft, User, Loader2, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
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
  SelectGroup,
  SelectLabel,
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
  getStockStatusColor,
} from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { Product, BranchConfig, Worker, Customer } from '@/types/database';
import { SaleReceiptPreview } from '@/components/SaleReceiptPreview';

type PaymentMethod = 'cash' | 'transfer';

export default function POSPage() {
  const { selectedBranch } = useBranchStore();
  const { user } = useAuthStore();
  const { items, addItem, removeItem, updateQuantity, clearCart, getItemQuantity, getSubtotal, getIva, getTotal, setIvaRate } = useCartStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<'all' | 'A' | 'B' | 'C' | 'D'>('all');
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [customerName, setCustomerName] = useState('Cliente General');
  const [customerPhone, setCustomerPhone] = useState('');
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
  
  // Estado para animación de check al agregar
  const [addedProducts, setAddedProducts] = useState<Set<string>>(new Set());

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

    const added = addItem(product, qtyInCart);
    if (added) {
      // Mostrar animación de check
      setAddedProducts(prev => new Set(prev).add(product.id));
      setTimeout(() => {
        setAddedProducts(prev => {
          const next = new Set(prev);
          next.delete(product.id);
          return next;
        });
      }, 1000);

      toast({
        title: 'Producto agregado',
        description: `${product.name} x1 agregado al carrito`,
      });
    }
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
        customerPhone: customerPhone,
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
    setCustomerPhone('');
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
        >
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          >
            <Loader2 className="h-12 w-12 text-blue-600" />
          </motion.div>
          <p className="text-gray-500">Cargando productos...</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-8rem)] flex gap-4">
      {/* Área de Productos */}
      <div className="flex-1 flex flex-col">
        <div className="mb-4 space-y-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold">Punto de Venta</h1>
            <Badge variant="secondary">{selectedBranch?.name}</Badge>
          </div>

          <div className="flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Buscar por nombre o código..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={selectedType} onValueChange={(v: any) => setSelectedType(v)}>
              <SelectTrigger className="w-[140px]">
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
        </div>

        <ScrollArea className="flex-1">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 pb-4">
             <AnimatePresence mode='popLayout'>
    {filteredProducts.map((product, index) => {
      const qtyInCart = getItemQuantity(product.id);
      const isMaxStock = qtyInCart >= product.stock;
      
      return (
        <motion.div
          key={product.id}
          layout
          initial={{ opacity: 0, scale: 0.8, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.5 }}
          transition={{ 
            duration: 0.3, 
            delay: index * 0.05,
            type: "spring",
            stiffness: 300
          }}
          whileHover={{ 
            scale: product.stock > 0 ? 1.05 : 1,
            y: product.stock > 0 ? -5 : 0,
            transition: { duration: 0.2 }
          }}
          whileTap={{ scale: 0.95 }}
          onClick={() => handleAddToCart(product)}
          className={`
            relative cursor-pointer rounded-xl overflow-hidden
            ${product.stock === 0 
              ? 'bg-gradient-to-br from-red-50 to-red-100 border-2 border-red-400 shadow-[0_0_20px_rgba(239,68,68,0.3)]' 
              : 'bg-white border border-gray-200 shadow-md hover:shadow-2xl hover:border-blue-400'
            }
            ${qtyInCart > 0 ? 'ring-2 ring-blue-500 ring-offset-2' : ''}
          `}
        >
          {/* Badge de SIN STOCK con animación */}
          {product.stock === 0 && (
            <motion.div 
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: 1, scale: 1 }}
              className="absolute inset-0 flex items-center justify-center bg-red-500/10 backdrop-blur-sm z-10"
            >
              <motion.span 
                animate={{ 
                  scale: [1, 1.1, 1],
                  rotate: [0, -2, 2, 0]
                }}
                transition={{ repeat: Infinity, duration: 2 }}
                className="bg-red-600 text-white px-4 py-2 rounded-full font-bold shadow-xl border-2 border-white text-sm"
              >
                ⚠️ SIN STOCK
              </motion.span>
            </motion.div>
          )}

          {/* Contador animado en la esquina */}
          <AnimatePresence>
            {qtyInCart > 0 && (
              <motion.div
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                exit={{ scale: 0, rotate: 180 }}
                transition={{ type: "spring", stiffness: 500 }}
                className="absolute -top-2 -right-2 bg-blue-600 text-white w-8 h-8 rounded-full flex items-center justify-center font-bold shadow-lg z-20 border-2 border-white"
              >
                {qtyInCart}
              </motion.div>
            )}
          </AnimatePresence>

          <div className="p-4">
            <div className="flex justify-between items-start mb-2">
              <motion.span 
                className={`text-xs px-2 py-1 rounded-full text-white font-bold shadow-sm ${getProductTypeColor(product.type)}`}
                whileHover={{ scale: 1.1 }}
              >
                {getProductTypeLabel(product.type)}
              </motion.span>
              
              <motion.span 
                className={`text-xs font-bold ${product.stock < 5 ? 'text-red-600' : 'text-green-600'}`}
                animate={product.stock <= 3 && product.stock > 0 ? {
                  scale: [1, 1.2, 1],
                  color: ['#dc2626', '#f97316', '#dc2626']
                } : {}}
                transition={{ repeat: Infinity, duration: 1.5 }}
              >
                {product.stock === 0 ? 'Agotado' : `${product.stock} disp.`}
              </motion.span>
            </div>

            <motion.h3 
              className="font-bold text-gray-800 mb-2 line-clamp-2 min-h-[40px] text-sm"
              layoutId={`name-${product.id}`}
            >
              {product.name}
            </motion.h3>

            <motion.div 
              className="flex items-baseline gap-1"
              initial={false}
              animate={{ color: qtyInCart > 0 ? '#2563eb' : '#000' }}
            >
              <span className="text-xl font-bold text-blue-600">
                {formatCurrency(product.sale_price)}
              </span>
              <span className="text-xs text-gray-500">/{product.unit}</span>
            </motion.div>

            {/* Barra de progreso animada */}
            {product.stock > 0 && (
              <div className="mt-3 h-2 bg-gray-200 rounded-full overflow-hidden">
                <motion.div 
                  className={`h-full rounded-full ${product.stock <= product.min_stock ? 'bg-gradient-to-r from-orange-400 to-red-500' : 'bg-gradient-to-r from-green-400 to-green-600'}`}
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min((product.stock / (product.min_stock * 3)) * 100, 100)}%` }}
                  transition={{ duration: 0.8, delay: 0.2 }}
                />
              </div>
            )}

            {/* Indicador de "En carrito" */}
            <AnimatePresence>
              {qtyInCart > 0 && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-2 p-2 bg-blue-50 rounded-lg border border-blue-200"
                >
                  <p className="text-xs text-center text-blue-700 font-medium">
                    ✓ En carrito: {qtyInCart} {isMaxStock && '(máx)'}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      );
    })}
  </AnimatePresence>
          </div>
        </ScrollArea>
      </div>

      {/* Carrito */}
      <motion.div
        initial={{ x: 100, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        className="w-96"
      >
        <Card className="h-full flex flex-col">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <ShoppingCart className="h-5 w-5" />
              Carrito
              {items.length > 0 && (
                <span className="bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                  {items.length}
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col p-4">
            <ScrollArea className="flex-1 -mx-4 px-4">
              <AnimatePresence mode="popLayout">
                {items.length === 0 ? (
                  <motion.div 
                    className="text-center text-gray-500 py-8"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                  >
                    <ShoppingCart className="h-12 w-12 mx-auto mb-2 opacity-30" />
                    <p>El carrito está vacío</p>
                  </motion.div>
                ) : (
                  <div className="space-y-3">
                    {items.map((item) => {
                      const product = getProductById(item.product_id);
                      const maxStock = product?.stock || item.quantity;

                      return (
                        <motion.div
                          key={item.product_id}
                          layout
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: 20 }}
                          className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">{item.product_name}</p>
                            <p className="text-xs text-gray-500">
                              {formatCurrency(item.unit_price)} c/u
                            </p>
                          </div>
                          
                          <div className="flex items-center gap-1">
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => updateQuantity(item.product_id, item.quantity - 1)}
                            >
                              <Minus className="h-3 w-3" />
                            </Button>
                            
                            <motion.span 
                              key={item.quantity}
                              initial={{ scale: 1.3, color: '#2563eb' }}
                              animate={{ scale: 1, color: '#000' }}
                              className="w-8 text-center font-bold text-sm"
                            >
                              {item.quantity}
                            </motion.span>
                            
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => handleAddToCart(product!)}
                              disabled={item.quantity >= maxStock}
                            >
                              <Plus className="h-3 w-3" />
                            </Button>
                          </div>
                          
                          <div className="text-right min-w-[60px]">
                            <p className="font-bold text-sm text-blue-600">
                              {formatCurrency(item.total)}
                            </p>
                          </div>
                          
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-red-500 hover:text-red-700"
                            onClick={() => removeItem(item.product_id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </motion.div>
                      );
                    })}
                  </div>
                )}
              </AnimatePresence>
            </ScrollArea>

            <Separator className="my-4" />

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Subtotal:</span>
                <span>{formatCurrency(subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">IVA ({ivaPercent}%):</span>
                <span>{formatCurrency(iva)}</span>
              </div>
              <motion.div 
                className="flex justify-between text-xl font-bold border-t-2 border-blue-200 pt-2"
                key={total}
                initial={{ scale: 1.1 }}
                animate={{ scale: 1 }}
              >
                <span>Total:</span>
                <span className="text-blue-600">{formatCurrency(total)}</span>
              </motion.div>
            </div>

            <div className="mt-4 space-y-2">
              <Button
                className="w-full"
                size="lg"
                onClick={() => setCheckoutOpen(true)}
                disabled={items.length === 0}
              >
                <Banknote className="h-4 w-4 mr-2" />
                Procesar Venta ({formatCurrency(total)})
              </Button>
              <Button
                variant="outline"
                className="w-full"
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
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Finalizar Venta</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="internal"
                checked={isInternalConsumption}
                onCheckedChange={(checked) => {
                  setIsInternalConsumption(checked as boolean);
                  if (!checked) setSelectedWorkerId('');
                }}
              />
              <Label htmlFor="internal">Agregar a cuenta de trabajador</Label>
            </div>

            {isInternalConsumption && (
              <Select value={selectedWorkerId} onValueChange={setSelectedWorkerId}>
                <SelectTrigger>
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
                  <Label>Cliente</Label>
                  <Select onValueChange={(value) => {
                    if (value === 'general') {
                      setCustomerName('Cliente General');
                    } else {
                      const c = customers.find(x => x.id === value);
                      setCustomerName(c?.name || value);
                    }
                  }}>
                    <SelectTrigger>
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
                  <Label>Método de Pago</Label>
                  <div className="flex gap-2">
                    <Button
                      variant={paymentMethod === 'cash' ? 'default' : 'outline'}
                      className="flex-1"
                      onClick={() => setPaymentMethod('cash')}
                    >
                      Efectivo
                    </Button>
                    <Button
                      variant={paymentMethod === 'transfer' ? 'default' : 'outline'}
                      className="flex-1"
                      onClick={() => setPaymentMethod('transfer')}
                    >
                      Transferencia
                    </Button>
                  </div>
                </div>

                {paymentMethod === 'cash' && (
                  <div>
                    <Label>Efectivo Recibido</Label>
                    <Input
                      type="number"
                      value={cashReceived}
                      onChange={(e) => setCashReceived(e.target.value)}
                    />
                    {parseFloat(cashReceived || '0') >= total && (
                      <p className="text-sm text-green-600 mt-1">
                        Cambio: {formatCurrency(parseFloat(cashReceived || '0') - total)}
                      </p>
                    )}
                  </div>
                )}
              </>
            )}

            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="flex justify-between text-lg font-bold">
                <span>Total:</span>
                <span className="text-blue-600">{formatCurrency(total)}</span>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCheckoutOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleCompleteSale}
              disabled={processingSale || (isInternalConsumption && !selectedWorkerId)}
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