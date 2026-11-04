"use client";

import { useEffect, useRef } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { titleCaseName } from "@/lib/name";
import { readNotebook, saveStudentName, type NotebookSnapshot } from "@/lib/notebook";

export type NotebookResult = NotebookSnapshot | { error: string };

export function useNotebook() {
  return useLiveQuery(async (): Promise<NotebookResult> => {
    try {
      return await readNotebook();
    } catch {
      return { error: "NoteWise could not open storage in this browser." };
    }
  });
}

export function isNotebookError(result: NotebookResult): result is { error: string } {
  return "error" in result;
}

/** Rewrite a stored name that is not yet title case. Runs once per distinct value. */
export function useTitleCaseStoredName(name: string | undefined) {
  const tried = useRef("");
  useEffect(() => {
    if (!name || tried.current === name) return;
    const next = titleCaseName(name);
    if (!next || next === name) return;
    tried.current = name;
    void saveStudentName(next).catch(() => {
      tried.current = "";
    });
  }, [name]);
}
