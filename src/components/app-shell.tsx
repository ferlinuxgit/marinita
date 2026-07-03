import { FileSpreadsheet, LayoutGrid } from "lucide-react";
import Link from "next/link";

import { SignOutButton } from "@/components/sign-out-button";

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
            <Link className="topnav-link" href="/app/gastos">
              <FileSpreadsheet size={16} />
              Gastos
            </Link>
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
