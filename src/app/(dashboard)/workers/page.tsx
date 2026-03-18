'use client';

import { useState, useMemo, useEffect } from 'react';
import { Search, Plus, Edit2, Trash2, UserCog, Phone, Loader2, Mail, Lock, UserPlus, CheckCircle, Store } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
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
  DialogDescription,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useBranchStore } from '@/store/useBranchStore';
import { Worker } from '@/types/database';
import { 
  getWorkers, 
  createWorker, 
  updateWorker, 
  deleteWorker, 
  toggleWorkerStatus 
} from '@/lib/actions/workers';
import { toast } from '@/hooks/use-toast';
import { useAuthStore } from '@/store/useAuthStore';

const workerSchema = z.object({
  full_name: z.string().min(1, 'Nombre requerido'),
  phone: z.string().optional(),
  role: z.enum(['mecanico', 'electricista', 'ayudante', 'otro']),
  is_active: z.boolean(),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  password: z.string().min(6, 'Mínimo 6 caracteres').optional().or(z.literal('')),
  create_user: z.boolean(),
}).refine((data) => {
  if (data.create_user) {
    return data.email && data.email.length > 0 && data.password && data.password.length >= 6;
  }
  return true;
}, {
  message: "Email y contraseña requeridos para crear usuario de sistema",
  path: ["email"],
});

type WorkerForm = z.infer<typeof workerSchema>;

const roleLabels: Record<string, string> = {
  mecanico: 'Mecánico',
  electricista: 'Electricista',
  ayudante: 'Ayudante',
  otro: 'Otro',
};

const roleColors: Record<string, string> = {
  mecanico: 'bg-blue-500',
  electricista: 'bg-yellow-500',
  ayudante: 'bg-green-500',
  otro: 'bg-gray-500',
};

