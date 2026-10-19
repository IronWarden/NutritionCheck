// Calm, neutral palette (spec: design principles). No red "bad food" warnings.
export const colors = {
  background: "#F7F6F2",
  card: "#FFFFFF",
  text: "#1F2421",
  muted: "#6B716D",
  border: "#E3E1DA",
  accent: "#2F6F5E",
  accentSoft: "#E3EFEA",
  caution: "#B7791F",
  cautionSoft: "#FBF1DF",
};

export const CONFIDENCE_LABEL = {
  high: "High",
  moderate: "Moderate",
  low: "Low",
  very_low: "Very low",
} as const;

export const CONFIDENCE_STEPS = { very_low: 1, low: 2, moderate: 3, high: 4 } as const;
