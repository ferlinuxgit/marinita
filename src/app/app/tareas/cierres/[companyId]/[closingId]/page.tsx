import { notFound } from "next/navigation";

import { requirePageUser } from "@/core/auth/session";
import { orNotFound } from "@/core/http/pages";
import { ChecklistEditor } from "@/modules/tareas/components/checklist-editor";
import { getClosing } from "@/modules/tareas/server/closings-repository";

type ClosingPageProps = {
  params: Promise<{ companyId: string; closingId: string }>;
};

export default async function ClosingPage({ params }: ClosingPageProps) {
  const user = await requirePageUser();
  const { companyId, closingId } = await params;
  const { closing, company, items } = await orNotFound(getClosing(user.id, closingId));

  if (company.id !== companyId) {
    notFound();
  }

  return <ChecklistEditor closing={closing} company={company} initialItems={items} key={closing.id} />;
}
