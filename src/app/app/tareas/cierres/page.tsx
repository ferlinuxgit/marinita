import { requirePageUser } from "@/core/auth/session";
import { CompanyList } from "@/modules/tareas/components/company-list";
import { listCompanies } from "@/modules/tareas/server/closings-repository";

export default async function ClosingsPage() {
  const user = await requirePageUser();

  return <CompanyList initialCompanies={await listCompanies(user.id)} />;
}
