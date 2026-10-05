"use client";

import { Check, CircleAlert, Loader2 } from "lucide-react";

type SaveStatusProps = {
  isSaving: boolean;
  hasSaved: boolean;
  error: string;
};

/** Discreet autosave indicator. */
export function SaveStatus({ isSaving, hasSaved, error }: SaveStatusProps) {
  return (
    <span aria-live="polite" className={`tk-save-status ${error ? "error" : ""}`}>
      {error ? (
        <>
          <CircleAlert size={14} /> Error al guardar
        </>
      ) : isSaving ? (
        <>
          <Loader2 className="spin" size={14} /> Guardando…
        </>
      ) : hasSaved ? (
        <>
          <Check size={14} /> Guardado
        </>
      ) : null}
    </span>
  );
}

/** Visible warning when a change could not be saved. */
export function SaveErrorBanner({ error }: { error: string }) {
  if (!error) {
    return null;
  }

  return (
    <div className="message error tk-save-error" role="alert">
      <span>{error} Los últimos cambios pueden no haberse guardado.</span>
      <button className="button secondary" onClick={() => window.location.reload()} type="button">
        Recargar
      </button>
    </div>
  );
}
