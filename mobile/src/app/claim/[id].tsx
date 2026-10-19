import { useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { Body, Card, ConfidenceMeter, ErrorText, Heading, Screen } from "../../components/ui";
import { supabase } from "../../lib/supabase";
import { colors } from "../../lib/theme";
import type { Claim } from "../../lib/types";

const TIER_LABEL: Record<number, string> = {
  1: "Systematic review or guideline",
  2: "Large randomised trial",
  3: "Large cohort study",
  4: "Small or short study",
  5: "Early research",
};

export default function ClaimDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [claim, setClaim] = useState<Claim | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase.from("claims").select("*").eq("id", id).single().then(({ data, error: loadError }) => {
      if (loadError) setError(loadError.message);
      else setClaim(data as Claim);
    });
  }, [id]);

  if (!claim) return <Screen><ErrorText message={error} /></Screen>;

  return (
    <Screen>
      {claim.review_status === "draft"
        ? (
          <Card style={{ backgroundColor: colors.cautionSoft }}>
            <Body>Draft: this summary has not yet been reviewed by a nutrition expert.</Body>
          </Card>
        )
        : null}
      <Text style={styles.title}>{claim.title}</Text>
      <ConfidenceMeter level={claim.confidence} />
      <Body>{claim.summary}</Body>

      <Card>
        <Heading>What the research found</Heading>
        <Body>{claim.effect}</Body>
        <Body muted>Who this applies to: {claim.population}</Body>
      </Card>

      <Card>
        <Heading>Why this confidence level</Heading>
        <Body>{claim.confidence_reasons}</Body>
      </Card>

      <Card>
        <Heading>Sources ({claim.sources.length})</Heading>
        {claim.sources.map((s) => (
          <View key={s.citation} style={styles.source}>
            <Text style={styles.tier}>{TIER_LABEL[s.tier]} · {s.design}</Text>
            <Pressable onPress={() => Linking.openURL(s.url)}>
              <Text style={styles.citation}>{s.citation}</Text>
            </Pressable>
          </View>
        ))}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 22, fontWeight: "700", color: colors.text, lineHeight: 28 },
  source: { gap: 2, paddingVertical: 4 },
  tier: { fontSize: 12, color: colors.muted },
  citation: { fontSize: 14, color: colors.accent, lineHeight: 19 },
});
