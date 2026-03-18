import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

export function getProductTypeColor(type: 'A' | 'B' | 'C' | 'D'): string {
  const colors = {
    A: 'bg-blue-500',
    B: 'bg-green-500',
    C: 'bg-purple-500',
    D: 'bg-orange-500',
  };
  return colors[type];
}

export function getProductTypeLabel(type: 'A' | 'B' | 'C' | 'D'): string {
  const labels = {
    A: 'Tipo A',
    B: 'Tipo B',
    C: 'Tipo C',
    D: 'Tipo D',
  };
  return labels[type];
}

export function getWorkOrderStatusColor(status: 'pending' | 'in_progress' | 'completed' | 'delivered'): string {
  const colors = {
    pending: 'bg-yellow-500',
    in_progress: 'bg-blue-500',
    completed: 'bg-green-500',
    delivered: 'bg-gray-500',
  };
  return colors[status];
}

export function getWorkOrderStatusLabel(status: 'pending' | 'in_progress' | 'completed' | 'delivered'): string {
  const labels = {
    pending: 'Pendiente',
    in_progress: 'En Proceso',
    completed: 'Completado',
    delivered: 'Entregado',
  };
  return labels[status];
}

export function getStockStatusColor(stock: number, minStock: number): string {
  if (stock === 0) return 'text-red-500';
  if (stock < minStock) return 'text-yellow-500';
  return 'text-green-500';
}

export function calculateSuggestedPrice(costPrice: number, type: 'A' | 'B' | 'C' | 'D'): number {
  const multipliers = {
    A: 1.4,
    B: 1.6,
    C: 1.5,
    D: 2.0,
  };
  return costPrice * multipliers[type];
}