export default function WorkersPage() {
  const { selectedBranch, branches } = useBranchStore();
  const { user } = useAuthStore();
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingWorker, setEditingWorker] = useState<Worker | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const isAdmin = user?.role === 'admin';

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<WorkerForm>({
    resolver: zodResolver(workerSchema),
    defaultValues: {
      role: 'mecanico',
      is_active: true,
      create_user: false,
      email: '',
      password: '',
    },
  });

  const createUser = watch('create_user');

  useEffect(() => {
    async function loadWorkers() {
      if (!selectedBranch) {
        setWorkers([]);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const data = await getWorkers(selectedBranch.id);
        setWorkers(data);
      } catch (error) {
        toast({
          title: 'Error',
          description: error instanceof Error ? error.message : 'Error al cargar trabajadores',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    }

    loadWorkers();
  }, [selectedBranch]);

  const filteredWorkers = useMemo(() => {
    return workers.filter(
      (worker) =>
        worker.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        worker.phone?.includes(searchQuery) ||
        worker.email?.includes(searchQuery)
    );
  }, [workers, searchQuery]);

  const stats = useMemo(() => {
    const withUser = workers.filter((w) => w.user_id).length;
    return {
      total: workers.length,
      active: workers.filter((w) => w.is_active).length,
      withSystemAccess: withUser,
    };
  }, [workers]);

  const handleOpenDialog = (worker?: Worker) => {
    if (worker) {
      setEditingWorker(worker);
      reset({
        full_name: worker.full_name,
        phone: worker.phone || '',
        role: worker.role,
        is_active: worker.is_active,
        email: worker.email || '',
        create_user: false, // Al editar no se crea usuario nuevo
        password: '',
      });
    } else {
      setEditingWorker(null);
      reset({
        full_name: '',
        phone: '',
        role: 'mecanico',
        is_active: true,
        email: '',
        password: '',
        create_user: false,
      });
    }
    setDialogOpen(true);
    setShowPassword(false);
  };

  const onSubmit = async (formData: WorkerForm) => {
    if (!selectedBranch) {
      toast({
        title: 'Error',
        description: 'Seleccione una sucursal primero',
        variant: 'destructive',
      });
      return;
    }
    
    setSubmitting(true);
    try {
      if (editingWorker) {
        // Al editar, solo actualizar datos básicos (no email/password por seguridad)
        const updated = await updateWorker(editingWorker.id, {
          full_name: formData.full_name,
          phone: formData.phone,
          role: formData.role,
          is_active: formData.is_active,
        });
        setWorkers((prev) =>
          prev.map((w) => (w.id === updated.id ? updated : w))
        );
        toast({ title: 'Trabajador actualizado correctamente' });
      } else {
        // Crear nuevo
        const newWorker = await createWorker({
          full_name: formData.full_name,
          phone: formData.phone,
          role: formData.role,
          is_active: formData.is_active,
          branch_id: selectedBranch.id,
          email: formData.email || undefined,
          password: formData.password || undefined,
          create_user: formData.create_user,
        });
        setWorkers((prev) => [...prev, newWorker]);
        
        if (formData.create_user) {
          toast({ 
            title: 'Trabajador y usuario creados',
            description: `${formData.full_name} puede ingresar con ${formData.email} a ${selectedBranch.name}`
          });
        } else {
          toast({ title: 'Trabajador creado correctamente' });
        }
      }
      setDialogOpen(false);
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

  const handleDelete = async (worker: Worker) => {
    const msg = worker.user_id 
      ? 'Este trabajador tiene acceso al sistema. ¿Eliminar trabajador y usuario?'
      : '¿Está seguro de eliminar este trabajador?';
    
    if (!confirm(msg)) return;

    try {
      await deleteWorker(worker.id);
      setWorkers((prev) => prev.filter((w) => w.id !== worker.id));
      toast({ title: 'Trabajador eliminado correctamente' });
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Error al eliminar',
        variant: 'destructive',
      });
    }
  };

  const toggleActive = async (workerId: string, currentStatus: boolean) => {
    try {
      await toggleWorkerStatus(workerId, !currentStatus);
      setWorkers((prev) =>
        prev.map((w) =>
          w.id === workerId ? { ...w, is_active: !currentStatus } : w
        )
      );
      toast({
        title: currentStatus ? 'Trabajador desactivado' : 'Trabajador activado'
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Error al cambiar estado',
        variant: 'destructive',
      });
    }
  };

  if (!selectedBranch) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-gray-500">Seleccione una sucursal para ver los trabajadores</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Trabajadores</h1>
          <p className="text-gray-500">Gestión del personal del taller</p>
        </div>
        {isAdmin && (
          <Button onClick={() => handleOpenDialog()}>
            <Plus className="h-4 w-4 mr-2" />
            Nuevo Trabajador
          </Button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              Total Trabajadores
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              Activos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.active}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              Con Acceso al Sistema
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{stats.withSystemAccess}</div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          placeholder="Buscar por nombre, teléfono o email..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Workers Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Sucursal</TableHead>
                  <TableHead>Rol</TableHead>
                  <TableHead>Contacto</TableHead>
                  <TableHead>Acceso</TableHead>
                  <TableHead>Estado</TableHead>
                  {isAdmin && <TableHead className="text-right">Acciones</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={isAdmin ? 7 : 6} className="text-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto text-gray-400" />
                      <p className="text-sm text-gray-500 mt-2">Cargando trabajadores...</p>
                    </TableCell>
                  </TableRow>
                ) : filteredWorkers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={isAdmin ? 7 : 6} className="text-center py-8 text-gray-500">
                      No se encontraron trabajadores
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredWorkers.map((worker) => (
                    <TableRow key={worker.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                            worker.user_id ? 'bg-blue-100' : 'bg-gray-100'
                          }`}>
                            {worker.user_id ? (
                              <UserPlus className="h-5 w-5 text-blue-600" />
                            ) : (
                              <UserCog className="h-5 w-5 text-gray-500" />
                            )}
                          </div>
                          <div>
                            <span className="font-medium block">{worker.full_name}</span>
                            {worker.email && (
                              <span className="text-xs text-gray-500">{worker.email}</span>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Store className="h-3 w-3 text-gray-400" />
                          <span className="text-sm text-gray-600">
                            {branches?.find(b => b.id === worker.branch_id)?.name || selectedBranch?.name || 'Sucursal'}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={`${roleColors[worker.role]} text-white`}>
                          {roleLabels[worker.role]}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {worker.phone ? (
                          <div className="flex items-center gap-1 text-sm text-gray-500">
                            <Phone className="h-3 w-3" />
                            {worker.phone}
                          </div>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {worker.user_id ? (
                          <div className="flex items-center gap-1 text-sm text-green-600">
                            <CheckCircle className="h-4 w-4" />
                            <span>Activo</span>
                          </div>
                        ) : (
                          <span className="text-sm text-gray-400">Sin acceso</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={worker.is_active}
                            onCheckedChange={() => toggleActive(worker.id, worker.is_active)}
                            disabled={!isAdmin}
                          />
                          <span className={worker.is_active ? 'text-green-600' : 'text-gray-400'}>
                            {worker.is_active ? 'Activo' : 'Inactivo'}
                          </span>
                        </div>
                      </TableCell>
                      {isAdmin && (
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleOpenDialog(worker)}
                            title="Editar"
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(worker)}
                            title="Eliminar"
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Worker Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingWorker ? 'Editar Trabajador' : 'Nuevo Trabajador'}
            </DialogTitle>
            <DialogDescription>
              {editingWorker 
                ? 'Modifique los datos del trabajador' 
                : `Creando trabajador para: ${selectedBranch.name}`}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {/* Mostrar sucursal (solo informativo) */}
            <div className="p-3 bg-gray-50 rounded-lg flex items-center gap-2">
              <Store className="h-4 w-4 text-gray-500" />
              <div>
                <Label className="text-xs text-gray-500">Sucursal asignada</Label>
                <p className="font-medium text-sm">{selectedBranch.name}</p>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Nombre Completo *</Label>
              <Input {...register('full_name')} placeholder="Juan Pérez" />
              {errors.full_name && (
                <p className="text-sm text-red-500">{errors.full_name.message}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Teléfono</Label>
                <Input {...register('phone')} placeholder="0991234567" />
              </div>
              <div className="space-y-2">
                <Label>Rol *</Label>
                <Select
                  value={watch('role')}
                  onValueChange={(v: 'mecanico' | 'electricista' | 'ayudante' | 'otro') =>
                    setValue('role', v)
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mecanico">Mecánico</SelectItem>
                    <SelectItem value="electricista">Electricista</SelectItem>
                    <SelectItem value="ayudante">Ayudante</SelectItem>
                    <SelectItem value="otro">Otro (Cajero)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Switch
                checked={watch('is_active')}
                onCheckedChange={(v) => setValue('is_active', v)}
              />
              <Label>Trabajador activo</Label>
            </div>

            {/* Si está editando y ya tiene email, mostrarlo solo lectura */}
            {editingWorker && editingWorker.email && (
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Mail className="h-4 w-4" /> Email de acceso
                </Label>
                <Input 
                  value={editingWorker.email} 
                  disabled 
                  className="bg-gray-50"
                />
                <p className="text-xs text-gray-500">
                  El email no se puede modificar. Contacte al administrador de sistema para cambios.
                </p>
              </div>
            )}

            {/* Solo mostrar opción de crear usuario si es nuevo trabajador */}
            {!editingWorker && isAdmin && (
              <div className="border rounded-lg p-4 space-y-4 bg-gray-50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <UserPlus className="h-5 w-5 text-blue-600" />
                    <div>
                      <Label className="font-medium cursor-pointer" htmlFor="create-user-switch">
                        Crear usuario de sistema
                      </Label>
                      <p className="text-xs text-gray-500">
                        El trabajador podrá ingresar con email y contraseña
                      </p>
                    </div>
                  </div>
                  <Switch
                    id="create-user-switch"
                    checked={createUser}
                    onCheckedChange={(v) => {
                      setValue('create_user', v);
                      if (!v) {
                        setValue('email', '');
                        setValue('password', '');
                      }
                    }}
                  />
                </div>

                {createUser && (
                  <div className="space-y-3 pt-2 border-t border-gray-200">
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2 text-sm font-medium">
                        <Mail className="h-4 w-4 text-gray-500" /> 
                        Email de acceso *
                      </Label>
                      <Input 
                        type="email"
                        {...register('email')} 
                        placeholder="trabajador@empresa.com"
                        className="bg-white"
                      />
                      {errors.email && (
                        <p className="text-sm text-red-500">{errors.email.message}</p>
                      )}
                    </div>
                    
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2 text-sm font-medium">
                        <Lock className="h-4 w-4 text-gray-500" /> 
                        Contraseña *
                      </Label>
                      <div className="relative">
                        <Input 
                          type={showPassword ? "text" : "password"}
                          {...register('password')} 
                          placeholder="Mínimo 6 caracteres"
                          className="bg-white pr-20"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500 hover:text-gray-700 font-medium"
                        >
                          {showPassword ? 'Ocultar' : 'Ver'}
                        </button>
                      </div>
                      {errors.password && (
                        <p className="text-sm text-red-500">{errors.password.message}</p>
                      )}
                    </div>

                    <div className="p-3 bg-blue-50 rounded text-sm text-blue-700">
                      <strong>Nota:</strong> El rol de sistema será: <br/>
                      • Mecánico/Electricista/Ayudante → <strong>Mecánico</strong> (acceso a órdenes)<br/>
                      • Otro → <strong>Cajero</strong> (acceso a POS)<br/>
                      • Sucursal: <strong>{selectedBranch.name}</strong>
                    </div>
                  </div>
                )}
              </div>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {editingWorker ? 'Guardar Cambios' : 'Crear Trabajador'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}