import { type ReactNode } from "react";
import { AdminSidebar } from "./admin-sidebar";
import { AIChat } from "@/components/chat/ai-chat";

interface AdminLayoutProps {
  children: ReactNode;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}

export function AdminLayout({ children, title, subtitle, actions }: AdminLayoutProps) {
  return (
    <div className="flex h-screen bg-gradient-to-br from-background via-background to-primary/5 relative">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 right-20 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-20 left-1/3 w-80 h-80 bg-[hsl(186,80%,45%)]/5 rounded-full blur-3xl" />
      </div>
      <AdminSidebar />
      <main className="flex-1 overflow-auto relative z-10">
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
