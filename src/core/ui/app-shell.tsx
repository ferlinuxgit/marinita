import { LayoutGrid } from "lucide-react";
import Link from "next/link";

import { SignOutButton } from "@/core/auth/components/sign-out-button";
import { moduleHref } from "@/core/modules/types";
import { enabledModules } from "@/modules";

type AppShellProps = {
  children: React.ReactNode;
  userEmail: string;
};

export function AppShell({ children, userEmail }: AppShellProps) {
  return (
    <div className="shell">
      <header className="topbar">
        <div className="topbar-inner">
          <Link className="brand" href="/app">
            <span className="brand-mark" aria-hidden="true">
              <LayoutGrid size={18} />
            </span>
            <span>Marinita</span>
          </Link>
          <nav className="topnav" aria-label="Mini apps">
            {enabledModules().map((appModule) => {
              const Icon = appModule.icon;

              return (
                <Link className="topnav-link" href={moduleHref(appModule)} key={appModule.id}>
                  <Icon size={16} />
                  {appModule.navLabel}
                </Link>
              );
            })}
          </nav>
          <div className="row">
            <span className="muted">{userEmail}</span>
            <SignOutButton />
          </div>
        </div>
      </header>
      <main className="main">{children}</main>
    </div>
  );
}
