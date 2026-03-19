'use client';

import { useRef, useMemo } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Edit2, Trash2 } from 'lucide-react';
import { Product } from '@/types/database';
import { formatCurrency, getProductTypeColor, getProductTypeLabel, getStockStatusColor } from '@/lib/utils';

interface InventoryTableProps {
  products: Product[];
  onEdit: (product: Product) => void;
  onDelete: (productId: string) => void;
  searchQuery: string;
}

const ROW_HEIGHT = 60; // Altura fija de cada fila en px
const OVERSCAN = 10;   // Filas extra para scroll suave

export function InventoryTable({ products, onEdit, onDelete, searchQuery }: InventoryTableProps) {
  const parentRef = useRef<HTMLDivElement>(null);

  // Filtrar productos basado en búsqueda (optimizado con useMemo)
  const filteredProducts = useMemo(() => {
    if (!searchQuery.trim()) return products;
    const query = searchQuery.toLowerCase();
    return products.filter(
      (product) =>
        product.name.toLowerCase().includes(query) ||
        product.barcode?.toLowerCase().includes(query)
    );
  }, [products, searchQuery]);

  // Configuración del virtualizador
  const rowVirtualizer = useVirtualizer({
    count: filteredProducts.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: OVERSCAN,
  });

  const virtualRows = rowVirtualizer.getVirtualItems();
  const totalSize = rowVirtualizer.getTotalSize();

  // Calcular espacios para el padding top/bottom
  const paddingTop = virtualRows.length > 0 ? virtualRows[0].start : 0;
  const paddingBottom = virtualRows.length > 0 
    ? totalSize - virtualRows[virtualRows.length - 1].end 
    : 0;

  if (filteredProducts.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        {searchQuery ? 'No se encontraron productos' : 'No hay productos en el inventario'}
      </div>
    );
  }

  return (
    <div className="border rounded-lg overflow-hidden bg-white">
      {/* Header fijo */}
      <div className="grid grid-cols-12 gap-4 px-4 py-3 bg-slate-50 border-b text-xs font-medium text-gray-500 uppercase tracking-wider">
        <div className="col-span-4">Producto</div>
        <div className="col-span-1">Tipo</div>
        <div className="col-span-1 text-center">Stock</div>
        <div className="col-span-2 text-right">Costo</div>
        <div className="col-span-2 text-right">Venta</div>
        <div className="col-span-1 text-center">Estado</div>
        <div className="col-span-1 text-right">Acciones</div>
      </div>

      {/* Cuerpo virtualizado */}
      <div 
        ref={parentRef} 
        className="overflow-auto max-h-[calc(100vh-300px)]"
        style={{ height: Math.min(filteredProducts.length * ROW_HEIGHT, 600) }}
      >
        <div style={{ height: totalSize, position: 'relative' }}>
          {/* Espaciador superior */}
          {paddingTop > 0 && (
            <div style={{ height: paddingTop }} />
          )}

          {/* Filas visibles */}
          {virtualRows.map((virtualRow) => {
            const product = filteredProducts[virtualRow.index];
            const index = virtualRow.index;

            return (
              <motion.div
                key={product.id}
                data-index={virtualRow.index}
                ref={rowVirtualizer.measureElement}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: Math.min(index * 0.01, 0.3) }}
                className="grid grid-cols-12 gap-4 px-4 py-3 border-b border-gray-50 hover:bg-slate-50/50 transition-colors items-center absolute left-0 w-full"
                style={{
                  height: ROW_HEIGHT,
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                {/* Producto */}
                <div className="col-span-4 min-w-0">
                  <p className="font-medium text-sm text-gray-800 truncate">
                    {product.name}
                  </p>
                  {product.barcode && (
                    <p className="text-xs text-gray-400 font-mono truncate">
                      {product.barcode}
                    </p>
                  )}
                </div>

                {/* Tipo */}
                <div className="col-span-1">
                  <Badge className={`${getProductTypeColor(product.type)} text-white text-xs font-normal shadow-none whitespace-nowrap`}>
                    {getProductTypeLabel(product.type)}
                  </Badge>
                </div>

                {/* Stock */}
                <div className="col-span-1 text-center">
                  <span className={`text-sm font-medium ${getStockStatusColor(product.stock, product.min_stock)}`}>
                    {product.stock}
                  </span>
                  <span className="text-gray-400 font-normal text-xs ml-1">{product.unit}</span>
                </div>

                {/* Costo */}
                <div className="col-span-2 text-right text-sm text-gray-600">
                  {formatCurrency(product.cost_price)}
                </div>

                {/* Venta */}
                <div className="col-span-2 text-right text-sm text-gray-600">
                  {formatCurrency(product.sale_price)}
                </div>

                {/* Estado */}
                <div className="col-span-1 text-center">
                  {product.is_active ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-100">
                      Activo
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">
                      Inactivo
                    </span>
                  )}
                </div>

                {/* Acciones */}
                <div className="col-span-1 text-right flex justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onEdit(product)}
                    className="h-8 w-8 text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                  >
                    <Edit2 className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onDelete(product.id)}
                    className="h-8 w-8 text-slate-400 hover:text-red-600 hover:bg-red-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </motion.div>
            );
          })}

          {/* Espaciador inferior */}
          {paddingBottom > 0 && (
            <div style={{ height: paddingBottom }} />
          )}
        </div>
      </div>

      {/* Footer info */}
      <div className="px-4 py-2 bg-slate-50 border-t text-xs text-gray-500 flex justify-between items-center">
        <span>
          Mostrando {filteredProducts.length} de {products.length} productos
          {searchQuery && ' (filtrados)'}
        </span>
        <span className="text-gray-400">
          Scroll virtualizado • Rendimiento optimizado
        </span>
      </div>
    </div>
  );
}