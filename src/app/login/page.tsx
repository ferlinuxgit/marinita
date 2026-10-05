import { redirect } from "next/navigation";

import { AuthForm } from "@/core/auth/components/auth-form";
import { getCurrentSession } from "@/core/auth/session";
import { env } from "@/core/env";

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
          <AuthForm allowSignUp={env.allowSignUps} />
        </div>
      </section>
    </main>
  );
}
