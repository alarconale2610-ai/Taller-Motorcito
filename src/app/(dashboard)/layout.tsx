'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { useAuthStore } from '@/store/useAuthStore';
import { useBranchStore } from '@/store/useBranchStore';
import { getBranches } from '@/lib/actions/branches';
import { toast } from '@/hooks/use-toast';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { user } = useAuthStore();
  const { selectedBranch, setSelectedBranch } = useBranchStore();
  const [loading, setLoading] = useState(true);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!user) {
      router.push('/login');
    }
  }, [user, router]);

  // Set default branch if not selected
  useEffect(() => {
    async function loadDefaultBranch() {
      if (!user || selectedBranch) {
        setLoading(false);
        return;
      }

      try {
        const branches = await getBranches();
        
        if (branches.length === 0) {
          toast({
            title: 'Error',
            description: 'No hay sucursales disponibles',
            variant: 'destructive',
          });
          setLoading(false);
          return;
        }

        if (user.branch_id) {
          // Usuario no-admin: usar su branch asignada
          const branch = branches.find((b) => b.id === user.branch_id);
          if (branch) {
            setSelectedBranch(branch);
          } else {
            // Si no encuentra la branch asignada, usar la primera
            setSelectedBranch(branches[0]);
          }
        } else {
          // Admin: seleccionar primera sucursal por defecto
          setSelectedBranch(branches[0]);
        }
      } catch (error) {
        toast({
          title: 'Error',
          description: 'No se pudieron cargar las sucursales',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    }

    loadDefaultBranch();
  }, [user, selectedBranch, setSelectedBranch]);

  if (!user || loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
          <p className="text-gray-500">Cargando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}