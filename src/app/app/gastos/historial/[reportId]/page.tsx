import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { ReportDetail } from "@/components/report-detail";
import { getCurrentSession } from "@/lib/session";

type ReportPageProps = {
  params: Promise<{
    reportId: string;
  }>;
};

export default async function ExpensesHistoryDetailPage({ params }: ReportPageProps) {
  const session = await getCurrentSession();

  if (!session?.user) {
    redirect("/login");
  }

  const { reportId } = await params;

  return (
    <AppShell userEmail={session.user.email}>
      <ReportDetail reportId={reportId} />
    </AppShell>
  );
}
