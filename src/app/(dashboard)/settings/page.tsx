'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
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
  AlertCircle,
  Palette,
  Upload,
  X,
  Image as ImageIcon,
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
import { useThemeStore } from '@/store/useThemeStore';
import { getBranchConfig, updateBranchConfig } from '@/lib/actions/branches';
import { BranchConfig } from '@/types/database';
import { cn } from '@/lib/utils';
import { LogoUploader } from '@/components/layout/LogoUploader';

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
  primary_color: z.string().default('221 83% 53%'),
  sidebar_color: z.string().default('215 28% 17%'),
  logo_text: z.string().default('TALLER MOTORCITO'),
  logo_subtitle: z.string().default('Sistema de Gestión'),
  logo_url: z.string().optional(),
  logo_base64: z.string().optional(),
});

type ConfigForm = z.infer<typeof configSchema>;

// Funciones de conversión HSL ↔ HEX
function hslToHex(hsl: string): string {
  const parts = hsl.match(/(\d+)\s+(\d+)%\s+(\d+)%/);
  if (!parts) return '#3b82f6';

  let h = parseInt(parts[1]);
  let s = parseInt(parts[2]) / 100;
  let l = parseInt(parts[3]) / 100;

  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs((h / 60) % 2 - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;

  if (0 <= h && h < 60) { r = c; g = x; b = 0; }
  else if (60 <= h && h < 120) { r = x; g = c; b = 0; }
  else if (120 <= h && h < 180) { r = 0; g = c; b = x; }
  else if (180 <= h && h < 240) { r = 0; g = x; b = c; }
  else if (240 <= h && h < 300) { r = x; g = 0; b = c; }
  else if (300 <= h && h < 360) { r = c; g = 0; b = x; }

  const toHex = (n: number) => {
    const hex = Math.round((n + m) * 255).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function hexToHSL(hex: string): string {
  let r = 0, g = 0, b = 0;
  if (hex.length === 4) {
    r = parseInt('0x' + hex[1] + hex[1]);
    g = parseInt('0x' + hex[2] + hex[2]);
    b = parseInt('0x' + hex[3] + hex[3]);
  } else if (hex.length === 7) {
    r = parseInt('0x' + hex[1] + hex[2]);
    g = parseInt('0x' + hex[3] + hex[4]);
    b = parseInt('0x' + hex[5] + hex[6]);
  }

  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0, l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }

  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

function hslToCss(hsl: string): string {
  return hsl.trim().replace(/\s+/g, ', ');
}

// Componente Logo para vista previa
function LogoPreview({
  logoText,
  logoSubtitle,
  primaryColor,
  logoUrl
}: {
  logoText: string;
  logoSubtitle: string;
  primaryColor: string;
  logoUrl?: string;
}) {
  if (logoUrl) {
    return (
      <div className="flex items-center gap-3">
        <img
          src={logoUrl}
          alt="Logo"
          className="h-12 w-auto object-contain"
        />
        <div className="flex flex-col">
          <span className="font-bold text-lg leading-none" style={{ color: primaryColor }}>
            {logoText || 'TALLER MOTORCITO'}
          </span>
          {logoSubtitle && (
            <span className="text-xs text-muted-foreground">{logoSubtitle}</span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <svg
        width="45"
        height="45"
        viewBox="0 0 40 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="shrink-0"
      >
        <path
          d="M20 5L22.5 8.5L26.5 7L28 11L32 11.5L31 15.5L34 18L31 20.5L32 24.5L28 25L26.5 29L22.5 27.5L20 31L17.5 27.5L13.5 29L12 25L8 24.5L9 20.5L6 18L9 15.5L8 11.5L12 11L13.5 7L17.5 8.5L20 5Z"
          fill="none"
          stroke={primaryColor}
          strokeWidth="2"
          style={{
            transformOrigin: '20px 20px',
            animation: 'spin 20s linear infinite',
          }}
        />
        <rect x="16" y="12" width="8" height="16" rx="1" fill={primaryColor} />
        <circle cx="20" cy="18" r="3" fill="white" />
        <style>{`
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}</style>
      </svg>
      <div className="flex flex-col">
        <span
          className="font-black text-lg tracking-tight leading-none"
          style={{ color: primaryColor }}
        >
          {logoText || 'TALLER MOTORCITO'}
        </span>
        {logoSubtitle && (
          <span className="text-xs text-muted-foreground font-medium tracking-wide">
            {logoSubtitle}
          </span>
        )}
      </div>
    </div>
  );
}

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
    setValue,
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
      primary_color: '221 83% 53%',
      sidebar_color: '215 28% 17%',
      logo_text: 'TALLER MOTORCITO',
      logo_subtitle: 'Sistema de Gestión',
      logo_url: '',
      logo_base64: '',
    },
  });

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
          primary_color: data.primary_color || '221 83% 53%',
          sidebar_color: data.sidebar_color || '215 28% 17%',
          logo_text: data.logo_text || 'TALLER MOTORCITO',
          logo_subtitle: data.logo_subtitle || 'Sistema de Gestión',
          logo_url: data.logo_url || '',
          logo_base64: data.logo_base64 || '',
        });

        const { setTheme } = useThemeStore.getState();
        setTheme({
          colors: {
            ...useThemeStore.getState().theme.colors,
            primary: data.primary_color || '221 83% 53%',
            sidebar: data.sidebar_color || '215 28% 17%',
          },
          logoText: data.logo_text || 'TALLER MOTORCITO',
          logoSubtitle: data.logo_subtitle || 'Sistema de Gestión',
          logoUrl: data.logo_url || '',
          logoBase64: data.logo_base64 || '',
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

      const { setTheme } = useThemeStore.getState();
      setTheme({
        colors: {
          ...useThemeStore.getState().theme.colors,
          primary: formData.primary_color,
          sidebar: formData.sidebar_color,
        },
        logoText: formData.logo_text,
        logoSubtitle: formData.logo_subtitle,
        logoUrl: formData.logo_url || '',
        logoBase64: formData.logo_base64 || '',
      });

      const result = await updateBranchConfig(selectedBranch.id, formData, user?.role || '');

      if (result.success) {
        toast({
          title: 'Configuración guardada',
          description: `Los cambios se han guardado correctamente para ${selectedBranch.name}`,
        });
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
        <TabsList className="grid w-full grid-cols-4">
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
          <TabsTrigger value="appearance">
            <Palette className="h-4 w-4 mr-2" />
            Apariencia
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

          {/* APARIENCIA */}
          <TabsContent value="appearance" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Personalización Visual</CardTitle>
                <CardDescription>
                  Logo, colores y marca de {selectedBranch.name}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                
                {/* LOGO UPLOADER - AHORA CON SUPABASE */}
                <div className="space-y-2">
                  <Label>Logo de la Empresa</Label>
                  <LogoUploader
                    currentLogoUrl={watch('logo_url')}
                    onLogoChange={(url) => {
                      setValue('logo_url', url, { shouldDirty: true });
                      // Limpiar base64 ya que ahora usamos URL de Supabase
                      setValue('logo_base64', '', { shouldDirty: true });
                    }}
                    disabled={!isAdmin}
                    branchId={selectedBranch.id}
                  />
                </div>

                <Separator />

                {/* Texto del Logo (fallback) */}
                <div className="space-y-2">
                  <Label>Texto del Logo (si no hay imagen)</Label>
                  <Input
                    {...register('logo_text')}
                    disabled={!isAdmin}
                    placeholder="TALLER MOTORCITO"
                  />
                  <p className="text-xs text-gray-500">
                    Se muestra cuando no hay logo subido o en impresiones pequeñas
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Subtítulo</Label>
                  <Input
                    {...register('logo_subtitle')}
                    disabled={!isAdmin}
                    placeholder="Sistema de Gestión"
                  />
                </div>

                <Separator />

                {/* Color Primario */}
                <div className="space-y-4">
                  <Label className="flex items-center gap-2">
                    <Palette className="h-4 w-4" />
                    Color Primario
                  </Label>
                  <div className="flex items-center gap-4">
                    <input
                      type="color"
                      disabled={!isAdmin}
                      value={hslToHex(watch('primary_color'))}
                      onChange={(e) => {
                        const hsl = hexToHSL(e.target.value);
                        setValue('primary_color', hsl, { shouldDirty: true });
                      }}
                      className="w-16 h-16 rounded cursor-pointer disabled:cursor-not-allowed"
                    />
                    <div className="flex-1">
                      <Input
                        {...register('primary_color')}
                        disabled={!isAdmin}
                        className="font-mono text-sm"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Formato HSL: "221 83% 53%" (Azul), "0 84% 60%" (Rojo), "142 71% 45%" (Verde)
                      </p>
                    </div>
                  </div>
                </div>

                {/* Color Sidebar */}
                <div className="space-y-4">
                  <Label className="flex items-center gap-2">
                    <Palette className="h-4 w-4" />
                    Color de la Barra Lateral
                  </Label>
                  <div className="flex items-center gap-4">
                    <input
                      type="color"
                      disabled={!isAdmin}
                      value={hslToHex(watch('sidebar_color'))}
                      onChange={(e) => {
                        const hsl = hexToHSL(e.target.value);
                        setValue('sidebar_color', hsl, { shouldDirty: true });
                      }}
                      className="w-16 h-16 rounded cursor-pointer disabled:cursor-not-allowed"
                    />
                    <div className="flex-1">
                      <Input
                        {...register('sidebar_color')}
                        disabled={!isAdmin}
                        className="font-mono text-sm"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Recomendado: Tonos oscuros para mejor contraste
                      </p>
                    </div>
                  </div>
                </div>

                {/* Vista Previa */}
                <div className="mt-6 p-6 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
                  <p className="text-sm font-medium text-gray-700 mb-4">Vista previa:</p>
                  
                  <LogoPreview
                    logoText={watch('logo_text')}
                    logoSubtitle={watch('logo_subtitle')}
                    primaryColor={`hsl(${hslToCss(watch('primary_color'))})`}
                    logoUrl={watch('logo_url')}
                  />

                  <div className="mt-4 flex gap-2">
                    <div
                      className="px-4 py-2 rounded text-white text-sm font-medium"
                      style={{ backgroundColor: `hsl(${hslToCss(watch('primary_color'))})` }}
                    >
                      Botón Primario
                    </div>
                    <div
                      className="px-4 py-2 rounded text-white text-sm"
                      style={{ backgroundColor: `hsl(${hslToCss(watch('sidebar_color'))})` }}
                    >
                      Sidebar
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* BOTÓN GUARDAR */}
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