'use client';

import { useState, useMemo, useEffect } from 'react';
import { Search, Building2, Package, ArrowRightLeft, Loader2 } from 'lucide-react';
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
} from '@/components/ui/dialog';
import { useBranchStore } from '@/store/useBranchStore';
import { getProducts } from '@/lib/actions/products';
import { getBranches } from '@/lib/actions/branches';
import {
  formatCurrency,
  getProductTypeColor,
  getProductTypeLabel,
  getStockStatusColor,
} from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { Product, Branch } from '@/types/database';

interface CrossStockItem {
  barcode: string | null;
  name: string;
  type: 'A' | 'B' | 'C' | 'D';
  unit: string;
  [key: string]: any; // Para las sucursales dinámicas
}

export default function CrossStockPage() {
  const { selectedBranch } = useBranchStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<CrossStockItem | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);

  // Cargar datos reales
  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const [productsData, branchesData] = await Promise.all([
          // Cargar productos de todas las sucursales
          Promise.all([
            getProducts('7ed9c7a5-c64d-4929-ba85-34be464b650a'), // Centro
            getProducts('f9c655cf-9354-4087-8a5f-b11fa13d1ed5'), // Norte
          ]).then(results => results.flat()),
          getBranches(),
        ]);
        
        setProducts(productsData);
        setBranches(branchesData);
      } catch (error) {
        toast({
          title: 'Error',
          description: 'No se pudieron cargar los datos',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    }
    
    loadData();
  }, []);

  // Build cross-stock data
  const crossStockData = useMemo(() => {
    const productMap = new Map<string, CrossStockItem>();

    products.forEach((product) => {
      const key = product.barcode || product.name;

      if (!productMap.has(key)) {
        productMap.set(key, {
          barcode: product.barcode,
          name: product.name,
          type: product.type,
          unit: product.unit,
        });
      }

      const item = productMap.get(key)!;
      const branchData = {
        id: product.id,
        stock: product.stock,
        min_stock: product.min_stock,
        sale_price: product.sale_price,
      };

      // Usar el ID de la sucursal como clave
      item[product.branch_id] = branchData;
    });

    return Array.from(productMap.values());
  }, [products]);

  const filteredData = useMemo(() => {
    return crossStockData.filter(
      (item) =>
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.barcode?.includes(searchQuery)
    );
  }, [crossStockData, searchQuery]);

  const handleViewDetails = (product: CrossStockItem) => {
    setSelectedProduct(product);
    setDialogOpen(true);
  };

  // Obtener IDs de sucursales
  const centroId = '7ed9c7a5-c64d-4929-ba85-34be464b650a';
  const norteId = 'f9c655cf-9354-4087-8a5f-b11fa13d1ed5';

  if (loading) {
    return (
      <div className="h-[calc(100vh-8rem)] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          <p className="text-gray-500">Cargando stock cruzado...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Consulta Stock Cruzado</h1>
        <p className="text-gray-500">
          Verifique disponibilidad en ambas sucursales
        </p>
      </div>

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

      {/* Cross Stock Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ArrowRightLeft className="h-5 w-5" />
            Comparativa de Stock
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Producto</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-center">
                    <span className="text-blue-600">Centro</span>
                  </TableHead>
                  <TableHead className="text-center">
                    <span className="text-green-600">Norte</span>
                  </TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredData.map((item, index) => (
                  <TableRow key={index}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{item.name}</p>
                        {item.barcode && (
                          <p className="text-xs text-gray-500">{item.barcode}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={`${getProductTypeColor(item.type)} text-white`}>
                        {getProductTypeLabel(item.type)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      {item[centroId] ? (
                        <span className={getStockStatusColor(item[centroId].stock, item[centroId].min_stock)}>
                          {item[centroId].stock} {item.unit}
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {item[norteId] ? (
                        <span className={getStockStatusColor(item[norteId].stock, item[norteId].min_stock)}>
                          {item[norteId].stock} {item.unit}
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <button
                        onClick={() => handleViewDetails(item)}
                        className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                      >
                        Ver detalles
                      </button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Product Details Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Detalles del Producto</DialogTitle>
          </DialogHeader>
          {selectedProduct && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold">{selectedProduct.name}</h3>
                {selectedProduct.barcode && (
                  <p className="text-sm text-gray-500">
                    Código: {selectedProduct.barcode}
                  </p>
                )}
                <Badge className={`${getProductTypeColor(selectedProduct.type)} text-white mt-2`}>
                  {getProductTypeLabel(selectedProduct.type)}
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Centro */}
                <Card className={selectedBranch?.id === centroId ? 'ring-2 ring-blue-500' : ''}>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-blue-600" />
                      Centro
                      {selectedBranch?.id === centroId && (
                        <Badge variant="secondary" className="text-xs">Actual</Badge>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {selectedProduct[centroId] ? (
                      <>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Stock:</span>
                          <span className={getStockStatusColor(selectedProduct[centroId].stock, selectedProduct[centroId].min_stock)}>
                            {selectedProduct[centroId].stock} {selectedProduct.unit}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Mínimo:</span>
                          <span>{selectedProduct[centroId].min_stock} {selectedProduct.unit}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Precio:</span>
                          <span className="font-medium">
                            {formatCurrency(selectedProduct[centroId].sale_price)}
                          </span>
                        </div>
                      </>
                    ) : (
                      <p className="text-gray-400 text-center py-4">
                        No disponible en esta sucursal
                      </p>
                    )}
                  </CardContent>
                </Card>

                {/* Norte */}
                <Card className={selectedBranch?.id === norteId ? 'ring-2 ring-green-500' : ''}>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-green-600" />
                      Norte
                      {selectedBranch?.id === norteId && (
                        <Badge variant="secondary" className="text-xs">Actual</Badge>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {selectedProduct[norteId] ? (
                      <>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Stock:</span>
                          <span className={getStockStatusColor(selectedProduct[norteId].stock, selectedProduct[norteId].min_stock)}>
                            {selectedProduct[norteId].stock} {selectedProduct.unit}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Mínimo:</span>
                          <span>{selectedProduct[norteId].min_stock} {selectedProduct.unit}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Precio:</span>
                          <span className="font-medium">
                            {formatCurrency(selectedProduct[norteId].sale_price)}
                          </span>
                        </div>
                      </>
                    ) : (
                      <p className="text-gray-400 text-center py-4">
                        No disponible en esta sucursal
                      </p>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Summary */}
              <div className="p-4 bg-gray-50 rounded-lg">
                <h4 className="font-medium mb-2">Resumen</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">Stock Total:</span>
                    <span className="ml-2 font-medium">
                      {((selectedProduct[centroId]?.stock || 0) + (selectedProduct[norteId]?.stock || 0))} {selectedProduct.unit}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500">Diferencia de precio:</span>
                    <span className="ml-2 font-medium">
                      {selectedProduct[centroId] && selectedProduct[norteId]
                        ? formatCurrency(Math.abs(selectedProduct[centroId].sale_price - selectedProduct[norteId].sale_price))
                        : '-'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}