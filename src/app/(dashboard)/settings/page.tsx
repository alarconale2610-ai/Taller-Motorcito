'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Building2,
  Percent,
  Receipt,
  Save,
  Loader2,
  Lock,
  Eye,
  MapPin,
  Phone,
  Mail,
  FileText,
  AlertCircle
} from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from '@/hooks/use-toast';
import { useAuthStore } from '@/store/useAuthStore';
import { useBranchStore } from '@/store/useBranchStore';
import { getBranchConfig, updateBranchConfig } from '@/lib/actions/branches';
import { BranchConfig } from '@/types/database';

const configSchema = z.object({
  business_name: z.string().min(1, 'Nombre comercial requerido'),
  ruc: z.string().min(10, 'RUC inválido'),
  company_name: z.string().min(1, 'Razón social requerida'),
  company_ruc: z.string().min(10, 'RUC de empresa inválido'),
  company_address: z.string().min(1, 'Dirección requerida'),
  company_phone: z.string().min(1, 'Teléfono requerido'),
  company_email: z.string().email('Email inválido'),
  establishment_code: z.string().min(3, 'Código de 3 dígitos').max(3),
  emission_point: z.string().min(3, 'Punto de emisión de 3 dígitos').max(3),
  iva_percent: z.number().min(0).max(100),
  receipt_header: z.string(),
  receipt_footer: z.string(),
});

type ConfigForm = z.infer<typeof configSchema>;

