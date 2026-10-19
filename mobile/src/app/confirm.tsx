import { router } from "expo-router";
import { useState } from "react";
import { Image, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Body, Button, Card, ErrorText, Heading, Screen } from "../components/ui";
import { api } from "../lib/api";
import { draft } from "../lib/draft";
import { FOOD_GROUP_LABELS } from "../lib/nutrients";
import { useSession } from "../lib/session";
import { colors } from "../lib/theme";
import type { DraftItem } from "../lib/types";

// The confirm step: the user corrects the AI's foods and amounts before anything is saved.
export default function Confirm() {
  const current = draft.get();
  const { profile } = useSession();
  const [items, setItems] = useState<DraftItem[]>(current?.items ?? []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hideNumbers = profile?.hide_numbers || profile?.safe_mode;

  if (!current) {
    return (
      <Screen>
        <Body>Nothing to confirm.</Body>
        <Button label="Back" onPress={() => router.back()} />
      </Screen>
    );
  }

  const setGrams = (index: number, value: string) => {
    const grams = Number(value.replace(/[^0-9.]/g, ""));
    setItems((list) => list.map((item, i) => (i === index ? { ...item, grams: Number.isFinite(grams) ? grams : 0 } : item)));
  };
  const remove = (index: number) => setItems((list) => list.filter((_, i) => i !== index));

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await api.saveMeal(current.source, items, current.description);
      draft.clear();
      router.back();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const kcal = items.reduce((sum, item) => sum + ((item.per_100g?.kcal ?? 0) * item.grams) / 100, 0);

  return (
    <Screen>
      {current.photoUri ? <Image source={{ uri: current.photoUri }} style={styles.photo} /> : null}

      {current.questions.length ? (
        <Card style={{ backgroundColor: colors.cautionSoft }}>
          {current.questions.map((q) => <Body key={q}>{q}</Body>)}
          <Body muted>Adjust the items below to match your answer.</Body>
        </Card>
      ) : null}

      <Card>
        <Heading>What we found</Heading>
        {items.length === 0 ? <Body muted>No foods found. Try another photo or describe the meal.</Body> : null}
        {items.map((item, index) => (
          <View key={`${item.name}-${index}`} style={styles.item}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={styles.name}>{item.name}</Text>
              <Text style={styles.meta}>
                {FOOD_GROUP_LABELS[item.food_group] ?? item.food_group}
                {item.fdc_description ? ` · matched "${item.fdc_description}"` : " · no nutrition match"}
              </Text>
              <Text style={styles.meta}>Likely {Math.round(item.grams_low)}–{Math.round(item.grams_high)} g</Text>
            </View>
            <TextInput
              style={styles.grams}
              keyboardType="decimal-pad"
              value={String(item.grams)}
              onChangeText={(v) => setGrams(index, v)}
              accessibilityLabel={`Grams of ${item.name}`}
            />
            <Text style={styles.meta}>g</Text>
            <Pressable onPress={() => remove(index)} accessibilityLabel={`Remove ${item.name}`} hitSlop={8}>
              <Text style={styles.remove}>Remove</Text>
            </Pressable>
          </View>
        ))}
        {hideNumbers || items.length === 0 ? null : <Body muted>About {Math.round(kcal)} kcal for this meal.</Body>}
      </Card>

      <ErrorText message={error} />
      <Button label="Save meal" onPress={save} busy={saving} disabled={items.length === 0} />
      <Button label="Cancel" kind="secondary" onPress={() => { draft.clear(); router.back(); }} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  photo: { width: "100%", aspectRatio: 4 / 3, borderRadius: 14 },
  item: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 6 },
  name: { fontSize: 15, fontWeight: "600", color: colors.text },
  meta: { fontSize: 12, color: colors.muted },
  grams: {
    width: 64, borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 8, textAlign: "right",
    fontSize: 15, color: colors.text,
  },
  remove: { color: colors.caution, fontSize: 13 },
});
