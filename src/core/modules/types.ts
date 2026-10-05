import type { LucideIcon } from "lucide-react";

/**
 * Metadata every module declares in `src/modules/<id>/module.ts`.
 * Conventions derived from `id`:
 *   - pages under `src/app/app/<id>/`  → `/app/<id>`
 *   - API under   `src/app/api/<id>/`  → `/api/<id>/...`
 *   - code under  `src/modules/<id>/`
 */
export type AppModule = {
  /** URL-safe identifier, also the folder name. */
  id: string;
  /** Long name shown on the home grid. */
  name: string;
  /** Short label for the top navigation. */
  navLabel: string;
  description: string;
  icon: LucideIcon;
  /** Hide from the navigation without deleting the module. */
  enabled?: boolean;
};

export function moduleHref(appModule: Pick<AppModule, "id">, path = "") {
  return `/app/${appModule.id}${path}`;
}

export function moduleApi(appModule: Pick<AppModule, "id">, path = "") {
  return `/api/${appModule.id}${path}`;
}
