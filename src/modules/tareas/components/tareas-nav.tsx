"use client";

import { CalendarDays, ClipboardCheck, Database, ListTodo } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { tareasRoutes } from "@/modules/tareas/module";

const SECTIONS = [
  { href: tareasRoutes.calendar, label: "Calendario", icon: CalendarDays },
  { href: tareasRoutes.todos, label: "Tareas", icon: ListTodo },
  { href: tareasRoutes.closings, label: "Cierres", icon: ClipboardCheck },
  { href: tareasRoutes.data, label: "Datos", icon: Database },
];

export function TareasNav() {
  const pathname = usePathname();
  const active =
    SECTIONS.slice(1).find((section) => pathname === section.href || pathname.startsWith(`${section.href}/`))?.href ??
    tareasRoutes.calendar;

  return (
    <nav aria-label="Apartados" className="tk-tabs">
      {SECTIONS.map((section) => {
        const Icon = section.icon;

        return (
          <Link
            aria-current={active === section.href ? "page" : undefined}
            className={`tk-tab ${active === section.href ? "active" : ""}`}
            href={section.href}
            key={section.href}
          >
            <Icon size={17} />
            {section.label}
          </Link>
        );
      })}
    </nav>
  );
}
