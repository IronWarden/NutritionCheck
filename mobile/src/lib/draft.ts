// Holds the meal being confirmed while the user moves from the Today tab to the confirm screen.
import type { AnalyzeResult } from "./types";

export interface Draft extends AnalyzeResult {
  source: "photo" | "text";
  description?: string;
  photoUri?: string;
}

let current: Draft | null = null;

export const draft = {
  set(next: Draft) {
    current = next;
  },
  get() {
    return current;
  },
  clear() {
    current = null;
  },
};
