import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { ReportHistory } from "@/components/report-history";
import { getCurrentSession } from "@/lib/session";

export default async function ExpensesHistoryPage() {
  const session = await getCurrentSession();

  if (!session?.user) {
    redirect("/login");
  }

  return (
    <AppShell userEmail={session.user.email}>
      <ReportHistory />
    </AppShell>
  );
}