export default function SettingsPage() {
  const { user } = useAuthStore();
  const { selectedBranch } = useBranchStore();
  const [config, setConfig] = useState<BranchConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isAdmin = user?.role === 'admin';

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isDirty },
  } = useForm<ConfigForm>({
    resolver: zodResolver(configSchema),
    defaultValues: {
      business_name: '',
      ruc: '',
      company_name: '',
      company_ruc: '',
      company_address: '',
      company_phone: '',
      company_email: '',
      establishment_code: '001',
      emission_point: '001',
      iva_percent: 15,
      receipt_header: '',
      receipt_footer: '',
    },
  });

  // Cargar configuración cuando cambia la sucursal seleccionada
  const loadConfig = useCallback(async () => {
    if (!selectedBranch) {
      setLoading(false);
      setConfig(null);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      console.log('Cargando config para sucursal:', selectedBranch.id, selectedBranch.name);
      
      const data = await getBranchConfig(selectedBranch.id);
      console.log('Config recibida:', data);
      
      if (data) {
        setConfig(data);
        reset({
          business_name: data.business_name || '',
          ruc: data.ruc || '',
          company_name: data.company_name || '',
          company_ruc: data.company_ruc || '',
          company_address: data.company_address || '',
          company_phone: data.company_phone || '',
          company_email: data.company_email || '',
          establishment_code: data.establishment_code || '001',
          emission_point: data.emission_point || '001',
          iva_percent: data.iva_percent || 15,
          receipt_header: data.receipt_header || '',
          receipt_footer: data.receipt_footer || '',
        });
      } else {
        setError(`No se encontró configuración para ${selectedBranch.name}. Verifica que exista en la base de datos.`);
      }
    } catch (err) {
      console.error('Error cargando config:', err);
      setError('Error al cargar la configuración. Verifica tus permisos.');
      toast({
        title: 'Error',
        description: 'No se pudo cargar la configuración de la sucursal',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [selectedBranch, reset]);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  const onSubmit = async (formData: ConfigForm) => {
    if (!isAdmin || !selectedBranch) {
      toast({
        title: 'Sin permisos',
        description: 'No tienes permisos para editar la configuración',
        variant: 'destructive',
      });
      return;
    }

    try {
      setSaving(true);
      console.log('Guardando config para:', selectedBranch.id, formData);
      
      const result = await updateBranchConfig(selectedBranch.id, formData, user?.role || '');

      if (result.success) {
        toast({
          title: 'Configuración guardada',
          description: `Los cambios se han guardado correctamente para ${selectedBranch.name}`,
        });
        // Recargar config para confirmar
        await loadConfig();
      } else {
        toast({
          title: 'Error',
          description: result.error || 'No se pudo guardar',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error guardando:', error);
      toast({
        title: 'Error',
        description: 'Error al guardar la configuración',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  if (!selectedBranch) {
    return (
      <div className="h-[calc(100vh-8rem)] flex items-center justify-center">
        <div className="text-center">
          <Building2 className="h-12 w-12 mx-auto mb-4 text-gray-300" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Seleccione una sucursal
          </h3>
          <p className="text-gray-500">
            Use el selector superior para elegir la sucursal que desea configurar
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="h-[calc(100vh-8rem)] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          <p className="text-gray-500">Cargando configuración...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Configuración</h1>
          <p className="text-gray-500">
            {isAdmin
              ? `Configurando: ${selectedBranch.name} (ID: ${selectedBranch.id.slice(0, 8)}...)`
              : `Configuración de ${selectedBranch.name}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={isAdmin ? "default" : "secondary"} className="text-sm">
            {isAdmin ? (
              <><Lock className="h-3 w-3 mr-1" /> Administrador</>
            ) : (
              <><Eye className="h-3 w-3 mr-1" /> Solo Lectura</>
            )}
          </Badge>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {!config && !error && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            No se encontró configuración para esta sucursal. 
            {isAdmin && " Como administrador, puedes crearla guardando este formulario."}
          </AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="company" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="company">
            <Building2 className="h-4 w-4 mr-2" />
            Datos de la Empresa
          </TabsTrigger>
          <TabsTrigger value="ticket">
            <Receipt className="h-4 w-4 mr-2" />
            Configuración de Tickets
          </TabsTrigger>
          <TabsTrigger value="taxes">
            <Percent className="h-4 w-4 mr-2" />
            Impuestos
          </TabsTrigger>
        </TabsList>

        <form onSubmit={handleSubmit(onSubmit)}>
          {/* DATOS DE LA EMPRESA */}
          <TabsContent value="company" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Información de la Empresa</CardTitle>
                <CardDescription>
                  Datos legales y de contacto que aparecerán en los documentos de {selectedBranch.name}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Nombre Comercial *</Label>
                    <Input
                      {...register('business_name')}
                      disabled={!isAdmin}
                      className={!isAdmin ? 'bg-gray-50' : ''}
                    />
                    {errors.business_name && (
                      <p className="text-sm text-red-500">{errors.business_name.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label>RUC *</Label>
                    <Input
                      {...register('ruc')}
                      disabled={!isAdmin}
                      className={!isAdmin ? 'bg-gray-50' : ''}
                    />
                    {errors.ruc && (
                      <p className="text-sm text-red-500">{errors.ruc.message}</p>
                    )}
                  </div>
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label>Razón Social *</Label>
                  <Input
                    {...register('company_name')}
                    disabled={!isAdmin}
                    className={!isAdmin ? 'bg-gray-50' : ''}
                  />
                </div>

                <div className="space-y-2">
                  <Label>RUC de la Empresa *</Label>
                  <Input
                    {...register('company_ruc')}
                    disabled={!isAdmin}
                    className={!isAdmin ? 'bg-gray-50' : ''}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <MapPin className="h-4 w-4" /> Dirección
                    </Label>
                    <Input
                      {...register('company_address')}
                      disabled={!isAdmin}
                      className={!isAdmin ? 'bg-gray-50' : ''}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Phone className="h-4 w-4" /> Teléfono
                    </Label>
                    <Input
                      {...register('company_phone')}
                      disabled={!isAdmin}
                      className={!isAdmin ? 'bg-gray-50' : ''}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Mail className="h-4 w-4" /> Email
                  </Label>
                  <Input
                    type="email"
                    {...register('company_email')}
                    disabled={!isAdmin}
                    className={!isAdmin ? 'bg-gray-50' : ''}
                  />
                  {errors.company_email && (
                    <p className="text-sm text-red-500">{errors.company_email.message}</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* CONFIGURACIÓN DE TICKETS */}
          <TabsContent value="ticket" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Configuración de Tickets</CardTitle>
                <CardDescription>
                  Personalización de la impresión de tickets para {selectedBranch.name}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Código de Establecimiento</Label>
                    <Input
                      {...register('establishment_code')}
                      disabled={!isAdmin}
                      maxLength={3}
                      placeholder="001"
                      className={!isAdmin ? 'bg-gray-50' : ''}
                    />
                    <p className="text-xs text-gray-500">
                      Código único de esta sucursal (ej: 001, 002)
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label>Punto de Emisión</Label>
                    <Input
                      {...register('emission_point')}
                      disabled={!isAdmin}
                      maxLength={3}
                      placeholder="001"
                      className={!isAdmin ? 'bg-gray-50' : ''}
                    />
                    <p className="text-xs text-gray-500">
                      Normalmente 001 para facturación principal
                    </p>
                  </div>
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <FileText className="h-4 w-4" /> Encabezado del Ticket
                  </Label>
                  <Textarea
                    {...register('receipt_header')}
                    disabled={!isAdmin}
                    rows={4}
                    placeholder="Texto que aparecerá al inicio del ticket..."
                    className={!isAdmin ? 'bg-gray-50' : ''}
                  />
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <FileText className="h-4 w-4" /> Pie del Ticket
                  </Label>
                  <Textarea
                    {...register('receipt_footer')}
                    disabled={!isAdmin}
                    rows={4}
                    placeholder="Texto que aparecerá al final del ticket..."
                    className={!isAdmin ? 'bg-gray-50' : ''}
                  />
                </div>

                {/* Vista previa */}
                <div className="mt-6 p-4 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
                  <p className="text-sm font-medium text-gray-700 mb-2">Vista previa del ticket:</p>
                  <div className="bg-white p-4 rounded shadow-sm font-mono text-sm whitespace-pre-line max-w-[320px] mx-auto">
                    {watch('receipt_header') || '(Sin encabezado configurado)'}
                    {'\n\n'}
                    {'<Detalle de la venta>'}
                    {'\n\n'}
                    {watch('receipt_footer') || '(Sin pie de página configurado)'}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* IMPUESTOS */}
          <TabsContent value="taxes" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Configuración de Impuestos</CardTitle>
                <CardDescription>
                  Porcentaje de IVA aplicado a las ventas de {selectedBranch.name}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Porcentaje de IVA (%)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    {...register('iva_percent', { valueAsNumber: true })}
                    disabled={!isAdmin}
                    className={!isAdmin ? 'bg-gray-50' : ''}
                  />
                  <p className="text-sm text-gray-500">
                    Valor actual: {watch('iva_percent')}%
                  </p>
                </div>

                <div className="p-4 bg-blue-50 rounded-lg">
                  <p className="text-sm text-blue-700">
                    <strong>Nota:</strong> Este valor se utilizará para calcular el IVA en todas las ventas
                    de esta sucursal. El valor por defecto en Ecuador es 15%.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* BOTÓN GUARDAR (solo para admin) */}
          {isAdmin && (
            <div className="mt-6 flex justify-end gap-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => reset()}
                disabled={!isDirty || saving}
              >
                Restablecer
              </Button>
              <Button
                type="submit"
                disabled={!isDirty || saving}
                className="min-w-[150px]"
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Guardar Cambios
                  </>
                )}
              </Button>
            </div>
          )}
        </form>
      </Tabs>

      {/* Mensaje informativo para empleados */}
      {!isAdmin && config && (
        <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
          <div className="flex items-start gap-3">
            <Eye className="h-5 w-5 text-gray-500 mt-0.5" />
            <div>
              <p className="font-medium text-gray-900">Modo Solo Lectura</p>
              <p className="text-sm text-gray-500 mt-1">
                Como empleado, puede ver la configuración de su sucursal pero no modificarla.
                Si necesita realizar cambios, contacte al administrador del sistema.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}