import "@/modules/tareas/tareas.css";

import { TareasNav } from "@/modules/tareas/components/tareas-nav";

export default function TareasLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="tk-module">
      <header className="tk-module-header">
        <h1>Tareas y cierres</h1>
        <TareasNav />
      </header>
      {children}
    </div>
  );
}
