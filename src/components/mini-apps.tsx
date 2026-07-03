import { ArrowRight, FileSpreadsheet } from "lucide-react";
import Link from "next/link";

const miniApps = [
  {
    href: "/app/gastos",
    name: "Gastos",
    description: "Analiza exports de Payhawk, revisa una vista previa y exporta el resumen.",
    icon: FileSpreadsheet,
  },
];

export function MiniApps() {
  return (
    <div className="grid">
      <section>
        <h1>Mini apps</h1>
        <p className="muted">Herramientas internas agrupadas por flujo de trabajo.</p>
      </section>

      <section className="mini-app-grid" aria-label="Mini apps disponibles">
        {miniApps.map((miniApp) => {
          const Icon = miniApp.icon;

          return (
            <Link className="mini-app" href={miniApp.href} key={miniApp.href}>
              <span className="mini-app-icon" aria-hidden="true">
                <Icon size={22} />
              </span>
              <span className="mini-app-content">
                <strong>{miniApp.name}</strong>
                <span>{miniApp.description}</span>
              </span>
              <ArrowRight size={18} aria-hidden="true" />
            </Link>
          );
        })}
      </section>
    </div>
  );
}
