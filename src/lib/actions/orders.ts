'use server';

// Server Actions para órdenes de trabajo
// TODO: Implementar integración con backend

import { WorkOrder } from '@/types/database';

export async function getWorkOrders(branchId: string): Promise<WorkOrder[]> {
  // TODO: Implementar obtención real de órdenes
  throw new Error('No implementado');
}

export async function createWorkOrder(data: Omit<WorkOrder, 'id' | 'created_at'>): Promise<WorkOrder> {
  // TODO: Implementar creación real de orden
  throw new Error('No implementado');
}

export async function updateWorkOrderStatus(
  orderId: string,
  status: 'pending' | 'in_progress' | 'completed' | 'delivered'
): Promise<void> {
  // TODO: Implementar actualización de estado
  throw new Error('No implementado');
}

export async function assignMechanic(orderId: string, mechanicId: string): Promise<void> {
  // TODO: Implementar asignación de mecánico
  throw new Error('No implementado');
}
