'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Wrench, Eye, EyeOff, Loader2, Settings, Gauge } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuthStore } from '@/store/useAuthStore';
import { useBranchStore } from '@/store/useBranchStore';
import { login } from '@/lib/actions/auth';
import { toast } from '@/hooks/use-toast';

const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'Contraseña mínimo 6 caracteres'),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const { setUser } = useAuthStore();
  const { setSelectedBranch } = useBranchStore();
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

  return (
    <div className="min-h-screen w-full flex relative overflow-hidden bg-slate-950">
      {/* FONDO AURORA ANIMADO - Ocupa toda la pantalla detrás de todo */}
      <div className="absolute inset-0 overflow-hidden">
        {/* Aurora Azul 1 */}
        <div 
          className="absolute -top-1/2 -left-1/4 w-[150%] h-[150%] rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(59, 130, 246, 0.8) 0%, rgba(37, 99, 235, 0.4) 40%, transparent 70%)',
            filter: 'blur(80px)',
            animation: 'auroraMove 25s ease-in-out infinite alternate'
          }}
        />
        {/* Aurora Azul 2 */}
        <div 
          className="absolute -bottom-1/2 -right-1/4 w-[150%] h-[150%] rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(96, 165, 250, 0.6) 0%, rgba(59, 130, 246, 0.3) 40%, transparent 70%)',
            filter: 'blur(100px)',
            animation: 'auroraMove 30s ease-in-out infinite alternate-reverse'
          }}
        />
        {/* Aurora Azul Claro */}
        <div 
          className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full rounded-full"
          style={{
            background: 'radial-gradient(circle at 50% 50%, rgba(147, 197, 253, 0.5) 0%, transparent 60%)',
            filter: 'blur(60px)',
            animation: 'auroraPulse 20s ease-in-out infinite'
          }}
        />
      </div>

      {/* LADO IZQUIERDO - Vidrio Azul */}
      <div 
        className={`hidden lg:flex lg:w-1/2 relative z-10 flex-col justify-center items-center px-16 text-white transition-all duration-1000 ${
          mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
        }`}
        style={{
          background: 'rgba(30, 58, 138, 0.4)', // blue-900/40
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderRight: '1px solid rgba(255, 255, 255, 0.1)'
        }}
      >
        <div className="max-w-md w-full">
          <div className="flex justify-center mb-12">
            <div className="relative group">
              <div className="absolute inset-0 bg-blue-400/30 rounded-3xl blur-2xl group-hover:bg-blue-400/40 transition-all duration-700" />
              <div className="relative h-24 w-24 bg-white/10 backdrop-blur-sm rounded-3xl flex items-center justify-center border border-white/20 shadow-xl">
                <Wrench className="h-12 w-12 text-white" />
              </div>
            </div>
          </div>

          <h1 className="text-5xl font-bold text-center mb-6 tracking-tight text-white drop-shadow-lg">
            TALLERWEB
          </h1>
          
          <p className="text-xl text-center text-blue-100 mb-16 font-light leading-relaxed">
            Gestión inteligente para talleres mecánicos modernos
          </p>

          <div className="space-y-4">
            <div className="flex items-center gap-4 bg-white/10 backdrop-blur-md rounded-2xl p-5 border border-white/10 hover:bg-white/15 transition-all duration-300">
              <div className="h-11 w-11 bg-blue-500/30 rounded-xl flex items-center justify-center border border-blue-400/30">
                <Settings className="h-5 w-5 text-blue-100" />
              </div>
              <div>
                <p className="font-semibold text-blue-50">Control Total</p>
                <p className="text-sm text-blue-200/80">Gestión de inventario y órdenes</p>
              </div>
            </div>

            <div className="flex items-center gap-4 bg-white/10 backdrop-blur-md rounded-2xl p-5 border border-white/10 hover:bg-white/15 transition-all duration-300">
              <div className="h-11 w-11 bg-blue-500/30 rounded-xl flex items-center justify-center border border-blue-400/30">
                <Gauge className="h-5 w-5 text-blue-100" />
              </div>
              <div>
                <p className="font-semibold text-blue-50">Eficiencia</p>
                <p className="text-sm text-blue-200/80">Optimiza tus procesos diarios</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* LADO DERECHO - Vidrio Blanco */}
      <div 
        className={`w-full lg:w-1/2 relative z-10 flex items-center justify-center transition-all duration-1000 delay-300 ${
          mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
        }`}
        style={{
          background: 'rgba(255, 255, 255, 0.85)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderLeft: '1px solid rgba(255, 255, 255, 0.5)'
        }}
      >
        <div className="w-full max-w-md px-8 lg:px-12 py-12">
          {/* Mobile Header */}
          <div className="lg:hidden text-center mb-10">
            <div className="inline-flex h-16 w-16 bg-blue-600 rounded-2xl items-center justify-center mb-4 shadow-lg">
              <Wrench className="h-8 w-8 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900">TALLERWEB</h2>
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
                  placeholder="user@tallerweb.com"
                  className="h-12 bg-white/50 border-gray-200 rounded-xl focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all"
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
                    className="h-12 bg-white/50 border-gray-200 rounded-xl pr-12 focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all"
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
                className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl shadow-lg shadow-blue-600/20 transition-all hover:scale-[1.02] active:scale-[1.01] disabled:opacity-50"
                disabled={isSubmitting}
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

            <div className="p-4 bg-blue-50/80 rounded-2xl border border-blue-100">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 h-8 w-8 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Wrench className="h-4 w-4 text-blue-600" />
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
            © 2025 Motorcito. Todos los derechos reservados.
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