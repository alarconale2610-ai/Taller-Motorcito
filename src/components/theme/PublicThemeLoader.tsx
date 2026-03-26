'use client';

import { useEffect, useState } from 'react';
import { useThemeStore } from '@/store/useThemeStore';
import { createClient } from '@/lib/supabase';

// Interfaz local para lo que esperamos de la BD
interface BranchWithConfig {
  id: string;
  name: string;
  config: {
    primary_color?: string;
    sidebar_color?: string;
    logo_text?: string;
    logo_subtitle?: string;
    logo_url?: string;
    logo_base64?: string;
    business_name?: string;
  } | null;
}

export function PublicThemeLoader() {
  const setPublicConfig = useThemeStore((state) => state.setPublicConfig);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadPublicConfig() {
      try {
        const supabase = createClient();
        
        if (!supabase) {
          console.error('❌ No se pudo crear cliente Supabase');
          setIsLoading(false);
          return;
        }

        const { data, error } = await supabase
          .from('branches')
          .select('id, name, config')
          .eq('is_active', true)
          .order('created_at', { ascending: true })
          .limit(1)
          .single();

        if (error) {
          console.log('ℹ️ No se encontró sucursal activa, usando tema por defecto');
          setIsLoading(false);
          return;
        }

        // ✅ Cast explícito para evitar el error de tipo
        const branch = data as BranchWithConfig | null;

        if (branch?.config) {
          setPublicConfig(branch.config);
        }
      } catch (err) {
        console.error('❌ Error cargando tema público:', err);
      } finally {
        setIsLoading(false);
      }
    }

    loadPublicConfig();
  }, [setPublicConfig]);

  return null;
}