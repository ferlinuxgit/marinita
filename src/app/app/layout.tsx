import { requirePageUser } from "@/core/auth/session";
import { AppShell } from "@/core/ui/app-shell";

// Every page under /app requires a session; module pages don't need to check it themselves.
export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePageUser();

  return <AppShell userEmail={user.email}>{children}</AppShell>;
}
