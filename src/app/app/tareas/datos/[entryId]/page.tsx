import { requirePageUser } from "@/core/auth/session";
import { orNotFound } from "@/core/http/pages";
import { DataEntryEditor } from "@/modules/tareas/components/data-entry-editor";
import { getDataEntry } from "@/modules/tareas/server/data-repository";

type DataEntryPageProps = {
  params: Promise<{ entryId: string }>;
};

export default async function DataEntryPage({ params }: DataEntryPageProps) {
  const user = await requirePageUser();
  const { entryId } = await params;
  const entry = await orNotFound(getDataEntry(user.id, entryId));

  return <DataEntryEditor entry={entry} key={entry.id} />;
}
