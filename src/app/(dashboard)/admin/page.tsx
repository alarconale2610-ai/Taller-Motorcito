'use client';

import { useState, useEffect } from 'react';
import { Users, Store, TrendingUp, DollarSign, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useBranchStore } from '@/store/useBranchStore';
import { Branch } from '@/types/database';
import { getBranches } from '@/lib/actions/branches';
import { toast } from '@/hooks/use-toast';

// Stats interface
interface DashboardStats {
  totalUsers: number;
  totalBranches: number;
  todaySales: number;
  monthSales: number;
}

export default function AdminPage() {
  const { selectedBranch } = useBranchStore();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats>({
    totalUsers: 0,
    totalBranches: 0,
    todaySales: 0,
    monthSales: 0,
  });

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const branchesData = await getBranches();
        setBranches(branchesData);
        
        // TODO: Implementar estadisticas reales desde el backend
        // Por ahora usamos datos de ejemplo
        setStats({
          totalUsers: 5,
          totalBranches: branchesData.length,
          todaySales: 1250.50,
          monthSales: 15800.75,
        });
      } catch (error) {
        toast({
          title: 'Error',
          description: 'Error al cargar datos del dashboard',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard Administrativo</h1>
        <p className="text-gray-500">Vista general del sistema</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Usuarios</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalUsers}</div>
            <p className="text-xs text-muted-foreground">Usuarios activos</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sucursales</CardTitle>
            <Store className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalBranches}</div>
            <p className="text-xs text-muted-foreground">Sucursales registradas</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ventas Hoy</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${stats.todaySales.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">Total del dia</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ventas del Mes</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${stats.monthSales.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">Total mensual</p>
          </CardContent>
        </Card>
      </div>

      {/* Branches Info */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Sucursales</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {branches.map((branch) => (
                <div key={branch.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <p className="font-medium">{branch.name}</p>
                    <p className="text-sm text-gray-500">{branch.address || 'Sin direccion'}</p>
                    <p className="text-sm text-gray-500">{branch.phone || 'Sin telefono'}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium">ID: {branch.id.slice(0, 8)}...</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Informacion del Sistema</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="p-4 bg-blue-50 rounded-lg">
                <p className="font-medium text-blue-800">Version</p>
                <p className="text-sm text-blue-600">TallerWeb v1.0.0</p>
              </div>
              <div className="p-4 bg-green-50 rounded-lg">
                <p className="font-medium text-green-800">Estado</p>
                <p className="text-sm text-green-600">Sistema operativo</p>
              </div>
              <div className="p-4 bg-yellow-50 rounded-lg">
                <p className="font-medium text-yellow-800">Base de Datos</p>
                <p className="text-sm text-yellow-600">Conectado a Supabase</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
