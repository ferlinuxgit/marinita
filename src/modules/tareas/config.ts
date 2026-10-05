// Rules for the tasks & closings module. Keep constants here, not in the logic.
export const tareasConfig = {
  /** Time zone used to decide which calendar day is "today". */
  timeZone: "Europe/Madrid",
  /** Show Saturday and Sunday columns in the calendar. Tasks on hidden days are not shown. */
  showWeekends: false,
  /** Calendar view when the URL does not choose one: "week", "twoWeeks" or "month". */
  defaultView: "week" as const,
  /** Swatches offered in the task form. Tasks store the hex value; `null` means no color. */
  colors: [
    { value: "#2563eb", label: "Azul" },
    { value: "#0f766e", label: "Verde azulado" },
    { value: "#16a34a", label: "Verde" },
    { value: "#ca8a04", label: "Amarillo" },
    { value: "#ea580c", label: "Naranja" },
    { value: "#dc2626", label: "Rojo" },
    { value: "#db2777", label: "Rosa" },
    { value: "#7c3aed", label: "Morado" },
    { value: "#64748b", label: "Gris" },
  ],
  limits: {
    titleLength: 200,
    notesLength: 5000,
    nameLength: 200,
    /** Max days a calendar request may cover (month view needs up to 42). */
    rangeDays: 62,
    /** Max recurrence interval ("cada X ..."). */
    interval: 99,
  },
};
