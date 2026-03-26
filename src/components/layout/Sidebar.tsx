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
  ChevronLeft,
  ChevronRight,
  LogOut,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/useAuthStore';
import { useThemeStore } from '@/store/useThemeStore';
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

interface LogoProps {
  collapsed?: boolean;
  className?: string;
}

function Logo({ collapsed = false, className }: LogoProps) {
  const { theme } = useThemeStore();
  const primaryColor = `hsl(${theme.colors.primary})`;

  // Logo expandido - tamaño aumentado
  if (theme.logoUrl && !collapsed) {
    return (
      <div className={cn('flex items-center gap-3', className)}>
        <img
          src={theme.logoUrl}
          alt="Logo"
          className="h-12 w-auto object-contain max-w-[140px]"
        />
        <div className="flex flex-col min-w-0">
          <span
            className="font-bold text-base leading-tight truncate"
            style={{ color: primaryColor }}
          >
            {theme.logoText}
          </span>
          {theme.logoSubtitle && (
            <span className="text-xs text-sidebar-foreground/70 truncate">
              {theme.logoSubtitle}
            </span>
          )}
        </div>
      </div>
    );
  }

  // Logo colapsado - tamaño aumentado
  if (theme.logoUrl && collapsed) {
    return (
      <img
        src={theme.logoUrl}
        alt="Logo"
        className="h-10 w-auto object-contain max-w-[48px] mx-auto"
      />
    );
  }

  // Fallback SVG expandido - tamaño aumentado
  if (collapsed) {
    return (
      <div className={cn('flex items-center justify-center', className)}>
        <svg
          width="44"
          height="44"
          viewBox="0 0 40 40"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="animate-pulse"
        >
          <path
            d="M20 5L22.5 8.5L26.5 7L28 11L32 11.5L31 15.5L34 18L31 20.5L32 24.5L28 25L26.5 29L22.5 27.5L20 31L17.5 27.5L13.5 29L12 25L8 24.5L9 20.5L6 18L9 15.5L8 11.5L12 11L13.5 7L17.5 8.5L20 5Z"
            fill="none"
            stroke={primaryColor}
            strokeWidth="2"
            style={{
              transformOrigin: '20px 20px',
              animation: 'spin 20s linear infinite',
            }}
          />
          <rect x="16" y="12" width="8" height="16" rx="1" fill={primaryColor} />
          <circle cx="20" cy="18" r="3" fill="white" />
          <style>{`
            @keyframes spin {
              from { transform: rotate(0deg); }
              to { transform: rotate(360deg); }
            }
          `}</style>
        </svg>
      </div>
    );
  }

  // Fallback SVG expandido - tamaño aumentado
  return (
    <div className={cn('flex items-center gap-3', className)}>
      <svg
        width="44"
        height="44"
        viewBox="0 0 40 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="shrink-0"
      >
        <path
          d="M20 5L22.5 8.5L26.5 7L28 11L32 11.5L31 15.5L34 18L31 20.5L32 24.5L28 25L26.5 29L22.5 27.5L20 31L17.5 27.5L13.5 29L12 25L8 24.5L9 20.5L6 18L9 15.5L8 11.5L12 11L13.5 7L17.5 8.5L20 5Z"
          fill="none"
          stroke={primaryColor}
          strokeWidth="2"
          style={{
            transformOrigin: '20px 20px',
            animation: 'spin 20s linear infinite',
          }}
        />
        <rect x="16" y="12" width="8" height="16" rx="1" fill={primaryColor} />
        <circle cx="20" cy="18" r="3" fill="white" />
        <style>{`
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}</style>
      </svg>

      <div className="flex flex-col min-w-0">
        <span
          className="font-black text-base tracking-tight leading-none truncate"
          style={{ color: primaryColor }}
        >
          {theme.logoText}
        </span>
        {theme.logoSubtitle && (
          <span className="text-xs text-sidebar-foreground/70 font-medium tracking-wide truncate">
            {theme.logoSubtitle}
          </span>
        )}
      </div>
    </div>
  );
}

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();
  const { user, logout } = useAuthStore();
  const { theme } = useThemeStore();

  const filteredNavItems = navItems.filter((item) =>
    item.roles.includes(user?.role || 'cashier')
  );

  const sidebarBg = `hsl(${theme.colors.sidebar})`;
  const sidebarFg = `hsl(${theme.colors.sidebarForeground})`;
  const primaryColor = `hsl(${theme.colors.primary})`;

  return (
    <aside
      className={cn(
        'flex flex-col h-screen transition-all duration-300 border-r shrink-0',
        collapsed ? 'w-20' : 'w-72'
      )}
      style={{
        backgroundColor: sidebarBg,
        color: sidebarFg,
        borderColor: `hsl(${theme.colors.border})`,
      }}
    >
      {/* Logo - Altura aumentada para acomodar logo más grande */}
      <div
        className="flex items-center justify-between h-20 px-4 border-b shrink-0"
        style={{ borderColor: `hsl(${theme.colors.border})` }}
      >
        <Link href="/" className={cn('flex items-center min-w-0', collapsed && 'justify-center w-full')}>
          <Logo collapsed={collapsed} />
        </Link>
        {!collapsed && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setCollapsed(!collapsed)}
            className="shrink-0 hover:bg-white/10 h-8 w-8"
            style={{ color: sidebarFg }}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
        )}
      </div>

      {collapsed && (
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setCollapsed(!collapsed)}
          className="hover:bg-white/10 mx-auto mt-2 h-8 w-8 shrink-0"
          style={{ color: sidebarFg }}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      )}

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
                  'flex items-center gap-3 px-3 py-3 rounded-lg transition-all duration-200',
                  collapsed && 'justify-center px-2'
                )}
                style={{
                  backgroundColor: isActive ? primaryColor : 'transparent',
                  color: isActive ? 'white' : sidebarFg,
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }
                }}
                title={collapsed ? item.label : undefined}
              >
                <Icon className="h-5 w-5 flex-shrink-0" />
                {!collapsed && <span className="text-sm font-medium truncate">{item.label}</span>}
              </Link>
            );
          })}
        </nav>
      </ScrollArea>

      {/* Admin Dashboard Link */}
      {user?.role === 'admin' && !collapsed && (
        <div className="px-4 py-2 shrink-0">
          <Link
            href="/admin"
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors"
            style={{
              backgroundColor: pathname === '/admin' ? primaryColor : 'rgba(255,255,255,0.1)',
              color: 'white',
            }}
          >
            <LayoutDashboard className="h-5 w-5 shrink-0" />
            <span className="text-sm font-medium truncate">Dashboard Admin</span>
          </Link>
        </div>
      )}

      {/* Logout */}
      <div
        className="p-4 border-t shrink-0"
        style={{ borderColor: `hsl(${theme.colors.border})` }}
      >
        <Button
          variant="ghost"
          onClick={logout}
          className={cn(
            'w-full flex items-center gap-3 hover:bg-white/10 h-10',
            collapsed && 'justify-center px-2'
          )}
          style={{ color: sidebarFg }}
        >
          <LogOut className="h-5 w-5 shrink-0" />
          {!collapsed && <span className="text-sm font-medium truncate">Cerrar Sesión</span>}
        </Button>
      </div>
    </aside>
  );
}