"use client";

import { CalendarDays, ClipboardCheck } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { tareasRoutes } from "@/modules/tareas/module";

const SECTIONS = [
  { href: tareasRoutes.calendar, label: "Calendario", icon: CalendarDays },
  { href: tareasRoutes.closings, label: "Cierres", icon: ClipboardCheck },
];

export function TareasNav() {
  const pathname = usePathname();
  const active = pathname.startsWith(tareasRoutes.closings) ? tareasRoutes.closings : tareasRoutes.calendar;

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
