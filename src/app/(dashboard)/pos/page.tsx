'use client';

import { useState, useMemo, useEffect } from 'react';
import { Search, Plus, Minus, Trash2, ShoppingCart, CreditCard, Banknote, Smartphone, User, Loader2, ArrowRightLeft } from 'lucide-react';
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

export default function POSPage() {
  const { selectedBranch } = useBranchStore();
  const { user } = useAuthStore();
  const { items, addItem, removeItem, updateQuantity, clearCart, getItemQuantity, getSubtotal, getIva, getTotal, setIvaRate } = useCartStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<'all' | 'A' | 'B' | 'C' | 'D'>('all');
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [customerName, setCustomerName] = useState('Cliente General');
  const [customerId, setCustomerId] = useState('general');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'transfer'>('cash');
  const [cashReceived, setCashReceived] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingSale, setProcessingSale] = useState(false);

  const [isInternalConsumption, setIsInternalConsumption] = useState(false);
  const [selectedWorkerId, setSelectedWorkerId] = useState('');

  const [receiptOpen, setReceiptOpen] = useState(false);
  const [lastSaleData, setLastSaleData] = useState<{
    documentNumber: string;
    saleDate: string;
    change: number;
    cashReceived: number;
  } | null>(null);
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

        setProducts(productsData);
        setWorkers(workersData);
        setCustomers(customersData);
        setBranchConfig(configData);
        
        if (configData?.iva_percent !== undefined) {
          const ivaRate = configData.iva_percent / 100;
          setIvaRate(ivaRate);
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
    const qtyInCart = getItemQuantity(product.id);

    if (product.stock <= 0) {
      toast({
        title: 'Sin stock',
        description: 'Este producto no tiene stock disponible',
        variant: 'destructive',
      });
      return;
    }

    if (qtyInCart >= product.stock) {
      toast({
        title: 'Stock insuficiente',
        description: `Solo hay ${product.stock} unidades disponibles. Ya tienes ${qtyInCart} en el carrito.`,
        variant: 'destructive',
      });
      return;
    }

    const added = addItem(product, qtyInCart);
    if (!added) {
      toast({
        title: 'Stock insuficiente',
        description: `No se puede agregar mas. Stock maximo: ${product.stock}`,
        variant: 'destructive',
      });
    }
  };

  const handleIncreaseQuantity = (productId: string, currentQty: number, maxStock: number) => {
    if (currentQty >= maxStock) {
      toast({
        title: 'Stock maximo alcanzado',
        description: `No hay mas unidades disponibles. Stock: ${maxStock}`,
        variant: 'destructive',
      });
      return;
    }
    updateQuantity(productId, currentQty + 1, maxStock);
  };

  const handleCustomerSelect = (value: string) => {
    if (value === 'general') {
      setCustomerId('general');
      setCustomerName('Cliente General');
    } else {
      const selectedCustomer = customers.find(c => c.id === value);
      setCustomerId(value);
      setCustomerName(selectedCustomer?.name || value);
    }
  };

  const handleCheckout = () => {
    if (items.length === 0) return;
    setCheckoutOpen(true);
  };

  const handleCompleteSale = async () => {
    if (!user || !selectedBranch) {
      toast({
        title: 'Error',
        description: 'No hay usuario o sucursal seleccionada',
        variant: 'destructive',
      });
      return;
    }

    if (isInternalConsumption) {
      if (!selectedWorkerId) {
        toast({
          title: 'Error',
          description: 'Seleccione un trabajador para el consumo interno',
          variant: 'destructive',
        });
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

        toast({
          title: 'Consumos registrados correctamente',
          description: `Se registraron ${items.length} productos a cuenta del trabajador`,
        });

        clearCart();
        setCheckoutOpen(false);
        setIsInternalConsumption(false);
        setSelectedWorkerId('');
        
        const updatedProducts = await getProducts(selectedBranch.id);
        setProducts(updatedProducts);

      } catch (error: any) {
        toast({
          title: 'Error al registrar consumos',
          description: error.message || 'No se pudieron registrar los consumos',
          variant: 'destructive',
        });
      } finally {
        setProcessingSale(false);
      }
      return;
    }

    const cashReceivedNum = paymentMethod === 'cash' ? parseFloat(cashReceived || '0') : 0;
    const changeAmount = paymentMethod === 'cash' ? cashReceivedNum - total : 0;

    if (paymentMethod === 'cash' && cashReceivedNum < total) {
      toast({
        title: 'Error',
        description: 'El efectivo recibido es menor al total',
        variant: 'destructive',
      });
      return;
    }

    try {
      setProcessingSale(true);

      const result = await createSale({
        branch_id: selectedBranch.id,
        user_id: user.id,
        customer_name: customerName,
        customer_id: customerId === 'general' ? undefined : customerId,
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

      toast({
        title: 'Venta completada',
        description: `Documento ${result.documentNumber} creado exitosamente`,
      });

      setLastSaleData({
        documentNumber: result.documentNumber,
        saleDate: new Date().toISOString(),
        change: changeAmount,
        cashReceived: cashReceivedNum,
      });

      const updatedProducts = await getProducts(selectedBranch.id);
      setProducts(updatedProducts);

      setCheckoutOpen(false);
      setReceiptOpen(true);
    } catch (error: any) {
      toast({
        title: 'Error al completar venta',
        description: error.message || 'No se pudo procesar la venta',
        variant: 'destructive',
      });
    } finally {
      setProcessingSale(false);
    }
  };

  const handleNewSale = () => {
    clearCart();
    setReceiptOpen(false);
    setCashReceived('');
    setCustomerName('Cliente General');
    setCustomerId('general');
    setLastSaleData(null);
    setIsInternalConsumption(false);
    setSelectedWorkerId('');
  };

  const change = paymentMethod === 'cash' && cashReceived
    ? parseFloat(cashReceived) - total
    : 0;

  const getProductById = (productId: string) => {
    return products.find(p => p.id === productId);
  };

  if (loading) {
    return (
      <div className="h-[calc(100vh-8rem)] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          <p className="text-gray-500">Cargando productos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-8rem)] flex gap-4">
      <div className="flex-1 flex flex-col">
        <div className="mb-4 space-y-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold">Punto de Venta</h1>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">Sucursal:</span>
              <Badge variant="secondary">{selectedBranch?.name}</Badge>
            </div>
          </div>

          <div className="flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Buscar por nombre o codigo..."
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
            {filteredProducts.map((product) => {
              const qtyInCart = getItemQuantity(product.id);
              const isMaxStock = qtyInCart >= product.stock;

              return (
                <Card
                  key={product.id}
                  className={`cursor-pointer transition-all hover:shadow-lg ${product.stock === 0 ? 'opacity-50' : ''}`}
                  onClick={() => handleAddToCart(product)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <Badge className={`${getProductTypeColor(product.type)} text-white text-xs`}>
                        {getProductTypeLabel(product.type)}
                      </Badge>
                      <span className={`text-sm font-medium ${getStockStatusColor(product.stock, product.min_stock)}`}>
                        Stock: {product.stock}
                      </span>
                    </div>
                    <h3 className="font-medium text-sm mb-1 line-clamp-2">{product.name}</h3>
                    <p className="text-lg font-bold text-blue-600">
                      {formatCurrency(product.sale_price)}
                    </p>
                    <p className="text-xs text-gray-500">{product.unit}</p>
                    {qtyInCart > 0 && (
                      <div className="mt-2 p-1 bg-blue-50 rounded text-xs text-blue-700 text-center">
                        En carrito: {qtyInCart} {isMaxStock ? '(max)' : ''}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </ScrollArea>
      </div>

      <Card className="w-96 flex flex-col">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <ShoppingCart className="h-5 w-5" />
            Carrito
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col p-4">
          <ScrollArea className="flex-1 -mx-4 px-4">
            {items.length === 0 ? (
              <div className="text-center text-gray-500 py-8">
                <ShoppingCart className="h-12 w-12 mx-auto mb-2 opacity-30" />
                <p>El carrito esta vacio</p>
              </div>
            ) : (
              <div className="space-y-3">
                {items.map((item) => {
                  const product = getProductById(item.product_id);
                  const maxStock = product?.stock || item.quantity;
                  const isMaxReached = item.quantity >= maxStock;

                  return (
                    <div key={item.product_id} className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{item.product_name}</p>
                        <p className="text-xs text-gray-500">
                          {formatCurrency(item.unit_price)} c/u
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => updateQuantity(item.product_id, item.quantity - 1)}
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                        <span className={`w-8 text-center text-sm font-medium ${isMaxReached ? 'text-red-600' : ''}`}>
                          {item.quantity}
                        </span>
                        <Button
                          variant="outline"
                          size="icon"
                          className={`h-7 w-7 ${isMaxReached ? 'opacity-50 cursor-not-allowed' : ''}`}
                          onClick={() => handleIncreaseQuantity(item.product_id, item.quantity, maxStock)}
                          disabled={isMaxReached}
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                      <div className="text-right min-w-[60px]">
                        <p className="font-medium text-sm">{formatCurrency(item.total)}</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-red-500"
                        onClick={() => removeItem(item.product_id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
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
            <div className="flex justify-between text-lg font-bold">
              <span>Total:</span>
              <span className="text-blue-600">{formatCurrency(total)}</span>
            </div>
          </div>

          <div className="mt-4 space-y-2">
            <Button
              className="w-full"
              size="lg"
              onClick={handleCheckout}
              disabled={items.length === 0}
            >
              <CreditCard className="h-4 w-4 mr-2" />
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

      <Dialog open={checkoutOpen} onOpenChange={setCheckoutOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Finalizar Venta</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg space-y-3">
              <div className="flex items-start space-x-2">
                <Checkbox
                  id="internal"
                  checked={isInternalConsumption}
                  onCheckedChange={(checked) => {
                    setIsInternalConsumption(checked as boolean);
                    if (!checked) setSelectedWorkerId('');
                  }}
                />
                <div className="grid gap-1.5 leading-none">
                  <Label
                    htmlFor="internal"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-yellow-900"
                  >
                    Agregar a cuenta de trabajador (Consumo Interno)
                  </Label>
                  <p className="text-xs text-yellow-700">
                    El trabajador pagará después. Se descontará del stock inmediatamente.
                  </p>
                </div>
              </div>

              {isInternalConsumption && (
                <div className="pt-2">
                  <Label className="text-xs mb-1.5 block">Seleccionar Trabajador *</Label>
                  <Select value={selectedWorkerId} onValueChange={setSelectedWorkerId}>
                    <SelectTrigger className="bg-white">
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
                  {!selectedWorkerId && (
                    <p className="text-xs text-red-500 mt-1">Debe seleccionar un trabajador</p>
                  )}
                </div>
              )}
            </div>

            {!isInternalConsumption && (
              <>
                <div className="space-y-2">
                  <Label>Cliente</Label>
                  <Select value={customerId} onValueChange={handleCustomerSelect}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar cliente..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectLabel>Consumidor Final</SelectLabel>
                        <SelectItem value="general">
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4" />
                            <span>Cliente General</span>
                          </div>
                        </SelectItem>
                      </SelectGroup>
                      
                      {customers.length > 0 && (
                        <SelectGroup>
                          <SelectLabel>Clientes Registrados</SelectLabel>
                          {customers.map((customer) => (
                            <SelectItem key={customer.id} value={customer.id}>
                              <div className="flex flex-col">
                                <span>{customer.name}</span>
                                {customer.phone && (
                                  <span className="text-xs text-gray-500">{customer.phone}</span>
                                )}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Metodo de Pago</Label>
                  <div className="grid grid-cols-3 gap-2">
                    <Button
                      variant={paymentMethod === 'cash' ? 'default' : 'outline'}
                      className="flex flex-col items-center py-3"
                      onClick={() => setPaymentMethod('cash')}
                    >
                      <Banknote className="h-5 w-5 mb-1" />
                      <span className="text-xs">Efectivo</span>
                    </Button>
                    <Button
                      variant={paymentMethod === 'card' ? 'default' : 'outline'}
                      className="flex flex-col items-center py-3"
                      onClick={() => setPaymentMethod('card')}
                    >
                      <CreditCard className="h-5 w-5 mb-1" />
                      <span className="text-xs">Tarjeta</span>
                    </Button>
                    <Button
                      variant={paymentMethod === 'transfer' ? 'default' : 'outline'}
                      className="flex flex-col items-center py-3"
                      onClick={() => setPaymentMethod('transfer')}
                    >
                      <ArrowRightLeft className="h-5 w-5 mb-1" />
                      <span className="text-xs">Transferencia</span>
                    </Button>
                  </div>
                </div>

                {paymentMethod === 'cash' && (
                  <div className="space-y-2">
                    <Label>Efectivo Recibido</Label>
                    <Input
                      type="number"
                      placeholder="0.00"
                      value={cashReceived}
                      onChange={(e) => setCashReceived(e.target.value)}
                    />
                    {change >= 0 && parseFloat(cashReceived || '0') > 0 && (
                      <div className="p-3 bg-green-50 rounded-lg">
                        <p className="text-sm text-green-700">
                          Cambio: <strong>{formatCurrency(change)}</strong>
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}

            <div className="p-4 bg-gray-50 rounded-lg space-y-2">
              <div className="flex justify-between text-sm">
                <span>Subtotal:</span>
                <span>{formatCurrency(subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>IVA ({ivaPercent}%):</span>
                <span>{formatCurrency(iva)}</span>
              </div>
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
              disabled={
                processingSale || 
                items.length === 0 ||
                (isInternalConsumption && !selectedWorkerId) ||
                (!isInternalConsumption && paymentMethod === 'cash' && (!cashReceived || parseFloat(cashReceived || '0') < total))
              }
            >
              {processingSale ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Procesando...
                </>
              ) : (
                isInternalConsumption ? 'Registrar Deuda' : 'Completar Venta'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {lastSaleData && (
        <SaleReceiptPreview
          isOpen={receiptOpen}
          onClose={() => setReceiptOpen(false)}
          onNewSale={handleNewSale}
          documentNumber={lastSaleData.documentNumber}
          items={items}
          subtotal={subtotal}
          iva={iva}
          total={total}
          paymentMethod={paymentMethod}
          cashReceived={lastSaleData.cashReceived}
          change={lastSaleData.change}
          customerName={customerName}
          branchConfig={branchConfig}
          userName={user?.full_name || user?.email}
          saleDate={lastSaleData.saleDate}
        />
      )}
    </div>
  );
}