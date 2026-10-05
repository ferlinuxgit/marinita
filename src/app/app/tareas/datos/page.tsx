import { requirePageUser } from "@/core/auth/session";
import { DataList } from "@/modules/tareas/components/data-list";
import { listDataEntries } from "@/modules/tareas/server/data-repository";

export default async function DataPage() {
  const user = await requirePageUser();

  return <DataList entries={await listDataEntries(user.id)} />;
}
