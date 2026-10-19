import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { NutrientBars } from "../../components/NutrientBars";
import { Body, Button, Card, ErrorText, Heading, Screen } from "../../components/ui";
import { api } from "../../lib/api";
import { draft } from "../../lib/draft";
import { DAILY_KEYS, LIMIT_KEYS } from "../../lib/nutrients";
import { supabase } from "../../lib/supabase";
import { colors } from "../../lib/theme";
import type { NutritionSummary } from "../../lib/types";

// Photos are shrunk before upload: gram estimates don't need more detail, and it cuts image tokens.
const MAX_EDGE = 1024;

interface MealRow {
  id: string;
  eaten_at: string;
  meal_items: { name: string }[];
}

export default function Today() {
  const [summary, setSummary] = useState<NutritionSummary | null>(null);
  const [meals, setMeals] = useState<MealRow[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState<"photo" | "text" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    api.summary().then(setSummary).catch((e: Error) => setError(e.message));
    supabase
      .from("meals")
      .select("id, eaten_at, meal_items(name)")
      .gte("eaten_at", startOfDay.toISOString())
      .order("eaten_at", { ascending: false })
      .then(({ data }) => setMeals((data ?? []) as MealRow[]));
  }, []);

  useFocusEffect(load);

  const pickPhoto = async (fromCamera: boolean) => {
    setError(null);
    const permission = fromCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError("Permission is needed to use photos. You can describe the meal instead.");
      return;
    }
    const options: ImagePicker.ImagePickerOptions = { mediaTypes: ["images"], quality: 1 };
    const picked = fromCamera
      ? await ImagePicker.launchCameraAsync(options)
      : await ImagePicker.launchImageLibraryAsync(options);
    if (picked.canceled) return;

    const asset = picked.assets[0];
    setBusy("photo");
    try {
      const context = ImageManipulator.manipulate(asset.uri);
      context.resize(asset.width >= asset.height ? { width: MAX_EDGE } : { height: MAX_EDGE });
      const image = await context.renderAsync();
      const resized = await image.saveAsync({ base64: true, compress: 0.7, format: SaveFormat.JPEG });
      const result = await api.analyzePhoto(resized.base64!, text.trim() || undefined);
      draft.set({ ...result, source: "photo", description: text.trim() || undefined, photoUri: resized.uri });
      setText("");
      router.push("/confirm");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const describe = async () => {
    setError(null);
    setBusy("text");
    try {
      const result = await api.analyzeText(text.trim());
      draft.set({ ...result, source: "text", description: text.trim() });
      setText("");
      router.push("/confirm");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <Screen title="Today">
      <Card>
        <Button label="Take a photo of your meal" onPress={() => pickPhoto(true)} busy={busy === "photo"} disabled={!!busy} />
        <Button label="Choose a photo" kind="secondary" onPress={() => pickPhoto(false)} disabled={!!busy} />
        <TextInput
          style={styles.input}
          placeholder="Or describe it: porridge with banana and a coffee with milk"
          placeholderTextColor={colors.muted}
          multiline
          value={text}
          onChangeText={setText}
        />
        <Button label="Log from description" kind="secondary" onPress={describe} busy={busy === "text"} disabled={!!busy || !text.trim()} />
        <ErrorText message={error} />
      </Card>

      {summary ? (
        <Card>
          <Heading>Today so far</Heading>
          {summary.hide_numbers ? <Body muted>Numbers are hidden. You can change this on the Me tab.</Body> : null}
          <NutrientBars keys={DAILY_KEYS} values={summary.today} targets={summary.targets} hideNumbers={summary.hide_numbers} />
          <NutrientBars keys={LIMIT_KEYS} values={summary.today} targets={summary.targets} hideNumbers={summary.hide_numbers} />
          <Body muted>Photo estimates are approximate. Hidden salt and cooking oil are easy to miss.</Body>
        </Card>
      ) : null}

      <Card>
        <Heading>Meals today</Heading>
        {meals.length === 0 ? <Body muted>Nothing logged yet.</Body> : null}
        {meals.map((m) => (
          <View key={m.id} style={styles.meal}>
            <Text style={styles.mealTime}>
              {new Date(m.eaten_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
            </Text>
            <Text style={styles.mealItems}>{m.meal_items.map((i) => i.name).join(", ")}</Text>
          </View>
        ))}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  input: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 12, minHeight: 64, fontSize: 15,
    color: colors.text, backgroundColor: colors.background, textAlignVertical: "top",
  },
  meal: { flexDirection: "row", gap: 10 },
  mealTime: { color: colors.muted, width: 70, fontSize: 14 },
  mealItems: { flex: 1, color: colors.text, fontSize: 14 },
});
