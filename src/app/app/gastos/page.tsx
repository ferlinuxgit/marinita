import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { ExpenseAnalyzer } from "@/components/expense-analyzer";
import { getCurrentSession } from "@/lib/session";

export default async function ExpensesMiniAppPage() {
  const session = await getCurrentSession();

  if (!session?.user) {
    redirect("/login");
  }

  return (
    <AppShell userEmail={session.user.email}>
      <ExpenseAnalyzer />
    </AppShell>
  );
}
