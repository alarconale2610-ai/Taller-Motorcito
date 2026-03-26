'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff, Loader2, Settings, Gauge, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuthStore } from '@/store/useAuthStore';
import { useBranchStore } from '@/store/useBranchStore';
import { useThemeStore } from '@/store/useThemeStore';
import { login } from '@/lib/actions/auth';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'Contraseña mínimo 6 caracteres'),
});

type LoginForm = z.infer<typeof loginSchema>;

// Componente Logo mejorado - MÁS GRANDE
function AuthLogo({ 
  theme, 
  size = 'xl',
  variant = 'white' 
}: { 
  theme: any; 
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  variant?: 'white' | 'colored';
}) {
  const sizeClasses = {
    sm: { img: 'h-12', text: 'text-lg', subtitle: 'text-xs' },
    md: { img: 'h-16', text: 'text-xl', subtitle: 'text-sm' },
    lg: { img: 'h-20', text: 'text-2xl', subtitle: 'text-base' },
    xl: { img: 'h-24', text: 'text-3xl', subtitle: 'text-lg' },
    '2xl': { img: 'h-32', text: 'text-4xl', subtitle: 'text-xl' },
  };

  const s = sizeClasses[size];
  const primaryColor = variant === 'white' ? '#ffffff' : `hsl(${theme.colors.primary})`;
  const subtitleColor = variant === 'white' ? 'text-white/80' : 'text-gray-500';

  const logoSrc = theme.logoUrl || theme.logoBase64;
  
  if (logoSrc) {
    return (
      <div className="flex flex-col items-center gap-4">
        <div className={cn('relative flex items-center justify-center', s.img)}>
          <img
            src={logoSrc}
            alt={theme.logoText || 'Logo'}
            className={cn('object-contain max-h-full w-auto drop-shadow-lg', s.img)}
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        </div>
        <div className="flex flex-col items-center text-center">
          <span 
            className={cn('font-bold leading-none tracking-tight', s.text)}
            style={{ color: primaryColor, textShadow: variant === 'white' ? '0 2px 4px rgba(0,0,0,0.3)' : 'none' }}
          >
            {theme.logoText || 'TALLER MOTORCITO'}
          </span>
          {theme.logoSubtitle && (
            <span className={cn('font-medium tracking-wide mt-2', s.subtitle, subtitleColor)}>
              {theme.logoSubtitle}
            </span>
          )}
        </div>
      </div>
    );
  }

  // Logo SVG por defecto - MÁS GRANDE
  return (
    <div className="flex flex-col items-center gap-4">
      <div className={cn('relative flex items-center justify-center', s.img)}>
        <svg
          viewBox="0 0 40 40"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={cn('drop-shadow-lg', s.img)}
        >
          <path
            d="M20 5L22.5 8.5L26.5 7L28 11L32 11.5L31 15.5L34 18L31 20.5L32 24.5L28 25L26.5 29L22.5 27.5L20 31L17.5 27.5L13.5 29L12 25L8 24.5L9 20.5L6 18L9 15.5L8 11.5L12 11L13.5 7L17.5 8.5L20 5Z"
            fill="none"
            stroke={primaryColor}
            strokeWidth="2"
            style={{
              transformOrigin: '20px 20px',
              animation: 'spin 20s linear infinite',
              filter: variant === 'white' ? 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))' : 'none',
            }}
          />
          <rect x="16" y="12" width="8" height="16" rx="1" fill={primaryColor} />
          <circle cx="20" cy="18" r="3" fill={variant === 'white' ? '#1e293b' : 'white'} />
        </svg>
      </div>
      <div className="flex flex-col items-center text-center">
        <span 
          className={cn('font-black tracking-tight leading-none', s.text)}
          style={{ 
            color: primaryColor,
            textShadow: variant === 'white' ? '0 2px 4px rgba(0,0,0,0.3)' : 'none'
          }}
        >
          {theme.logoText || 'TALLER MOTORCITO'}
        </span>
        {theme.logoSubtitle && (
          <span className={cn('font-medium tracking-wide mt-2', s.subtitle, subtitleColor)}>
            {theme.logoSubtitle}
          </span>
        )}
      </div>
    </div>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const { setUser } = useAuthStore();
  const { setSelectedBranch } = useBranchStore();
  const { theme } = useThemeStore();
  
  const [showPassword, setShowPassword] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginForm) => {
    try {
      const { profile, branch } = await login(data.email, data.password);
      setUser(profile);
      setSelectedBranch(branch);

      toast({
        title: 'Bienvenido',
        description: `Hola ${profile.full_name}`,
      });

      router.push('/');
    } catch (error: any) {
      toast({
        title: 'Error de inicio de sesión',
        description: error.message || 'Credenciales inválidas',
        variant: 'destructive',
      });
    }
  };

  const primaryColor = `hsl(${theme.colors.primary})`;
  const sidebarColor = `hsl(${theme.colors.sidebar})`;

  return (
    <div className="min-h-screen w-full flex relative overflow-hidden bg-slate-950">
      {/* FONDO AURORA */}
      <div className="absolute inset-0 overflow-hidden">
        <div
          className="absolute -top-1/2 -left-1/4 w-[150%] h-[150%] rounded-full"
          style={{
            background: `radial-gradient(circle, ${primaryColor}80 0%, ${primaryColor}40 40%, transparent 70%)`,
            filter: 'blur(80px)',
            animation: 'auroraMove 25s ease-in-out infinite alternate',
            opacity: 0.6,
          }}
        />
        <div
          className="absolute -bottom-1/2 -right-1/4 w-[150%] h-[150%] rounded-full"
          style={{
            background: `radial-gradient(circle, ${primaryColor}60 0%, ${primaryColor}30 40%, transparent 70%)`,
            filter: 'blur(100px)',
            animation: 'auroraMove 30s ease-in-out infinite alternate-reverse',
            opacity: 0.4,
          }}
        />
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full rounded-full"
          style={{
            background: `radial-gradient(circle at 50% 50%, ${sidebarColor}50 0%, transparent 60%)`,
            filter: 'blur(60px)',
            animation: 'auroraPulse 20s ease-in-out infinite',
            opacity: 0.3,
          }}
        />
      </div>

      {/* LADO IZQUIERDO */}
      <div
        className={cn(
          'hidden lg:flex lg:w-1/2 relative z-10 flex-col justify-center items-center px-16 text-white transition-all duration-1000',
          mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
        )}
        style={{
          background: `${sidebarColor}66`,
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderRight: '1px solid rgba(255, 255, 255, 0.1)',
        }}
      >
        <div className="max-w-md w-full">
          {/* LOGO GRANDE */}
          <div className="flex justify-center mb-12">
            <div className="relative group">
              <div 
                className="absolute inset-0 rounded-3xl blur-3xl transition-all duration-700 group-hover:opacity-80"
                style={{ 
                  background: `${primaryColor}50`,
                  transform: 'scale(1.2)',
                }} 
              />
              <div 
                className="relative p-8 bg-white/10 backdrop-blur-sm rounded-3xl border border-white/20 shadow-2xl"
              >
                <AuthLogo theme={theme} size="2xl" variant="white" />
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div 
              className="flex items-center gap-4 bg-white/10 backdrop-blur-md rounded-2xl p-5 border border-white/10 hover:bg-white/15 transition-all duration-300"
            >
              <div 
                className="h-12 w-12 rounded-xl flex items-center justify-center border"
                style={{ 
                  background: `${primaryColor}40`,
                  borderColor: `${primaryColor}60`,
                }}
              >
                <Settings className="h-6 w-6 text-white" />
              </div>
              <div>
                <p className="font-semibold text-white text-lg">Control Total</p>
                <p className="text-sm text-white/70">Gestión de inventario y órdenes</p>
              </div>
            </div>

            <div 
              className="flex items-center gap-4 bg-white/10 backdrop-blur-md rounded-2xl p-5 border border-white/10 hover:bg-white/15 transition-all duration-300"
            >
              <div 
                className="h-12 w-12 rounded-xl flex items-center justify-center border"
                style={{ 
                  background: `${primaryColor}40`,
                  borderColor: `${primaryColor}60`,
                }}
              >
                <Gauge className="h-6 w-6 text-white" />
              </div>
              <div>
                <p className="font-semibold text-white text-lg">Eficiencia</p>
                <p className="text-sm text-white/70">Optimiza tus procesos diarios</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* LADO DERECHO */}
      <div
        className={cn(
          'w-full lg:w-1/2 relative z-10 flex items-center justify-center transition-all duration-1000 delay-300',
          mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
        )}
        style={{
          background: 'rgba(255, 255, 255, 0.9)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderLeft: '1px solid rgba(255, 255, 255, 0.5)',
        }}
      >
        <div className="w-full max-w-md px-8 lg:px-12 py-12">
          {/* Mobile Header */}
          <div className="lg:hidden text-center mb-10">
            <AuthLogo theme={theme} size="xl" variant="colored" />
          </div>

          <div className="space-y-8">
            <div className="space-y-2">
              <h3 className="text-3xl font-bold text-gray-900">Bienvenido de vuelta</h3>
              <p className="text-gray-500">Ingresa tus credenciales para continuar</p>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium text-gray-700">
                  Correo Electrónico
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="admin@tallerweb.com"
                  className="h-12 bg-white/80 border-gray-200 rounded-xl focus:bg-white focus:ring-4 transition-all"
                  style={{ 
                    '--tw-ring-color': `${primaryColor}30`,
                  } as React.CSSProperties}
                  {...register('email')}
                />
                {errors.email && (
                  <p className="text-sm text-red-500">{errors.email.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-medium text-gray-700">
                  Contraseña
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    className="h-12 bg-white/80 border-gray-200 rounded-xl pr-12 focus:bg-white focus:ring-4 transition-all"
                    style={{ 
                      '--tw-ring-color': `${primaryColor}30`,
                    } as React.CSSProperties}
                    {...register('password')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
                {errors.password && (
                  <p className="text-sm text-red-500">{errors.password.message}</p>
                )}
              </div>

              <Button
                type="submit"
                disabled={isSubmitting}
                className="w-full h-12 text-white font-semibold rounded-xl shadow-lg transition-all hover:scale-[1.02] active:scale-[1.01] disabled:opacity-50"
                style={{ 
                  background: primaryColor,
                  boxShadow: `${primaryColor}40 0px 10px 25px -5px`,
                }}
              >
                {isSubmitting ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Iniciando sesión...
                  </span>
                ) : (
                  'Iniciar Sesión'
                )}
              </Button>
            </form>

            <div 
              className="p-4 rounded-2xl border"
              style={{ 
                background: `${primaryColor}10`,
                borderColor: `${primaryColor}30`,
              }}
            >
              <div className="flex items-start gap-3">
                <div 
                  className="flex-shrink-0 h-8 w-8 rounded-lg flex items-center justify-center"
                  style={{ background: `${primaryColor}20` }}
                >
                  <Sparkles className="h-4 w-4" style={{ color: primaryColor }} />
                </div>
                <div>
                  <p className="font-medium text-gray-900 text-sm">Acceso Inteligente</p>
                  <p className="text-gray-600 text-xs mt-1">
                    El sistema detectará automáticamente tu sucursal asignada.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <p className="text-center text-gray-400 text-xs mt-12">
            © 2025 {theme.logoText || 'Motorcito'}. Todos los derechos reservados.
          </p>
        </div>
      </div>

      <style jsx global>{`
        @keyframes auroraMove {
          0% { transform: translate(0, 0) rotate(0deg) scale(1); }
          100% { transform: translate(50px, -30px) rotate(5deg) scale(1.1); }
        }
        @keyframes auroraPulse {
          0%, 100% { opacity: 0.5; transform: scale(1); }
          50% { opacity: 0.8; transform: scale(1.1); }
        }
      `}</style>
    </div>
  );
}