import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface ThemeColors {
  primary: string;
  primaryForeground: string;
  secondary: string;
  secondaryForeground: string;
  accent: string;
  accentForeground: string;
  background: string;
  foreground: string;
  sidebar: string;
  sidebarForeground: string;
  border: string;
}

export interface ThemeConfig {
  colors: ThemeColors;
  logoText: string;
  logoSubtitle?: string;
  logoUrl?: string;
  logoBase64?: string;
}

// Interfaz para la config pública que viene de la BD (BranchConfig)
export interface PublicThemeConfig {
  primary_color?: string;
  sidebar_color?: string;
  logo_text?: string;
  logo_subtitle?: string;
  logo_url?: string;
  logo_base64?: string;
  business_name?: string;
}

const defaultColors: ThemeColors = {
  primary: '221 83% 53%', // blue-600
  primaryForeground: '0 0% 100%',
  secondary: '210 40% 96.1%',
  secondaryForeground: '222.2 47.4% 11.2%',
  accent: '210 40% 96.1%',
  accentForeground: '222.2 47.4% 11.2%',
  background: '0 0% 100%',
  foreground: '222.2 84% 4.9%',
  sidebar: '215 28% 17%', // slate-900
  sidebarForeground: '0 0% 100%',
  border: '214.3 31.8% 91.4%',
};

export const useThemeStore = create<{
  theme: ThemeConfig;
  setTheme: (theme: Partial<ThemeConfig>) => void;
  setColors: (colors: Partial<ThemeColors>) => void;
  setPublicConfig: (config: PublicThemeConfig) => void;  // ✅ AGREGADO
  resetTheme: () => void;
}>()(
  persist(
    (set) => ({
      theme: {
        colors: defaultColors,
        logoText: 'TALLER MOTORCITO',
        logoSubtitle: 'Sistema de Gestión',
        logoUrl: '',
        logoBase64: '',
      },
      setTheme: (newTheme) =>
        set((state) => ({
          theme: { ...state.theme, ...newTheme },
        })),
      setColors: (newColors) =>
        set((state) => ({
          theme: {
            ...state.theme,
            colors: { ...state.theme.colors, ...newColors },
          },
        })),
      // ✅ NUEVA FUNCIÓN AGREGADA
      setPublicConfig: (config) =>
        set((state) => ({
          theme: {
            ...state.theme,
            // Mapear campos de BranchConfig a ThemeConfig
            colors: {
              ...state.theme.colors,
              ...(config.primary_color && { primary: config.primary_color }),
              ...(config.sidebar_color && { sidebar: config.sidebar_color }),
            },
            logoText: config.logo_text || config.business_name || state.theme.logoText,
            logoSubtitle: config.logo_subtitle || state.theme.logoSubtitle,
            logoUrl: config.logo_url || state.theme.logoUrl,
            logoBase64: config.logo_base64 || state.theme.logoBase64,
          },
        })),
      resetTheme: () =>
        set({
          theme: {
            colors: defaultColors,
            logoText: 'TALLER MOTORCITO',
            logoSubtitle: 'Sistema de Gestión',
            logoUrl: '',
            logoBase64: '',
          },
        }),
    }),
    {
      name: 'taller-theme-storage',
    }
  )
);