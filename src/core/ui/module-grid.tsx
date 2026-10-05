import { ArrowRight } from "lucide-react";
import Link from "next/link";

import { moduleHref } from "@/core/modules/types";
import { enabledModules } from "@/modules";

export function ModuleGrid() {
  return (
    <div className="grid">
      <section>
        <h1>Mini apps</h1>
        <p className="muted">Herramientas internas agrupadas por flujo de trabajo.</p>
      </section>

      <section className="mini-app-grid" aria-label="Mini apps disponibles">
        {enabledModules().map((appModule) => {
          const Icon = appModule.icon;

          return (
            <Link className="mini-app" href={moduleHref(appModule)} key={appModule.id}>
              <span className="mini-app-icon" aria-hidden="true">
                <Icon size={22} />
              </span>
              <span className="mini-app-content">
                <strong>{appModule.name}</strong>
                <span>{appModule.description}</span>
              </span>
              <ArrowRight size={18} aria-hidden="true" />
            </Link>
          );
        })}
      </section>
    </div>
  );
}
