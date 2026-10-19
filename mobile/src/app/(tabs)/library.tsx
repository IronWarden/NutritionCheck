import { Link, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Chip, ConfidenceMeter, ErrorText, Screen } from "../../components/ui";
import { supabase } from "../../lib/supabase";
import { colors } from "../../lib/theme";
import type { Claim } from "../../lib/types";

const CATEGORIES: [string, string][] = [
  ["all", "All"], ["diet", "Diets"], ["food", "Foods"], ["nutrient", "Nutrients"],
  ["supplement", "Supplements"], ["timing", "Timing"], ["fad", "Fads"],
];

type Row = Pick<Claim, "id" | "category" | "title" | "confidence">;

export default function Library() {
  const [claims, setClaims] = useState<Row[]>([]);
  const [category, setCategory] = useState("all");
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(useCallback(() => {
    supabase
      .from("claims")
      .select("id, category, title, confidence")
      .order("title")
      .then(({ data, error: loadError }) => {
        if (loadError) setError(loadError.message);
        else setClaims(data as Row[]);
      });
  }, []));

  const query = search.trim().toLowerCase();
  const shown = claims.filter((c) =>
    (category === "all" || c.category === category) && (!query || c.title.toLowerCase().includes(query))
  );

  return (
    <Screen title="Library">
      <TextInput
        style={styles.search}
        placeholder="Search claims"
        placeholderTextColor={colors.muted}
        value={search}
        onChangeText={setSearch}
      />
      <View style={styles.chips}>
        {CATEGORIES.map(([id, label]) => (
          <Chip key={id} label={label} selected={category === id} onPress={() => setCategory(id)} />
        ))}
      </View>
      <ErrorText message={error} />
      {shown.map((c) => (
        <Link key={c.id} href={{ pathname: "/claim/[id]", params: { id: c.id } }} asChild>
          <Pressable style={styles.row}>
            <Text style={styles.title}>{c.title}</Text>
            <ConfidenceMeter level={c.confidence} />
          </Pressable>
        </Link>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  search: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 12, fontSize: 15, color: colors.text,
    backgroundColor: colors.card,
  },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  row: {
    backgroundColor: colors.card, borderRadius: 12, padding: 14, gap: 8, borderWidth: 1, borderColor: colors.border,
  },
  title: { fontSize: 15, color: colors.text, lineHeight: 20 },
});
