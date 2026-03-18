'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Search,
  Wrench,
  Users,
  UserCog,
  Coffee,
  BarChart3,
  Settings,
  Menu,
  ChevronLeft,
  ChevronRight,
  LogOut,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/useAuthStore';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  roles: ('admin' | 'cashier' | 'mechanic')[];
}

const navItems: NavItem[] = [
  { label: 'Dashboard', href: '/', icon: LayoutDashboard, roles: ['admin', 'cashier', 'mechanic'] },
  { label: 'POS Tienda', href: '/pos', icon: ShoppingCart, roles: ['admin', 'cashier'] },
  { label: 'Inventario', href: '/inventory', icon: Package, roles: ['admin', 'cashier'] },
  { label: 'Stock Cruzado', href: '/cross-stock', icon: Search, roles: ['admin', 'cashier'] },
  { label: 'Órdenes de Trabajo', href: '/work-orders', icon: Wrench, roles: ['admin', 'cashier', 'mechanic'] },
  { label: 'Clientes', href: '/customers', icon: Users, roles: ['admin', 'cashier'] },
  { label: 'Trabajadores', href: '/workers', icon: UserCog, roles: ['admin'] },
  { label: 'Consumo Interno', href: '/internal-consumption', icon: Coffee, roles: ['admin', 'cashier'] },
  { label: 'Reportes', href: '/reports', icon: BarChart3, roles: ['admin'] },
  { label: 'Configuración', href: '/settings', icon: Settings, roles: ['admin'] },
];

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();
  const { user, logout } = useAuthStore();

  const filteredNavItems = navItems.filter((item) =>
    item.roles.includes(user?.role || 'cashier')
  );

  return (
    <aside
      className={cn(
        'flex flex-col h-screen bg-slate-900 text-white transition-all duration-300 border-r border-slate-800',
        collapsed ? 'w-16' : 'w-64'
      )}
    >
      {/* Logo */}
      <div className="flex items-center justify-between h-16 px-4 border-b border-slate-800">
        {!collapsed && (
          <Link href="/" className="flex items-center gap-2">
            <Wrench className="h-6 w-6 text-blue-400" />
            <span className="font-bold text-lg">TALLERWEB</span>
          </Link>
        )}
        {collapsed && <Wrench className="h-6 w-6 text-blue-400 mx-auto" />}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setCollapsed(!collapsed)}
          className="text-slate-400 hover:text-white hover:bg-slate-800"
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
      </div>

      {/* Navigation */}
      <ScrollArea className="flex-1 py-4">
        <nav className="space-y-1 px-2">
          {filteredNavItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors',
                  isActive
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-white',
                  collapsed && 'justify-center px-2'
                )}
                title={collapsed ? item.label : undefined}
              >
                <Icon className="h-5 w-5 flex-shrink-0" />
                {!collapsed && <span className="text-sm font-medium">{item.label}</span>}
              </Link>
            );
          })}
        </nav>
      </ScrollArea>

      {/* Admin Dashboard Link (solo para admin) */}
      {user?.role === 'admin' && !collapsed && (
        <div className="px-4 py-2">
          <Link
            href="/admin"
            className={cn(
              'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors',
              pathname === '/admin'
                ? 'bg-purple-600 text-white'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            )}
          >
            <LayoutDashboard className="h-5 w-5" />
            <span className="text-sm font-medium">Dashboard Admin</span>
          </Link>
        </div>
      )}

      {/* Logout */}
      <div className="p-4 border-t border-slate-800">
        <Button
          variant="ghost"
          onClick={logout}
          className={cn(
            'w-full flex items-center gap-3 text-slate-400 hover:text-white hover:bg-slate-800',
            collapsed && 'justify-center px-2'
          )}
        >
          <LogOut className="h-5 w-5" />
          {!collapsed && <span className="text-sm font-medium">Cerrar Sesión</span>}
        </Button>
      </div>
    </aside>
  );
}
