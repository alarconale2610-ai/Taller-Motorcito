'use client';

import { useThemeStore } from '@/store/useThemeStore';
import { cn } from '@/lib/utils';

interface LogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showSubtitle?: boolean;
  variant?: 'default' | 'white' | 'dark';
}

export function Logo({ 
  className, 
  size = 'md', 
  showSubtitle = true,
  variant = 'default' 
}: LogoProps) {
  const { theme } = useThemeStore();
  
  const sizeClasses = {
    sm: { container: 'h-8 w-8', text: 'text-sm', subtitle: 'text-[10px]', svg: 32 },
    md: { container: 'h-12 w-12', text: 'text-lg', subtitle: 'text-xs', svg: 45 },
    lg: { container: 'h-16 w-16', text: 'text-xl', subtitle: 'text-sm', svg: 60 },
    xl: { container: 'h-24 w-24', text: 'text-3xl', subtitle: 'text-base', svg: 90 },
  };

  const s = sizeClasses[size];
  
  // Determinar colores según variante
  const getColors = () => {
    switch (variant) {
      case 'white':
        return { primary: '#ffffff', subtitle: 'text-white/70' };
      case 'dark':
        return { primary: '#1e293b', subtitle: 'text-slate-600' };
      default:
        return { 
          primary: `hsl(${theme.colors.primary})`, 
          subtitle: 'text-muted-foreground' 
        };
    }
  };

  const colors = getColors();

  // Si hay logo subido, mostrar imagen
  if (theme.logoUrl || theme.logoBase64) {
    return (
      <div className={cn('flex items-center gap-3', className)}>
        <img
          src={theme.logoUrl || theme.logoBase64}
          alt={theme.logoText || 'Logo'}
          className={cn('object-contain', size === 'sm' ? 'h-8' : size === 'md' ? 'h-12' : size === 'lg' ? 'h-16' : 'h-24')}
        />
        {(showSubtitle || size === 'xl') && (
          <div className="flex flex-col">
            <span 
              className={cn('font-bold leading-none tracking-tight', s.text)}
              style={{ color: colors.primary }}
            >
              {theme.logoText || 'TALLER MOTORCITO'}
            </span>
            {showSubtitle && theme.logoSubtitle && (
              <span className={cn('font-medium tracking-wide', s.subtitle, colors.subtitle)}>
                {theme.logoSubtitle}
              </span>
            )}
          </div>
        )}
      </div>
    );
  }

  // Logo SVG por defecto (estrella/motor)
  return (
    <div className={cn('flex items-center gap-3', className)}>
      <svg
        width={s.svg}
        height={s.svg}
        viewBox="0 0 40 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="shrink-0"
      >
        <path
          d="M20 5L22.5 8.5L26.5 7L28 11L32 11.5L31 15.5L34 18L31 20.5L32 24.5L28 25L26.5 29L22.5 27.5L20 31L17.5 27.5L13.5 29L12 25L8 24.5L9 20.5L6 18L9 15.5L8 11.5L12 11L13.5 7L17.5 8.5L20 5Z"
          fill="none"
          stroke={colors.primary}
          strokeWidth="2"
          style={{
            transformOrigin: '20px 20px',
            animation: 'spin 20s linear infinite',
          }}
        />
        <rect x="16" y="12" width="8" height="16" rx="1" fill={colors.primary} />
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
          className={cn('font-black tracking-tight leading-none', s.text)}
          style={{ color: colors.primary }}
        >
          {theme.logoText || 'TALLER MOTORCITO'}
        </span>
        {showSubtitle && (
          <span className={cn('font-medium tracking-wide', s.subtitle, colors.subtitle)}>
            {theme.logoSubtitle || 'Sistema de Gestión'}
          </span>
        )}
      </div>
    </div>
  );
}