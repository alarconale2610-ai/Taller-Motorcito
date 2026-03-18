'use client';

import { useState, useMemo, useEffect } from 'react';
import { Search, Plus, Edit2, Trash2, Car, User, Phone, Mail, DollarSign, Loader2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import { useBranchStore } from '@/store/useBranchStore';
import { Customer, Vehicle } from '@/types/database';
import { 
  getCustomers, 
  createCustomer, 
  updateCustomer, 
  deleteCustomer,
  createVehicle,
  deleteVehicle 
} from '@/lib/actions/customers';
import { formatCurrency } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';

const customerSchema = z.object({
  name: z.string().min(1, 'Nombre requerido'),
  phone: z.string().optional(),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
});

const vehicleSchema = z.object({
  plate: z.string().min(1, 'Placa requerida'),
  brand: z.string().min(1, 'Marca requerida'),
  model: z.string().min(1, 'Modelo requerido'),
  year: z.number().min(1900).max(new Date().getFullYear() + 1).optional(),
  color: z.string().optional(),
  current_km: z.number().min(0).default(0),
});

type CustomerForm = z.infer<typeof customerSchema>;
type VehicleForm = z.infer<typeof vehicleSchema>;

export default function CustomersPage() {
  const { selectedBranch } = useBranchStore();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [customerDialogOpen, setCustomerDialogOpen] = useState(false);
  const [vehicleDialogOpen, setVehicleDialogOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const {
    register: registerCustomer,
    handleSubmit: handleSubmitCustomer,
    reset: resetCustomer,
    formState: { errors: customerErrors },
  } = useForm<CustomerForm>({
    resolver: zodResolver(customerSchema),
  });

  const {
    register: registerVehicle,
    handleSubmit: handleSubmitVehicle,
    reset: resetVehicle,
    formState: { errors: vehicleErrors },
  } = useForm<VehicleForm>({
    resolver: zodResolver(vehicleSchema),
    defaultValues: {
      current_km: 0,
    },
  });

  // Cargar clientes reales
  useEffect(() => {
    async function loadCustomers() {
      if (!selectedBranch) {
        setCustomers([]);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const data = await getCustomers(selectedBranch.id);
        setCustomers(data);
      } catch (error) {
        toast({
          title: 'Error',
          description: error instanceof Error ? error.message : 'Error al cargar clientes',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    }

    loadCustomers();
  }, [selectedBranch]);

  const filteredCustomers = useMemo(() => {
    return customers.filter(
      (customer) =>
        customer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        customer.phone?.includes(searchQuery) ||
        customer.email?.includes(searchQuery)
    );
  }, [customers, searchQuery]);

  const stats = useMemo(() => {
    const totalVehicles = customers.reduce((sum, c) => sum + (c.vehicles?.length || 0), 0);
    return {
      totalCustomers: customers.length,
      totalVehicles,
      totalSpent: customers.reduce((sum, c) => sum + (c.total_spent || 0), 0),
    };
  }, [customers]);

  const handleOpenCustomerDialog = (customer?: Customer) => {
    if (customer) {
      setEditingCustomer(customer);
      resetCustomer({
        name: customer.name,
        phone: customer.phone || '',
        email: customer.email || '',
      });
    } else {
      setEditingCustomer(null);
      resetCustomer({
        name: '',
        phone: '',
        email: '',
      });
    }
    setCustomerDialogOpen(true);
  };

  const onSubmitCustomer = async (data: CustomerForm) => {
    if (!selectedBranch) return;
    
    setSubmitting(true);
    try {
      if (editingCustomer) {
        const updated = await updateCustomer(editingCustomer.id, data);
        setCustomers((prev) =>
          prev.map((c) => (c.id === updated.id ? { ...updated, vehicles: c.vehicles } : c))
        );
        toast({ title: 'Cliente actualizado correctamente' });
      } else {
        const newCustomer = await createCustomer({
          ...data,
          branch_id: selectedBranch.id,
        });
        setCustomers((prev) => [...prev, { ...newCustomer, vehicles: [] }]);
        toast({ title: 'Cliente creado correctamente' });
      }
      setCustomerDialogOpen(false);
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Error al guardar',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteCustomer = async (customerId: string) => {
    if (!confirm('¿Está seguro de eliminar este cliente? Se eliminarán también sus vehículos.')) return;

    try {
      await deleteCustomer(customerId);
      setCustomers((prev) => prev.filter((c) => c.id !== customerId));
      toast({ title: 'Cliente eliminado correctamente' });
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Error al eliminar',
        variant: 'destructive',
      });
    }
  };

  const handleOpenVehicleDialog = (customer: Customer) => {
    setSelectedCustomer(customer);
    resetVehicle({
      plate: '',
      brand: '',
      model: '',
      year: new Date().getFullYear(),
      color: '',
      current_km: 0,
    });
    setVehicleDialogOpen(true);
  };

  const onSubmitVehicle = async (data: VehicleForm) => {
    if (!selectedCustomer) return;
    
    setSubmitting(true);
    try {
      const newVehicle = await createVehicle({
        ...data,
        customer_id: selectedCustomer.id,
      });
      
      setCustomers((prev) =>
        prev.map((c) =>
          c.id === selectedCustomer.id
            ? { ...c, vehicles: [...(c.vehicles || []), newVehicle] }
            : c
        )
      );
      
      toast({ title: 'Vehículo agregado correctamente' });
      setVehicleDialogOpen(false);
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Error al guardar vehículo',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteVehicle = async (vehicleId: string, customerId: string) => {
    if (!confirm('¿Está seguro de eliminar este vehículo?')) return;

    try {
      await deleteVehicle(vehicleId);
      setCustomers((prev) =>
        prev.map((c) =>
          c.id === customerId
            ? { ...c, vehicles: c.vehicles?.filter((v) => v.id !== vehicleId) || [] }
            : c
        )
      );
      toast({ title: 'Vehículo eliminado correctamente' });
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Error al eliminar',
        variant: 'destructive',
      });
    }
  };

  if (!selectedBranch) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-gray-500">Seleccione una sucursal para ver los clientes</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Clientes</h1>
          <p className="text-gray-500">Gestión de clientes y sus vehículos</p>
        </div>
        <Button onClick={() => handleOpenCustomerDialog()}>
          <Plus className="h-4 w-4 mr-2" />
          Nuevo Cliente
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              Total Clientes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalCustomers}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              Total Vehículos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{stats.totalVehicles}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              Total Gastado
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(stats.totalSpent)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          placeholder="Buscar clientes..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Customers List */}
      <div className="space-y-4">
        {loading ? (
          <div className="text-center py-8">
            <Loader2 className="h-6 w-6 animate-spin mx-auto text-gray-400" />
            <p className="text-sm text-gray-500 mt-2">Cargando clientes...</p>
          </div>
        ) : filteredCustomers.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No se encontraron clientes
          </div>
        ) : (
          filteredCustomers.map((customer) => (
            <Card key={customer.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                      <User className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{customer.name}</CardTitle>
                      <div className="flex items-center gap-4 text-sm text-gray-500 mt-1">
                        {customer.phone && (
                          <span className="flex items-center gap-1">
                            <Phone className="h-3 w-3" />
                            {customer.phone}
                          </span>
                        )}
                        {customer.email && (
                          <span className="flex items-center gap-1">
                            <Mail className="h-3 w-3" />
                            {customer.email}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="flex items-center gap-1">
                      <DollarSign className="h-3 w-3" />
                      {formatCurrency(customer.total_spent || 0)}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleOpenCustomerDialog(customer)}
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeleteCustomer(customer.id)}
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="vehicles" className="w-full">
                  <TabsList>
                    <TabsTrigger value="vehicles" className="flex items-center gap-2">
                      <Car className="h-4 w-4" />
                      Vehículos ({customer.vehicles?.length || 0})
                    </TabsTrigger>
                  </TabsList>
                  <TabsContent value="vehicles">
                    <div className="space-y-2">
                      {customer.vehicles && customer.vehicles.length > 0 ? (
                        customer.vehicles.map((vehicle) => (
                          <div
                            key={vehicle.id}
                            className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                          >
                            <div className="flex items-center gap-3">
                              <Car className="h-5 w-5 text-gray-400" />
                              <div>
                                <p className="font-medium">
                                  {vehicle.brand} {vehicle.model} ({vehicle.year})
                                </p>
                                <p className="text-sm text-gray-500">
                                  Placa: {vehicle.plate} | Color: {vehicle.color || 'N/A'} | KM: {vehicle.current_km?.toLocaleString()}
                                </p>
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteVehicle(vehicle.id, customer.id)}
                            >
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          </div>
                        ))
                      ) : (
                        <p className="text-gray-500 text-center py-4">
                          No hay vehículos registrados
                        </p>
                      )}
                      <Button
                        variant="outline"
                        className="w-full mt-2"
                        onClick={() => handleOpenVehicleDialog(customer)}
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Agregar Vehículo
                      </Button>
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Customer Dialog */}
      <Dialog open={customerDialogOpen} onOpenChange={setCustomerDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingCustomer ? 'Editar Cliente' : 'Nuevo Cliente'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmitCustomer(onSubmitCustomer)} className="space-y-4">
            <div className="space-y-2">
              <Label>Nombre *</Label>
              <Input {...registerCustomer('name')} placeholder="Juan Pérez" />
              {customerErrors.name && (
                <p className="text-sm text-red-500">{customerErrors.name.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Teléfono</Label>
              <Input {...registerCustomer('phone')} placeholder="0991234567" />
            </div>

            <div className="space-y-2">
              <Label>Email</Label>
              <Input {...registerCustomer('email')} placeholder="cliente@email.com" />
              {customerErrors.email && (
                <p className="text-sm text-red-500">{customerErrors.email.message}</p>
              )}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCustomerDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {editingCustomer ? 'Guardar Cambios' : 'Crear Cliente'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Vehicle Dialog */}
      <Dialog open={vehicleDialogOpen} onOpenChange={setVehicleDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Agregar Vehículo</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmitVehicle(onSubmitVehicle)} className="space-y-4">
            <div className="space-y-2">
              <Label>Placa *</Label>
              <Input {...registerVehicle('plate')} placeholder="ABC-1234" />
              {vehicleErrors.plate && (
                <p className="text-sm text-red-500">{vehicleErrors.plate.message}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Marca *</Label>
                <Input {...registerVehicle('brand')} placeholder="Toyota" />
                {vehicleErrors.brand && (
                  <p className="text-sm text-red-500">{vehicleErrors.brand.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Modelo *</Label>
                <Input {...registerVehicle('model')} placeholder="Corolla" />
                {vehicleErrors.model && (
                  <p className="text-sm text-red-500">{vehicleErrors.model.message}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Año</Label>
                <Input 
                  type="number" 
                  {...registerVehicle('year', { valueAsNumber: true })} 
                  placeholder="2024" 
                />
              </div>
              <div className="space-y-2">
                <Label>Color</Label>
                <Input {...registerVehicle('color')} placeholder="Rojo" />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Kilometraje Actual</Label>
              <Input 
                type="number" 
                {...registerVehicle('current_km', { valueAsNumber: true })} 
                placeholder="0" 
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setVehicleDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Agregar Vehículo
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}