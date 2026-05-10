'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { useAuthStore } from '@/store/useAuthStore';
import { useBranchStore } from '@/store/useBranchStore';
import { getBranches, getBranchConfig } from '@/lib/actions/branches';
import { toast } from '@/hooks/use-toast';
import { Branch } from '@/types/database';

interface BranchWithConfig extends Branch {
  business_name?: string;
  config?: any;
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { user } = useAuthStore();
  const { selectedBranch, setSelectedBranch, branches, setBranches } = useBranchStore();
  const [loading, setLoading] = useState(true);

  // ← NUEVO: watchdog de reconexión a la DB
  useEffect(() => {
    let dbWasDown = false;
    let bannerEl: HTMLDivElement | null = null;

    function mostrarBanner(visible: boolean) {
      if (!bannerEl) {
        bannerEl = document.createElement('div');
        bannerEl.style.cssText = `
          position:fixed;top:0;left:0;width:100%;z-index:9999;
          background:#ef4444;color:#fff;text-align:center;
          padding:10px;font-size:14px;font-family:sans-serif;
        `;
        bannerEl.textContent = '⚠️ Sin conexión a la base de datos. Reconectando...';
        document.body.prepend(bannerEl);
      }
      bannerEl.style.display = visible ? 'block' : 'none';
    }

    async function checkHealth() {
      try {
        const res = await fetch('/api/health', { cache: 'no-store' });
        if (!res.ok) {
          dbWasDown = true;
          mostrarBanner(true);
        } else if (dbWasDown) {
          mostrarBanner(false);
          setTimeout(() => window.location.reload(), 1000);
        }
      } catch {
        dbWasDown = true;
        mostrarBanner(true);
      }
    }

    const interval = setInterval(checkHealth, 5000);
    return () => clearInterval(interval); // limpia al desmontar
  }, []);
  // ← FIN NUEVO

  useEffect(() => {
    if (!user) {
      router.push('/login');
    }
  }, [user, router]);

  useEffect(() => {
    async function loadBranchesWithConfig() {
      if (!user) {
        setLoading(false);
        return;
      }

      const hasStaleData = selectedBranch && !selectedBranch.business_name;

      if (branches.length > 0 && selectedBranch && !hasStaleData) {
        setLoading(false);
        return;
      }

      try {
        const branchesList = await getBranches();

        if (branchesList.length === 0) {
          toast({
            title: 'Error',
            description: 'No hay sucursales disponibles',
            variant: 'destructive',
          });
          setLoading(false);
          return;
        }

        const branchesWithConfig: BranchWithConfig[] = await Promise.all(
          branchesList.map(async (branch) => {
            try {
              const config = await getBranchConfig(branch.id);
              return {
                ...branch,
                config: config || undefined,
                business_name: config?.business_name || branch.name,
              };
            } catch {
              return {
                ...branch,
                business_name: branch.name,
              };
            }
          })
        );

        setBranches(branchesWithConfig);

        let branchToSelect: BranchWithConfig | null = null;

        if (user.branch_id) {
          branchToSelect = branchesWithConfig.find((b) => b.id === user.branch_id) || null;
        }

        if (!branchToSelect) {
          branchToSelect = branchesWithConfig[0];
        }

        setSelectedBranch(branchToSelect);

      } catch (error) {
        console.error('Error loading branches:', error);
        toast({
          title: 'Error',
          description: 'No se pudieron cargar las sucursales',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    }

    loadBranchesWithConfig();
  }, [user, branches.length, selectedBranch, setBranches, setSelectedBranch]);

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