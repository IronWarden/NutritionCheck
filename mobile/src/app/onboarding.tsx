import { router } from "expo-router";
import { useState } from "react";
import { Alert, StyleSheet, Text, TextInput, View } from "react-native";
import { Body, Button, Card, Chip, ErrorText, Heading, Screen } from "../components/ui";
import { useSession } from "../lib/session";
import { colors } from "../lib/theme";
import type { Profile } from "../lib/types";

const GOALS = ["Eat healthier overall", "Check my diet", "Long-term health", "Energy", "Gut health", "Heart health"];
const DIETS: [string, string][] = [
  ["none", "None"], ["mediterranean", "Mediterranean"], ["keto", "Keto / low-carb"], ["carnivore", "Carnivore"],
  ["vegan", "Vegan"], ["vegetarian", "Vegetarian"], ["intermittent-fasting", "Intermittent fasting"],
  ["paleo", "Paleo"], ["low-fat", "Low-fat"], ["dash", "DASH"],
];
// Any "yes" switches on safe mode (spec: Safety, medical guardrails).
const SAFETY: [string, string][] = [
  ["pregnancy", "Are you pregnant or breastfeeding?"],
  ["condition", "Do you have diabetes, kidney or liver disease, a heart condition or a food allergy?"],
  ["medication", "Do you take medication that interacts with food, such as warfarin?"],
  ["eating_disorder", "Have you had an eating disorder, or do you find tracking food stressful?"],
];

export default function Onboarding() {
  const { update } = useSession();
  const [goals, setGoals] = useState<string[]>([]);
  const [diet, setDiet] = useState("none");
  const [sex, setSex] = useState<Profile["sex"]>(null);
  const [activity, setActivity] = useState<Profile["activity"]>("moderate");
  const [birthYear, setBirthYear] = useState("");
  const [safety, setSafety] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const year = Number(birthYear);
  const age = year ? new Date().getFullYear() - year : null;
  const valid = sex && age !== null && age > 0 && age < 120 && SAFETY.every(([key]) => key in safety);

  const finish = async () => {
    const reasons = SAFETY.filter(([key]) => safety[key]).map(([key]) => key);
    if (age !== null && age < 18) reasons.push("under_18");
    setSaving(true);
    setError(null);
    try {
      await update({
        goals,
        named_diet: diet,
        sex,
        activity,
        birth_year: year,
        safe_mode: reasons.length > 0,
        safe_mode_reasons: reasons,
        hide_numbers: reasons.includes("eating_disorder"),
        onboarded: true,
      });
      if (reasons.length) {
        Alert.alert(
          "Safe mode is on",
          "You'll see general evidence, but no personal suggestions or numbers. A doctor or registered dietitian can give advice that fits your health.",
        );
      }
      router.replace("/");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen>
      <Body muted>
        This app compares how you eat with graded nutrition research. It is general information, not medical advice.
      </Body>

      <Card>
        <Heading>What are your goals?</Heading>
        <View style={styles.chips}>
          {GOALS.map((g) => (
            <Chip
              key={g}
              label={g}
              selected={goals.includes(g)}
              onPress={() =>
                setGoals((cur) => cur.includes(g) ? cur.filter((x) => x !== g) : cur.length < 2 ? [...cur, g] : cur)}
            />
          ))}
        </View>
        <Body muted>Pick up to two.</Body>
      </Card>

      <Card>
        <Heading>Do you follow a named diet?</Heading>
        <View style={styles.chips}>
          {DIETS.map(([id, label]) => <Chip key={id} label={label} selected={diet === id} onPress={() => setDiet(id)} />)}
        </View>
      </Card>

      <Card>
        <Heading>About you</Heading>
        <Body muted>Used only to set your nutrient targets.</Body>
        <View style={styles.chips}>
          <Chip label="Female" selected={sex === "female"} onPress={() => setSex("female")} />
          <Chip label="Male" selected={sex === "male"} onPress={() => setSex("male")} />
        </View>
        <TextInput
          style={styles.input}
          placeholder="Year of birth, e.g. 1994"
          placeholderTextColor={colors.muted}
          keyboardType="number-pad"
          maxLength={4}
          value={birthYear}
          onChangeText={setBirthYear}
        />
        <View style={styles.chips}>
          {(["sedentary", "moderate", "active"] as const).map((a) => (
            <Chip key={a} label={a[0].toUpperCase() + a.slice(1)} selected={activity === a} onPress={() => setActivity(a)} />
          ))}
        </View>
      </Card>

      <Card>
        <Heading>A few safety questions</Heading>
        {SAFETY.map(([key, question]) => (
          <View key={key} style={{ gap: 6 }}>
            <Text style={styles.question}>{question}</Text>
            <View style={styles.chips}>
              <Chip label="No" selected={safety[key] === false} onPress={() => setSafety((s) => ({ ...s, [key]: false }))} />
              <Chip label="Yes" selected={safety[key] === true} onPress={() => setSafety((s) => ({ ...s, [key]: true }))} />
            </View>
          </View>
        ))}
      </Card>

      <ErrorText message={error} />
      <Button label="Get started" onPress={finish} disabled={!valid} busy={saving} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  input: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 12, fontSize: 16, color: colors.text,
    backgroundColor: colors.background,
  },
  question: { fontSize: 15, color: colors.text },
});
