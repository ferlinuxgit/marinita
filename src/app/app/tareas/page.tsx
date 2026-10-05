import { Calendar } from "@/modules/tareas/components/calendar";
import { tareasConfig } from "@/modules/tareas/config";
import { isIsoDate, todayIn } from "@/modules/tareas/lib/dates";
import { isCalendarView } from "@/modules/tareas/lib/periods";

type CalendarPageProps = {
  searchParams: Promise<{ view?: string; date?: string; done?: string }>;
};

export default async function CalendarPage({ searchParams }: CalendarPageProps) {
  const params = await searchParams;
  const today = todayIn(tareasConfig.timeZone);

  return (
    <Calendar
      initialAnchor={params.date && isIsoDate(params.date) ? params.date : today}
      initialShowDone={params.done !== "0"}
      initialView={isCalendarView(params.view) ? params.view : "twoWeeks"}
      today={today}
    />
  );
}
