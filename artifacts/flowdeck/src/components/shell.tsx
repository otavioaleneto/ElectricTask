import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useUnsavedGuard } from "@/lib/unsaved-guard";
import { useGetCurrentUser, useLogout, getGetCurrentUserQueryKey } from "@workspace/api-client-react";
import { LogOut, LayoutDashboard, Settings, Network, Moon, Sun, Check, Menu, StickyNote, Share2, PanelLeftClose, PanelLeftOpen, User, CreditCard, Wallet, Tags } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useTheme } from "@/components/theme-provider";
import { useFloatingTask } from "@/lib/floating-task-context";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { useQueryClient } from "@tanstack/react-query";
import { ScrollArea } from "./ui/scroll-area";
import { NotificationBell } from "@/components/notification-bell";
import { ActiveTimerIndicator } from "@/components/active-timer-indicator";
import { WorkspaceSwitcher } from "@/components/workspace-switcher";

interface User {
  name: string;
  email: string;
  avatarUrl?: string | null;
  role: string;
}

const SIDEBAR_COLLAPSED_KEY = "flowdeck-sidebar-collapsed";

export function Shell({ children, wide = false }: { children: React.ReactNode; wide?: boolean }) {
  const { data: user, isLoading: isUserLoading } = useGetCurrentUser();
  const logout = useLogout();
  const { closeFloating } = useFloatingTask();
  const [, setLocation] = useLocation();
  const [location] = useLocation();
  const queryClient = useQueryClient();
  const { theme, setTheme } = useTheme();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "1";
    } catch {
      return false;
    }
  });

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(SIDEBAR_COLLAPSED_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  useEffect(() => {
    if (!isUserLoading && !user) {
      setLocation("/login");
    }
  }, [isUserLoading, user, setLocation]);

  useEffect(() => {
    setMobileOpen(false);
  }, [location]);

  if (isUserLoading || !user) {
    return <div className="min-h-screen bg-background flex items-center justify-center">Carregando...</div>;
  }

  const handleLogout = () => {
    logout.mutate(undefined, {
      onSuccess: () => {
        closeFloating();
        queryClient.clear();
        setLocation("/login");
      }
    });
  };

  return (
    <div className="flex min-h-screen w-full bg-background">
      <aside
        className={`hidden md:flex border-r border-border bg-sidebar shrink-0 flex-col h-screen sticky top-0 transition-[width] duration-200 ${
          collapsed ? "w-16" : "w-64"
        }`}
      >
        <SidebarContent
          user={user}
          theme={theme}
          setTheme={setTheme}
          onLogout={handleLogout}
          collapsed={collapsed}
          onToggleCollapse={toggleCollapsed}
        />
      </aside>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-72 p-0 bg-sidebar flex flex-col md:hidden">
          <SheetTitle className="sr-only">Menu de navegação</SheetTitle>
          <SidebarContent user={user} theme={theme} setTheme={setTheme} onLogout={handleLogout} collapsed={false} />
        </SheetContent>
      </Sheet>

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="flex items-center gap-3 border-b border-border bg-sidebar px-4 h-14 shrink-0 sticky top-0 z-20 [&:has(#page-header-slot:not(:empty))_.shell-mobile-logo]:hidden">
          <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setMobileOpen(true)} aria-label="Abrir menu">
            <Menu size={20} />
          </Button>
          <div className="shell-mobile-logo flex items-center gap-2 font-bold text-lg text-primary md:hidden shrink-0">
            <div className="w-7 h-7 rounded bg-primary text-primary-foreground flex items-center justify-center text-sm">
              E
            </div>
            <span className="hidden min-[420px]:inline">ElectricTask</span>
          </div>
          <div id="page-header-slot" className="flex items-center gap-3 min-w-0 flex-1" />
          <div className="flex items-center gap-2 shrink-0">
            <ActiveTimerIndicator />
            <NotificationBell />
            {user.role !== "admin" && (
              <WorkspaceSwitcher triggerClassName="h-9 w-[120px] sm:w-[190px]" />
            )}
          </div>
        </header>

        <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <ScrollArea className="flex-1">
            <div className={`p-4 sm:p-6 md:p-10 w-full ${wide ? "" : "max-w-7xl mx-auto"}`}>
              {children}
            </div>
          </ScrollArea>
        </main>
      </div>
    </div>
  );
}

