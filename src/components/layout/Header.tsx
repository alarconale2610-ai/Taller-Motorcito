'use client';

import { useBranchStore } from '@/store/useBranchStore';
import { useAuthStore } from '@/store/useAuthStore';
import { useThemeStore } from '@/store/useThemeStore';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Building2, ChevronDown, LogOut, User } from 'lucide-react';
import { logout } from '@/lib/actions/auth';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';

export function Header() {
  const router = useRouter();
  const { user, setUser } = useAuthStore();
  const { selectedBranch, branches, setSelectedBranch, clearBranchData } = useBranchStore();
  const { theme } = useThemeStore();

  const handleLogout = async () => {
    await logout();
    setUser(null);
    clearBranchData(); // ← LIMPIAR DATOS DE SUCURSAL
    router.push('/login');
  };

  const displayName = selectedBranch?.business_name || selectedBranch?.name || 'Sin Sucursal';
  const branchSubtitle = selectedBranch?.business_name
    ? (selectedBranch?.name || 'Sucursal')
    : (theme.logoSubtitle || 'Sistema de Gestión');

  return (
    <header className="h-16 border-b flex items-center justify-between px-4 lg:px-6 sticky top-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-3">
          {theme.logoUrl ? (
            <img
              src={theme.logoUrl}
              alt="Logo"
              className="h-10 w-auto object-contain max-w-[140px]"
            />
          ) : (
            <div
              className="h-10 w-10 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: `hsl(${theme.colors.primary})` }}
            >
              <Building2 className="h-5 w-5 text-white" />
            </div>
          )}
          <div className="hidden md:block">
            <h1 className="font-bold text-lg leading-tight text-foreground">
              {displayName}
            </h1>
            <p className="text-xs text-muted-foreground">{branchSubtitle}</p>
          </div>
        </div>

        {user?.role === 'admin' && branches.length > 1 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="ml-4 gap-2">
                <Building2 className="h-4 w-4" />
                <span className="hidden sm:inline">Cambiar Sucursal</span>
                <ChevronDown className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-64">
              <DropdownMenuLabel>Seleccionar Sucursal</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {branches.map((branch) => (
                <DropdownMenuItem
                  key={branch.id}
                  onClick={() => setSelectedBranch(branch)}
                  className={cn(
                    'flex flex-col items-start py-2',
                    selectedBranch?.id === branch.id && 'bg-accent'
                  )}
                >
                  <span className="font-medium">
                    {branch.business_name || branch.name}
                  </span>
                  {branch.business_name && (
                    <span className="text-xs text-muted-foreground">
                      {branch.name}
                    </span>
                  )}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      <div className="flex items-center gap-4">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-8 w-8 rounded-full">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-primary text-primary-foreground">
                  {user?.full_name?.charAt(0) || 'U'}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56" align="end" forceMount>
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none">{user?.full_name}</p>
                <p className="text-xs leading-none text-muted-foreground">
                  {user?.email}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Sucursal: {selectedBranch?.name || 'No asignada'}
                </p>
                {selectedBranch?.business_name && (
                  <p className="text-xs text-muted-foreground">
                    {selectedBranch.business_name}
                  </p>
                )}
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout}>
              <LogOut className="mr-2 h-4 w-4" />
              <span>Cerrar sesión</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}