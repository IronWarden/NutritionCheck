import { Link } from "expo-router";
import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View, type ViewStyle } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CONFIDENCE_LABEL, CONFIDENCE_STEPS, colors } from "../lib/theme";
import type { ClaimRef, Confidence } from "../lib/types";

export function Screen({ children, title }: { children: ReactNode; title?: string }) {
  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {title ? <Text style={styles.title}>{title}</Text> : null}
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Heading({ children }: { children: ReactNode }) {
  return <Text style={styles.heading}>{children}</Text>;
}

export function Body({ children, muted }: { children: ReactNode; muted?: boolean }) {
  return <Text style={[styles.body, muted && { color: colors.muted }]}>{children}</Text>;
}

export function Button({ label, onPress, kind = "primary", disabled, busy }: {
  label: string;
  onPress: () => void;
  kind?: "primary" | "secondary";
  disabled?: boolean;
  busy?: boolean;
}) {
  const primary = kind === "primary";
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled || busy}
      style={({ pressed }) => [
        styles.button,
        primary ? styles.buttonPrimary : styles.buttonSecondary,
        (disabled || busy) && { opacity: 0.5 },
        pressed && { opacity: 0.8 },
      ]}
    >
      {busy
        ? <ActivityIndicator color={primary ? "#fff" : colors.accent} />
        : <Text style={[styles.buttonText, !primary && { color: colors.accent }]}>{label}</Text>}
    </Pressable>
  );
}

export function Chip({ label, selected, onPress }: { label: string; selected?: boolean; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, selected && styles.chipSelected]}>
      <Text style={[styles.chipText, selected && { color: "#fff" }]}>{label}</Text>
    </Pressable>
  );
}

// The four-step confidence meter used on every claim (spec: confidence is visual).
export function ConfidenceMeter({ level }: { level: Confidence }) {
  const steps = CONFIDENCE_STEPS[level];
  return (
    <View style={styles.meterRow} accessibilityLabel={`Confidence: ${CONFIDENCE_LABEL[level]}`}>
      {[1, 2, 3, 4].map((i) => <View key={i} style={[styles.meterStep, i <= steps && styles.meterOn]} />)}
      <Text style={styles.meterLabel}>{CONFIDENCE_LABEL[level]} confidence</Text>
    </View>
  );
}

export function ClaimLinks({ claims }: { claims: ClaimRef[] }) {
  return (
    <View style={{ gap: 4, marginTop: 6 }}>
      {claims.map((c) => (
        <Link key={c.id} href={{ pathname: "/claim/[id]", params: { id: c.id } }} style={styles.claimLink}>
          {c.title} · {CONFIDENCE_LABEL[c.confidence]} · {c.source_count} {c.source_count === 1 ? "source" : "sources"}
        </Link>
      ))}
    </View>
  );
}

export function ProgressBar({ fraction, caution }: { fraction: number; caution?: boolean }) {
  const width = `${Math.min(100, Math.max(0, fraction * 100))}%` as const;
  return (
    <View style={styles.barTrack}>
      <View style={[styles.barFill, { width }, caution && { backgroundColor: colors.caution }]} />
    </View>
  );
}

export function ErrorText({ message }: { message: string | null }) {
  return message ? <Text style={styles.error}>{message}</Text> : null;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: 16, gap: 12, paddingBottom: 48 },
  title: { fontSize: 28, fontWeight: "700", color: colors.text, marginBottom: 4 },
  card: { backgroundColor: colors.card, borderRadius: 14, padding: 16, gap: 8, borderWidth: 1, borderColor: colors.border },
  heading: { fontSize: 17, fontWeight: "600", color: colors.text },
  body: { fontSize: 15, lineHeight: 21, color: colors.text },
  button: { borderRadius: 12, paddingVertical: 14, alignItems: "center", justifyContent: "center", minHeight: 50 },
  buttonPrimary: { backgroundColor: colors.accent },
  buttonSecondary: { backgroundColor: colors.accentSoft },
  buttonText: { color: "#fff", fontWeight: "600", fontSize: 16 },
  chip: {
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.card,
  },
  chipSelected: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipText: { color: colors.text, fontSize: 14 },
  meterRow: { flexDirection: "row", alignItems: "center", gap: 3 },
  meterStep: { width: 14, height: 6, borderRadius: 3, backgroundColor: colors.border },
  meterOn: { backgroundColor: colors.accent },
  meterLabel: { marginLeft: 6, fontSize: 13, color: colors.muted },
  claimLink: { color: colors.accent, fontSize: 13 },
  barTrack: { height: 8, borderRadius: 4, backgroundColor: colors.border, overflow: "hidden" },
  barFill: { height: 8, borderRadius: 4, backgroundColor: colors.accent },
  error: { color: colors.caution, fontSize: 14 },
});
