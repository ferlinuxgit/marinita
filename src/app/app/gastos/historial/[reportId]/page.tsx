import { ReportDetail } from "@/modules/gastos/components/report-detail";

type ReportPageProps = {
  params: Promise<{
    reportId: string;
  }>;
};

export default async function ExpensesHistoryDetailPage({ params }: ReportPageProps) {
  const { reportId } = await params;

  return <ReportDetail reportId={reportId} />;
}
