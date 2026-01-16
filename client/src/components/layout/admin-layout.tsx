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
    <div className="flex h-screen bg-background">
      <AdminSidebar />
      <main className="flex-1 overflow-auto">
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
