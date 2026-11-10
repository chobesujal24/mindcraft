import { useCallback, useEffect, useRef, useState } from "react";

export function useLocalStorage<T>(key: string, initialValue: T): [T, (value: T | ((previous: T) => T)) => void] {
  const initial = useRef(initialValue);
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw !== null) return JSON.parse(raw) as T;
    } catch {
      /* private mode or corrupt entry */
    }
    return initialValue;
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* storage can be unavailable; state still works for the session */
    }
  }, [key, value]);

  const set = useCallback((next: T | ((previous: T) => T)) => {
    setValue((previous) => {
      const resolved = typeof next === "function" ? (next as (p: T) => T)(previous) : next;
      return resolved;
    });
  }, []);

  return [value, set];
}
