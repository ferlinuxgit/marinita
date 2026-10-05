"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { errorMessage } from "@/core/ui/api-client";

const DEFAULT_DELAY_MS = 600;

/**
 * Autosave helper: runs API calls one after another in the order the user made the changes, and
 * debounces text edits (`schedule`) so typing does not send a request per key. Pending text is
 * saved when leaving the page inside the app, and the browser warns before closing the tab.
 */
export function useSaveQueue() {
  const [pendingCount, setPendingCount] = useState(0);
  const [scheduledCount, setScheduledCount] = useState(0);
  const [hasSaved, setHasSaved] = useState(false);
  const [error, setError] = useState("");
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const timers = useRef(new Map<string, { timeout: number; run: () => void }>());

  const enqueue = useCallback(<T,>(operation: () => Promise<T>): Promise<T | undefined> => {
    setPendingCount((count) => count + 1);
    const result = queue.current.then(operation);
    queue.current = result.catch(() => undefined);

    return result
      .then((value) => {
        setHasSaved(true);
        return value;
      })
      .catch((requestError: unknown) => {
        setError(errorMessage(requestError, "No se pudo guardar el último cambio."));
        return undefined;
      })
      .finally(() => setPendingCount((count) => count - 1));
  }, []);

  /** Runs the scheduled save for `key` now, if there is one. */
  const flush = useCallback((key: string) => {
    const timer = timers.current.get(key);

    if (timer) {
      window.clearTimeout(timer.timeout);
      timers.current.delete(key);
      setScheduledCount(timers.current.size);
      timer.run();
    }
  }, []);

  /** Schedules `run` for `key`, replacing a previous schedule with the same key. */
  const schedule = useCallback(
    (key: string, run: () => void, delay = DEFAULT_DELAY_MS) => {
      const existing = timers.current.get(key);

      if (existing) {
        window.clearTimeout(existing.timeout);
      }

      timers.current.set(key, { timeout: window.setTimeout(() => flush(key), delay), run });
      setScheduledCount(timers.current.size);
    },
    [flush],
  );

  /** Drops scheduled saves whose key starts with any of the prefixes (e.g. a deleted row). */
  const cancel = useCallback((prefixes: string[]) => {
    for (const [key, timer] of timers.current) {
      if (prefixes.some((prefix) => key.startsWith(prefix))) {
        window.clearTimeout(timer.timeout);
        timers.current.delete(key);
      }
    }
    setScheduledCount(timers.current.size);
  }, []);

  useEffect(() => {
    const pendingTimers = timers.current;

    function onBeforeUnload(event: BeforeUnloadEvent) {
      if (pendingTimers.size > 0) {
        event.preventDefault();
      }
    }

    window.addEventListener("beforeunload", onBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      for (const [key, timer] of [...pendingTimers]) {
        window.clearTimeout(timer.timeout);
        pendingTimers.delete(key);
        timer.run();
      }
    };
  }, []);

  return {
    enqueue,
    schedule,
    flush,
    cancel,
    isSaving: pendingCount > 0 || scheduledCount > 0,
    hasSaved,
    error,
    setError,
  };
}
