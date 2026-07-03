import { redirect } from "next/navigation";

import { AuthForm } from "@/components/auth-form";
import { getCurrentSession } from "@/lib/session";

export default async function LoginPage() {
  const session = await getCurrentSession();

  if (session?.user) {
    redirect("/app");
  }

  return (
    <main className="auth-page">
      <section className="auth-box">
        <div className="stack">
          <div>
            <h1>Marinita</h1>
            <p className="muted">Accede para analizar y exportar resumenes de gastos.</p>
          </div>
          <AuthForm />
        </div>
      </section>
    </main>
  );
}
