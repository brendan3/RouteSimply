import { useState, useEffect, type ReactNode } from "react";
import { useLocation } from "wouter";
import { AdminSidebar } from "./admin-sidebar";
import { AIChat } from "@/components/chat/ai-chat";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import logoUrl from "@assets/Untitled_design_(2)_1768856385164.png";

interface AdminLayoutProps {
  children: ReactNode;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}

export function AdminLayout({ children, title, subtitle, actions }: AdminLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [location] = useLocation();

  // Close sidebar on route change (for mobile)
  useEffect(() => {
    setSidebarOpen(false);
  }, [location]);

  return (
    <div className="flex h-screen bg-gradient-to-br from-background via-background to-primary/5 relative">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 right-20 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-20 left-1/3 w-80 h-80 bg-[hsl(186,80%,45%)]/5 rounded-full blur-3xl" />
      </div>
      
      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          data-testid="overlay-sidebar-backdrop"
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      
      <AdminSidebar 
        isOpen={sidebarOpen} 
        onClose={() => setSidebarOpen(false)} 
      />
      
      <main className="flex-1 overflow-auto relative z-10">
        {/* Mobile header */}
        <div className="md:hidden flex items-center gap-3 p-4 border-b border-white/20 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur-xl sticky top-0 z-30">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(true)}
            data-testid="button-mobile-menu"
          >
            <Menu className="w-5 h-5" />
          </Button>
          <img 
            src={logoUrl} 
            alt="RouteSimply" 
            className="h-8"
          />
        </div>
        
        <div className="max-w-7xl mx-auto px-6 py-8">
          <header className="flex items-start justify-between gap-6 mb-8">
            <div>
              <h1 className="text-[32px] font-bold text-foreground tracking-tight leading-tight">
                {title}
              </h1>
              {subtitle && (
                <p className="text-[15px] text-muted-foreground mt-1">{subtitle}</p>
              )}
            </div>
            {actions && <div className="flex items-center gap-3">{actions}</div>}
          </header>
          {children}
        </div>
      </main>
      <AIChat />
    </div>
  );
}
