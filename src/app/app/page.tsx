import { FileSpreadsheet } from "lucide-react";
import { redirect } from "next/navigation";

import { ExpenseAnalyzer } from "@/components/expense-analyzer";
import { SignOutButton } from "@/components/sign-out-button";
import { getCurrentSession } from "@/lib/session";

export default async function AppPage() {
  const session = await getCurrentSession();

  if (!session?.user) {
    redirect("/login");
  }

  return (
    <div className="shell">
      <header className="topbar">
        <div className="topbar-inner">
          <div className="brand">
            <span className="brand-mark" aria-hidden="true">
              <FileSpreadsheet size={18} />
            </span>
            <span>Marinita</span>
          </div>
          <div className="row">
            <span className="muted">{session.user.email}</span>
            <SignOutButton />
          </div>
        </div>
      </header>
      <main className="main">
        <ExpenseAnalyzer />
      </main>
    </div>
  );
}
