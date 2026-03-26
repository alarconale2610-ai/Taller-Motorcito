'use client';

import { useState, useRef, useEffect } from 'react';
import { Upload, X, Image as ImageIcon, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import { createClient } from '@/lib/supabase'; // Importar la función

interface LogoUploaderProps {
  currentLogoUrl?: string;
  onLogoChange: (url: string) => void;
  disabled?: boolean;
  branchId: string;
}

export function LogoUploader({ currentLogoUrl, onLogoChange, disabled, branchId }: LogoUploaderProps) {
  const [preview, setPreview] = useState<string | null>(currentLogoUrl || null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Crear cliente de Supabase
  const supabase = createClient();

  // Actualizar preview cuando cambia currentLogoUrl desde fuera
  useEffect(() => {
    setPreview(currentLogoUrl || null);
  }, [currentLogoUrl]);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validar tipo de archivo
    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Error',
        description: 'Solo se permiten imágenes (PNG, JPG, SVG)',
        variant: 'destructive',
      });
      return;
    }

    // Validar tamaño (máximo 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast({
        title: 'Error',
        description: 'La imagen no debe superar 2MB',
        variant: 'destructive',
      });
      return;
    }

    setIsUploading(true);

    try {
      // 1. Crear preview local temporal inmediatamente
      const localUrl = URL.createObjectURL(file);
      setPreview(localUrl);

      // 2. Subir a Supabase Storage
      const fileExt = file.name.split('.').pop()?.toLowerCase() || 'png';
      const fileName = `logo-${branchId}-${Date.now()}.${fileExt}`;
      const filePath = `logos/${fileName}`;

      console.log('Subiendo a:', filePath);

      const { error: uploadError } = await supabase.storage
        .from('branch-assets')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true,
          contentType: file.type,
        });

      if (uploadError) {
        console.error('Error de subida:', uploadError);
        throw uploadError;
      }

      // 3. Obtener URL pública
      const { data: { publicUrl } } = supabase.storage
        .from('branch-assets')
        .getPublicUrl(filePath);

      console.log('URL pública obtenida:', publicUrl);

      // 4. Notificar al padre con la URL de Supabase (NO la local)
      onLogoChange(publicUrl);

      toast({
        title: 'Logo subido',
        description: 'La imagen se ha subido correctamente a Supabase',
      });

    } catch (error: any) {
      console.error('Error subiendo logo:', error);
      toast({
        title: 'Error',
        description: error.message || 'No se pudo subir la imagen',
        variant: 'destructive',
      });
      // Revertir preview si falla
      setPreview(currentLogoUrl || null);
    } finally {
      setIsUploading(false);
      // Limpiar input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemove = async () => {
    // Eliminar de Supabase Storage si existe
    if (currentLogoUrl && currentLogoUrl.includes('supabase.co')) {
      try {
        // Extraer el path del archivo de la URL
        const urlParts = currentLogoUrl.split('/branch-assets/');
        if (urlParts.length > 1) {
          const filePath = urlParts[1];
          console.log('Eliminando archivo:', filePath);
          const { error } = await supabase.storage.from('branch-assets').remove([filePath]);
          if (error) console.log('Error al eliminar archivo anterior:', error);
        }
      } catch (e) {
        console.log('No se pudo eliminar archivo anterior:', e);
      }
    }
    
    setPreview(null);
    onLogoChange('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    
    toast({
      title: 'Logo eliminado',
      description: 'El logo ha sido removido',
    });
  };

  return (
    <div className="space-y-4">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileSelect}
        accept="image/png,image/jpeg,image/svg+xml"
        className="hidden"
        disabled={disabled || isUploading}
      />

      {preview ? (
        <div className="relative inline-block">
          <img
            src={preview}
            alt="Logo preview"
            className="w-32 h-32 object-contain border rounded-lg bg-white"
          />
          {!disabled && !isUploading && (
            <button
              type="button"
              onClick={handleRemove}
              className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          )}
          {isUploading && (
            <div className="absolute inset-0 bg-black/50 rounded-lg flex items-center justify-center">
              <Loader2 className="h-6 w-6 text-white animate-spin" />
            </div>
          )}
        </div>
      ) : (
        <div
          onClick={() => !disabled && !isUploading && fileInputRef.current?.click()}
          className={`w-32 h-32 border-2 border-dashed rounded-lg flex flex-col items-center justify-center gap-2 bg-gray-50 transition-colors ${
            disabled || isUploading ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:bg-gray-100 hover:border-gray-400'
          }`}
        >
          {isUploading ? (
            <Loader2 className="h-8 w-8 text-gray-400 animate-spin" />
          ) : (
            <ImageIcon className="h-8 w-8 text-gray-400" />
          )}
          <span className="text-xs text-gray-500 text-center px-2">
            {isUploading ? 'Subiendo...' : 'Click para subir logo'}
          </span>
        </div>
      )}

      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled || isUploading}
        >
          <Upload className="h-4 w-4 mr-2" />
          {preview ? 'Cambiar logo' : 'Subir logo'}
        </Button>
      </div>

      <p className="text-xs text-gray-500">
        Formatos: PNG, JPG, SVG. Máximo 2MB. Recomendado: 200x200px con fondo transparente.
      </p>
    </div>
  );
}