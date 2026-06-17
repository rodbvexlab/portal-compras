import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  FileText,
  CheckSquare,
  Menu,
  ChevronLeft,
  ChevronRight,
  LogOut,
  ClipboardList,
  ShoppingCart,
  Users,
} from 'lucide-react';
import { useAuth } from '../helpers/useAuth';
import { AccessGroup, getAccessGroupForRole } from '../helpers/accessGroups';
import { Button } from './Button';
import { Avatar, AvatarFallback, AvatarImage } from './Avatar';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from './DropdownMenu';
import styles from './AppSidebarLayout.module.css';

type NavItem = {
  to: string;
  icon: React.ComponentType<{ size?: number }>;
  label: string;
};

const SIDEBAR_COLLAPSED_STORAGE_KEY = 'portal_sidebar_collapsed';

const NAV_ITEMS_BY_GROUP: Record<AccessGroup, NavItem[]> = {
  lider: [
    { to: '/minhas-solicitacoes', icon: ClipboardList, label: 'Minhas Solicitações' },
  ],
  diretoria: [
    { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/aprovacoes', icon: CheckSquare, label: 'Aprovar Compras' },
    { to: '/minhas-solicitacoes', icon: ClipboardList, label: 'Minhas Solicitações' },
  ],
  tecnologia: [
    { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/solicitacoes', icon: FileText, label: 'Solicitações' },
    { to: '/compras-ti', icon: ShoppingCart, label: 'Compras TI' },
    { to: '/admin/usuarios', icon: Users, label: 'Usuários' },
  ],
  financeiro: [
    { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/solicitacoes', icon: FileText, label: 'Solicitações' },
  ],
};

const roleMap: Record<string, string> = {
  admin: 'Administrador',
  lider_setor: 'Líder de Setor',
  diretora_financeiro: 'Diretora Financeiro',
  diretora_empresa: 'Diretora da Empresa',
  financeiro: 'Financeiro',
  ti: 'TI',
  user: 'Usuário',
};

export const AppSidebarLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { authState, logout } = useAuth();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  useEffect(() => {
    const savedValue = localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY);
    if (savedValue === 'true') {
      setIsSidebarCollapsed(true);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, String(isSidebarCollapsed));
  }, [isSidebarCollapsed]);

  const user = authState.type === 'authenticated' ? authState.user : null;
  const accessGroup = user ? getAccessGroupForRole(user.role) : null;
  let navItems: NavItem[] = [];

  const legacyNavItems = [
    { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/solicitacoes', icon: FileText, label: 'Solicitações' },
    ...(user && user.role !== 'admin'
      ? [{ to: '/minhas-solicitacoes', icon: ClipboardList, label: 'Minhas Solicitações' }]
      : []),
    ...(user && ['admin', 'diretora_financeiro'].includes(user.role)
      ? [{ to: '/aprovacoes', icon: CheckSquare, label: 'Aprovações Financeiras' }]
      : []),
    ...(user && ['admin', 'ti'].includes(user.role)
      ? [{ to: '/compras-ti', icon: ShoppingCart, label: 'Compras TI' }]
      : []),
    ...(user && user.role === 'admin'
      ? [{ to: '/admin/usuarios', icon: Users, label: 'Usuários' }]
      : []),
  ];

  navItems =
    user?.role === 'admin'
      ? legacyNavItems
      : accessGroup
        ? NAV_ITEMS_BY_GROUP[accessGroup]
        : legacyNavItems;

  const handleLogout = async () => {
    await logout();
  };

  const closeMobile = () => setMobileOpen(false);
  const toggleSidebarCollapse = () => setIsSidebarCollapsed((prev) => !prev);

  return (
    <div className={styles.layout}>
      {mobileOpen && <div className={styles.overlay} onClick={closeMobile} />}

      <aside
        className={`${styles.sidebar} ${mobileOpen ? styles.open : ''} ${isSidebarCollapsed ? styles.collapsed : ''}`}
      >
        <div className={styles.sidebarHeader}>
          <div className={styles.logo}></div>
          <h2 className={styles.sidebarTitle}>Portal de Compras</h2>
          <button
            type="button"
            className={styles.collapseButton}
            onClick={toggleSidebarCollapse}
            aria-label={isSidebarCollapsed ? 'Expandir menu lateral' : 'Recolher menu lateral'}
            title={isSidebarCollapsed ? 'Expandir menu lateral' : 'Recolher menu lateral'}
          >
            {isSidebarCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        </div>

        <nav className={styles.nav}>
          <div className={styles.navSectionLabel}>Portal de Compras</div>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.to;

            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={closeMobile}
                className={`${styles.navItem} ${isActive ? styles.active : ''}`}
                title={isSidebarCollapsed ? item.label : undefined}
                aria-label={item.label}
              >
                <Icon size={20} />
                <span className={styles.navLabel}>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {user && (
          <div className={styles.sidebarFooter}>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <div
                  className={styles.userProfile}
                  role="button"
                  tabIndex={0}
                  title={isSidebarCollapsed ? `${user.displayName} (${roleMap[user.role] || user.role})` : undefined}
                >
                  <Avatar>
                    <AvatarImage src={user.avatarUrl || ''} />
                    <AvatarFallback>{user.displayName.charAt(0)}</AvatarFallback>
                  </Avatar>

                  <div className={styles.userInfo}>
                    <span className={styles.userName}>{user.displayName}</span>
                    <span className={styles.userRole}>{roleMap[user.role] || user.role}</span>
                  </div>
                </div>
              </DropdownMenuTrigger>

              <DropdownMenuContent align="end" sideOffset={10}>
                <DropdownMenuLabel>
                  <span className={styles.dropdownUserName}>{user.displayName}</span>
                  <span className={styles.dropdownUserRole}>{roleMap[user.role] || user.role}</span>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout}>
                  <LogOut size={16} style={{ marginRight: 8 }} />
                  Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </aside>

      <main className={styles.main}>
        <header className={styles.mobileHeader}>
          <Button variant="ghost" size="icon" onClick={() => setMobileOpen(true)}>
            <Menu size={24} />
          </Button>
          <h2>Portal de Compras</h2>
        </header>

        <div className={styles.desktopChrome} aria-hidden="true">
          <div className={styles.desktopChromeLine} />
        </div>

        <div className={styles.content}>{children}</div>
      </main>
    </div>
  );
};
