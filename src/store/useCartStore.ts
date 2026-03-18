import { create } from 'zustand';
import { CartItem, Product } from '@/types/database';

interface CartState {
  items: CartItem[];
  ivaRate: number; // Nuevo: IVA dinámico
  addItem: (product: Product, currentQtyInCart?: number) => boolean;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number, maxStock?: number) => boolean;
  clearCart: () => void;
  getItemQuantity: (productId: string) => number;
  getSubtotal: () => number;
  getIva: () => number;
  getTotal: () => number;
  setIvaRate: (rate: number) => void; // Nuevo: setter
}

export const useCartStore = create<CartState>((set, get) => ({
  items: [],
  ivaRate: 0.15, // Default 15% hasta que se cargue la config

  setIvaRate: (rate: number) => set({ ivaRate: rate }),

  addItem: (product: Product, currentQtyInCart: number = 0) => {
    const qtyInCart = currentQtyInCart || get().getItemQuantity(product.id);

    if (qtyInCart >= product.stock) {
      return false;
    }

    const items = get().items;
    const existingItem = items.find(item => item.product_id === product.id);

    if (existingItem) {
      const newQuantity = existingItem.quantity + 1;
      const updatedItems = items.map(item =>
        item.product_id === product.id
          ? {
              ...item,
              quantity: newQuantity,
              total: newQuantity * item.unit_price,
            }
          : item
      );
      set({ items: updatedItems });
    } else {
      const newItem: CartItem = {
        product_id: product.id,
        product_name: product.name,
        product_type: product.type,
        quantity: 1,
        unit_price: product.sale_price,
        total: product.sale_price,
      };
      set({ items: [...items, newItem] });
    }
    return true;
  },

  removeItem: (productId: string) => {
    set({ items: get().items.filter(item => item.product_id !== productId) });
  },

  updateQuantity: (productId: string, quantity: number, maxStock?: number) => {
    if (quantity <= 0) {
      get().removeItem(productId);
      return true;
    }

    if (maxStock !== undefined && quantity > maxStock) {
      return false;
    }

    const updatedItems = get().items.map(item =>
      item.product_id === productId
        ? { ...item, quantity, total: quantity * item.unit_price }
        : item
    );
    set({ items: updatedItems });
    return true;
  },

  clearCart: () => set({ items: [] }),

  getItemQuantity: (productId: string) => {
    const item = get().items.find(i => i.product_id === productId);
    return item ? item.quantity : 0;
  },

  getSubtotal: () => {
    return get().items.reduce((sum, item) => sum + (item.total || 0), 0);
  },

  getIva: () => {
    return get().getSubtotal() * get().ivaRate; // Usa el ivaRate dinámico
  },

  getTotal: () => {
    return get().getSubtotal() + get().getIva();
  },
}));