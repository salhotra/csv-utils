import { useEffect, useState } from "react";
import type { ColumnType } from "../types";

export type TypeProfiles = Record<string, Record<string, ColumnType>>;

export function useTypeProfiles(storageKey = "csvutils_type_profiles") {
  const [profiles, setProfiles] = useState<TypeProfiles>({});

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) setProfiles(JSON.parse(raw));
    } catch {
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(profiles));
    } catch {
      // ignore
    }
  }, [profiles, storageKey]);

  return { profiles, setProfiles } as const;
}
