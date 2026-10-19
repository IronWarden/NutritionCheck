import { StyleSheet, Text, View } from "react-native";
import { formatAmount, NUTRIENT_INFO } from "../lib/nutrients";
import { colors } from "../lib/theme";
import type { NutrientKey, Nutrients, Target } from "../lib/types";
import { ProgressBar } from "./ui";

// One bar per nutrient against its target. With numbers hidden, only the bars show.
export function NutrientBars({ keys, values, targets, hideNumbers }: {
  keys: NutrientKey[];
  values: Nutrients;
  targets: Target[];
  hideNumbers: boolean;
}) {
  return (
    <View style={{ gap: 10 }}>
      {keys.map((key) => {
        const target = targets.find((t) => t.key === key);
        if (!target) return null;
        const value = values[key] ?? 0;
        const { label, unit } = NUTRIENT_INFO[key];
        const limit = target.kind === "limit";
        return (
          <View key={key} style={{ gap: 4 }}>
            <View style={styles.row}>
              <Text style={styles.label}>{label}{limit ? " (limit)" : ""}</Text>
              {hideNumbers ? null : (
                <Text style={styles.value}>{formatAmount(value, unit)} / {formatAmount(target.amount, unit)}</Text>
              )}
            </View>
            <ProgressBar fraction={value / target.amount} caution={limit && value > target.amount} />
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", justifyContent: "space-between" },
  label: { fontSize: 14, color: colors.text },
  value: { fontSize: 13, color: colors.muted },
});
