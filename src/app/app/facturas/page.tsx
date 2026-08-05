import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { InvoiceCostCenterAnalyzer } from "@/components/invoice-cost-center-analyzer";
import { getCurrentSession } from "@/lib/session";

export default async function InvoiceCostCentersPage() {
  const session = await getCurrentSession();

  if (!session?.user) {
    redirect("/login");
  }

  return (
    <AppShell userEmail={session.user.email}>
      <InvoiceCostCenterAnalyzer />
    </AppShell>
  );
}
