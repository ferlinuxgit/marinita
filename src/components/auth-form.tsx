"use client";

import { LogIn, UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

import { authClient } from "@/lib/auth-client";

type Mode = "sign-in" | "sign-up";

export function AuthForm() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("sign-in");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isPending, setIsPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsPending(true);

    const result =
      mode === "sign-in"
        ? await authClient.signIn.email({ email, password })
        : await authClient.signUp.email({ name, email, password });

    setIsPending(false);

    if (result.error) {
      setError(result.error.message ?? "No se pudo completar la autenticacion.");
      return;
    }

    router.replace("/app");
    router.refresh();
  }

  return (
    <form className="stack" onSubmit={onSubmit}>
      <div className="row">
        <button
          className={`button ${mode === "sign-in" ? "" : "secondary"}`}
          type="button"
          onClick={() => setMode("sign-in")}
        >
          <LogIn size={16} />
          Entrar
        </button>
        <button
          className={`button ${mode === "sign-up" ? "" : "secondary"}`}
          type="button"
          onClick={() => setMode("sign-up")}
        >
          <UserPlus size={16} />
          Crear cuenta
        </button>
      </div>

      {mode === "sign-up" ? (
        <div className="field">
          <label htmlFor="name">Nombre</label>
          <input
            className="input"
            id="name"
            minLength={2}
            onChange={(event) => setName(event.target.value)}
            required
            value={name}
          />
        </div>
      ) : null}

      <div className="field">
        <label htmlFor="email">Email</label>
        <input
          autoComplete="email"
          className="input"
          id="email"
          onChange={(event) => setEmail(event.target.value)}
          required
          type="email"
          value={email}
        />
      </div>

      <div className="field">
        <label htmlFor="password">Password</label>
        <input
          autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
          className="input"
          id="password"
          minLength={8}
          onChange={(event) => setPassword(event.target.value)}
          required
          type="password"
          value={password}
        />
      </div>

      {error ? <div className="message error">{error}</div> : null}

      <button className="button" disabled={isPending} type="submit">
        {mode === "sign-in" ? <LogIn size={16} /> : <UserPlus size={16} />}
        {isPending ? "Procesando..." : mode === "sign-in" ? "Entrar" : "Crear cuenta"}
      </button>
    </form>
  );
}
