import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { NutrientBars } from "../../components/NutrientBars";
import { Body, Button, Card, ClaimLinks, ConfidenceMeter, ErrorText, Heading, Screen } from "../../components/ui";
import { api } from "../../lib/api";
import { MICRO_KEYS } from "../../lib/nutrients";
import { supabase } from "../../lib/supabase";
import { colors } from "../../lib/theme";
import type { NutritionSummary, Verdict, VerdictItem } from "../../lib/types";

function Section({ title, items }: { title: string; items: VerdictItem[] }) {
  if (items.length === 0) return null;
  return (
    <View style={{ gap: 8 }}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {items.map((item, i) => (
        <View key={i} style={styles.item}>
          <Body>{item.text}</Body>
          <ClaimLinks claims={item.claims} />
        </View>
      ))}
    </View>
  );
}

export default function MyDiet() {
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [summary, setSummary] = useState<NutritionSummary | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  useFocusEffect(useCallback(() => {
    api.summary().then(setSummary).catch((e: Error) => setError(e.message));
    supabase
      .from("verdicts")
      .select("id, payload")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => data && setVerdict({ id: data.id, ...data.payload }));
  }, []));

  const refresh = async () => {
    setBusy(true);
    setError(null);
    setSent(false);
    try {
      setVerdict(await api.verdict());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const sendFeedback = async () => {
    if (!verdict || !feedback?.trim()) return;
    const { error: insertError } = await supabase.from("feedback").insert({ verdict_id: verdict.id, message: feedback.trim() });
    if (insertError) setError(insertError.message);
    else {
      setFeedback(null);
      setSent(true);
    }
  };

  return (
    <Screen title="My Diet">
      {verdict ? (
        <Card>
          {verdict.named_diet && verdict.named_diet !== "No particular diet"
            ? <Text style={styles.diet}>Your diet: {verdict.named_diet}</Text>
            : null}
          <Text style={styles.rating}>{verdict.rating_label}</Text>
          {verdict.confidence ? <ConfidenceMeter level={verdict.confidence} /> : null}
          <Body muted>Based on {verdict.days_logged} {verdict.days_logged === 1 ? "day" : "days"} of logged meals.</Body>

          <Section title="What the evidence supports" items={verdict.strengths} />
          <Section title="What the evidence warns about" items={verdict.gaps} />
          <Section title="Highest-impact change for you" items={verdict.suggestions} />

          {verdict.diet_evidence.length ? (
            <View style={{ gap: 4 }}>
              <Text style={styles.sectionTitle}>About your named diet</Text>
              <ClaimLinks claims={verdict.diet_evidence} />
            </View>
          ) : null}
          {verdict.related.length ? (
            <View style={{ gap: 4 }}>
              <Text style={styles.sectionTitle}>Related evidence</Text>
              <ClaimLinks claims={verdict.related} />
            </View>
          ) : null}
          {verdict.safe_mode_note ? <Body muted>{verdict.safe_mode_note}</Body> : null}

          {feedback === null
            ? <Button label={sent ? "Thanks, a reviewer will look at it" : "This seems wrong"} kind="secondary" onPress={() => setFeedback("")} disabled={sent} />
            : (
              <View style={{ gap: 8 }}>
                <TextInput
                  style={styles.input}
                  placeholder="What looks wrong?"
                  placeholderTextColor={colors.muted}
                  multiline
                  value={feedback}
                  onChangeText={setFeedback}
                />
                <Button label="Send to reviewers" kind="secondary" onPress={sendFeedback} disabled={!feedback.trim()} />
              </View>
            )}
        </Card>
      ) : (
        <Card>
          <Heading>Get your first verdict</Heading>
          <Body muted>Log meals for at least three days, then check how your eating compares with the evidence.</Body>
        </Card>
      )}

      <Button label={verdict ? "Update my verdict" : "Check my diet"} onPress={refresh} busy={busy} />
      <ErrorText message={error} />

      {summary && summary.days_logged > 0 ? (
        <Card>
          <Heading>Vitamins and minerals, 7-day average</Heading>
          <NutrientBars keys={MICRO_KEYS} values={summary.week_average} targets={summary.targets} hideNumbers={summary.hide_numbers} />
          <Body muted>Some foods in the USDA database don't list every nutrient, so low bars can be partly missing data.</Body>
        </Card>
      ) : null}

      <Body muted>General information based on published research, not medical advice.</Body>
    </Screen>
  );
}

const styles = StyleSheet.create({
  diet: { fontSize: 14, color: colors.muted },
  rating: { fontSize: 22, fontWeight: "700", color: colors.text },
  sectionTitle: { fontSize: 15, fontWeight: "600", color: colors.text, marginTop: 8 },
  item: { borderLeftWidth: 3, borderLeftColor: colors.accentSoft, paddingLeft: 10, gap: 2 },
  input: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 12, minHeight: 64, fontSize: 15,
    color: colors.text, textAlignVertical: "top",
  },
});
