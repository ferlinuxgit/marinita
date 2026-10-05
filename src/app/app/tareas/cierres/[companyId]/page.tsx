import { requirePageUser } from "@/core/auth/session";
import { orNotFound } from "@/core/http/pages";
import { CompanyClosings } from "@/modules/tareas/components/company-closings";
import { getCompany, listCompanies } from "@/modules/tareas/server/closings-repository";

type CompanyPageProps = {
  params: Promise<{ companyId: string }>;
};

export default async function CompanyPage({ params }: CompanyPageProps) {
  const user = await requirePageUser();
  const { companyId } = await params;
  const company = await orNotFound(getCompany(user.id, companyId));

  return <CompanyClosings companies={await listCompanies(user.id)} company={company} />;
}
