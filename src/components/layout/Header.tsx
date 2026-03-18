'use client';

import { useState, useEffect } from 'react';
import { Building2, User, Check } from 'lucide-react';
import { useBranchStore } from '@/store/useBranchStore';
import { useAuthStore } from '@/store/useAuthStore';
import { getBranches } from '@/lib/actions/branches';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Branch } from '@/types/database';

export function Header() {
  const { selectedBranch, setSelectedBranch } = useBranchStore();
  const { user } = useAuthStore();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);

  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    async function loadBranches() {
      try {
        const data = await getBranches();
        setBranches(data);
        
        // Si no hay sucursal seleccionada y el usuario tiene una asignada, seleccionarla
        if (!selectedBranch && user?.branch_id) {
          const userBranch = data.find(b => b.id === user.branch_id);
          if (userBranch) {
            setSelectedBranch(userBranch);
          }
        }
      } catch (error) {
        console.error('Error cargando sucursales:', error);
      } finally {
        setLoading(false);
      }
    }
    loadBranches();
  }, [user, selectedBranch, setSelectedBranch]);

  const handleBranchChange = (branchId: string) => {
    // Evitar seleccionar "all" o valores vacíos
    if (branchId === 'all' || !branchId) return;
    
    const branch = branches.find((b) => b.id === branchId);
    if (branch) {
      setSelectedBranch(branch);
      // Guardar en localStorage como backup
      localStorage.setItem('admin_selected_branch_id', branch.id);
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  // Determinar si el selector debe estar deshabilitado
  const isSelectorDisabled = !isAdmin && !!user?.branch_id;

  return (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6">
      {/* Branch Selector */}
      <div className="flex items-center gap-3">
        <Building2 className="h-5 w-5 text-gray-500" />
        <Select
          value={selectedBranch?.id || ''}
          onValueChange={handleBranchChange}
          disabled={isSelectorDisabled}
        >
          <SelectTrigger className="w-[250px]">
            <SelectValue placeholder={loading ? 'Cargando...' : 'Seleccionar sucursal'} />
          </SelectTrigger>
          <SelectContent>
            {/* ELIMINADO: SelectItem con value="" que causaba el error */}
            
            {branches.map((branch) => (
              <SelectItem key={branch.id} value={branch.id}>
                <div className="flex items-center justify-between w-full">
                  <span>{branch.name}</span>
                  {selectedBranch?.id === branch.id && (
                    <Check className="h-4 w-4 ml-2 text-blue-600" />
                  )}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        
        {/* Indicador de Admin */}
        {isAdmin && selectedBranch && (
          <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
            Modo Admin
          </span>
        )}
      </div>

      {/* User Profile */}
      <DropdownMenu>
        <DropdownMenuTrigger className="flex items-center gap-3 outline-none">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-medium text-gray-900">{user?.full_name}</p>
            <p className="text-xs text-gray-500 capitalize">
              {user?.role === 'admin' ? 'Administrador' : user?.role === 'cashier' ? 'Cajero' : 'Mecánico'}
            </p>
          </div>
          <Avatar className="h-9 w-9">
            <AvatarFallback className="bg-blue-600 text-white text-sm">
              {user?.full_name ? getInitials(user.full_name) : 'U'}
            </AvatarFallback>
          </Avatar>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>Mi Cuenta</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem>
            <User className="mr-2 h-4 w-4" />
            <span>Perfil</span>
          </DropdownMenuItem>
          <DropdownMenuItem>
            <Building2 className="mr-2 h-4 w-4" />
            <span>Sucursal: {selectedBranch?.name || 'No seleccionada'}</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}