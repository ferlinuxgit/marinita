"use client";

import { Check, Loader2, Pencil, X } from "lucide-react";
import { FormEvent, useState } from "react";

import { tareasConfig } from "@/modules/tareas/config";

type InlineNameEditorProps = {
  value: string;
  label: string;
  onSave: (name: string) => Promise<void>;
  children: React.ReactNode;
};

/** Shows `children` with a pencil button that turns into a small rename form. */
export function InlineNameEditor({ value, label, onSave, children }: InlineNameEditorProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [isSaving, setIsSaving] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = draft.trim();

    if (!name) {
      return;
    }

    setIsSaving(true);

    try {
      await onSave(name);
      setIsEditing(false);
    } catch {
      // The caller shows the error; keep the form open so the name is not lost.
    } finally {
      setIsSaving(false);
    }
  }

  if (!isEditing) {
    return (
      <div className="tk-inline-name">
        {children}
        <button
          aria-label={`Cambiar ${label}`}
          className="tk-icon-ghost"
          onClick={() => {
            setDraft(value);
            setIsEditing(true);
          }}
          title={`Cambiar ${label}`}
          type="button"
        >
          <Pencil size={15} />
        </button>
      </div>
    );
  }

  return (
    <form className="tk-inline-name-form" onSubmit={submit}>
      <input
        aria-label={label}
        autoFocus
        className="input"
        maxLength={tareasConfig.limits.nameLength}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => event.key === "Escape" && setIsEditing(false)}
        required
        value={draft}
      />
      <button aria-label="Guardar" className="button tk-icon-button" disabled={isSaving} type="submit">
        {isSaving ? <Loader2 className="spin" size={16} /> : <Check size={16} />}
      </button>
      <button aria-label="Cancelar" className="button secondary tk-icon-button" onClick={() => setIsEditing(false)} type="button">
        <X size={16} />
      </button>
    </form>
  );
}