function SidebarContent({
  user,
  theme,
  setTheme,
  onLogout,
  collapsed,
  onToggleCollapse,
}: {
  user: User;
  theme: string;
  setTheme: (t: "light" | "dark" | "system") => void;
  onLogout: () => void;
  collapsed: boolean;
  onToggleCollapse?: () => void;
}) {
  const [, navigate] = useLocation();
  return (
    <>
      <div className={collapsed ? "p-3" : "p-6"}>
        <div className={`flex items-center mb-8 ${collapsed ? "justify-center" : "justify-between"}`}>
          {!collapsed && (
            <div className="flex items-center gap-2 font-bold text-xl text-primary">
              <div className="w-8 h-8 rounded bg-primary text-primary-foreground flex items-center justify-center">
                E
              </div>
              ElectricTask
            </div>
          )}
          {onToggleCollapse && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onToggleCollapse}
              className="shrink-0 text-muted-foreground hover:text-foreground"
              aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
              title={collapsed ? "Expandir menu" : "Recolher menu"}
            >
              {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
            </Button>
          )}
        </div>

        <nav className="flex flex-col gap-2">
          {user.role === 'admin' ? (
            <NavLink href="/admin" icon={<Settings size={18} />} label="Painel Admin" collapsed={collapsed} />
          ) : (
            <>
              <NavLink href="/" icon={<LayoutDashboard size={18} />} label="Dashboard" collapsed={collapsed} />
              <NavLink href="/mindmaps" icon={<Network size={18} />} label="Mapas Mentais" collapsed={collapsed} />
              <NavLink href="/notes" icon={<StickyNote size={18} />} label="Notas" collapsed={collapsed} />
              <NavLink href="/subscriptions" icon={<CreditCard size={18} />} label="Assinaturas" collapsed={collapsed} exact />
              <div className={`flex flex-col gap-1 ${collapsed ? "" : "pl-4"}`}>
                <NavLink
                  href="/subscriptions/payment-methods"
                  icon={<Wallet size={collapsed ? 18 : 16} />}
                  label="Formas de pagamento"
                  collapsed={collapsed}
                />
                <NavLink
                  href="/subscriptions/categories"
                  icon={<Tags size={collapsed ? 18 : 16} />}
                  label="Categorias"
                  collapsed={collapsed}
                />
              </div>
              <NavLink href="/graph" icon={<Share2 size={18} />} label="Grafo" collapsed={collapsed} />
            </>
          )}
        </nav>
      </div>

      <div className={`mt-auto border-t border-border ${collapsed ? "p-3" : "p-6"}`}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              title={collapsed ? user.name ?? undefined : undefined}
              aria-label={collapsed ? user.name ?? undefined : undefined}
              className={`w-full h-auto p-2 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground ${
                collapsed ? "justify-center" : "justify-start gap-3"
              }`}
            >
              <Avatar className="h-8 w-8 shrink-0">
                <AvatarImage src={user.avatarUrl || undefined} />
                <AvatarFallback className="bg-primary/20 text-primary">{user.name?.charAt(0)?.toUpperCase() ?? "?"}</AvatarFallback>
              </Avatar>
              {!collapsed && (
                <div className="flex flex-col items-start flex-1 min-w-0">
                  <span className="text-sm font-medium truncate w-full text-left">{user.name ?? "—"}</span>
                  <span className="text-xs text-muted-foreground truncate w-full text-left">{user.email ?? ""}</span>
                </div>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align={collapsed ? "start" : "end"} side={collapsed ? "right" : "bottom"} className="w-56">
            <DropdownMenuLabel>Minha Conta</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate("/profile")} className="cursor-pointer">
              <User className="mr-2 h-4 w-4" /> Perfil
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setTheme("light")} className="cursor-pointer">
              <Sun className="mr-2 h-4 w-4" /> Tema Claro
              {theme === "light" && <Check className="ml-auto h-4 w-4" />}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setTheme("dark")} className="cursor-pointer">
              <Moon className="mr-2 h-4 w-4" /> Tema Escuro
              {theme === "dark" && <Check className="ml-auto h-4 w-4" />}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onLogout} className="text-destructive focus:text-destructive cursor-pointer">
              <LogOut className="mr-2 h-4 w-4" /> Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </>
  );
}

function NavLink({
  href,
  icon,
  label,
  collapsed,
  exact,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  collapsed?: boolean;
  exact?: boolean;
}) {
  const [location] = useLocation();
  const { guardedNavigate } = useUnsavedGuard();
  const isActive = exact
    ? location === href
    : location === href || (href !== "/" && location.startsWith(href));

  return (
    <Button
      variant={isActive ? "secondary" : "ghost"}
      onClick={() => guardedNavigate(href)}
      title={collapsed ? label : undefined}
      aria-label={collapsed ? label : undefined}
      className={`w-full transition-all ${collapsed ? "justify-center px-0" : "justify-start gap-3"} ${isActive ? 'bg-primary/10 text-primary hover:bg-primary/20' : 'text-muted-foreground hover:text-foreground'}`}
    >
      {icon}
      {!collapsed && label}
    </Button>
  );
}
