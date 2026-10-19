import { useState } from "react";
import { StyleSheet, Text, TextInput } from "react-native";
import { Body, Button, Card, ClaimLinks, ConfidenceMeter, ErrorText, Screen } from "../../components/ui";
import { api } from "../../lib/api";
import { colors } from "../../lib/theme";
import type { FadResult } from "../../lib/types";

export default function FadCheck() {
  const [text, setText] = useState("");
  const [results, setResults] = useState<FadResult[] | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const check = async () => {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const response = await api.fadCheck(text.trim());
      setResults(response.results);
      setMessage(response.message ?? null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen title="Fad Check">
      <Body muted>Paste a claim, a caption or the text of a post. We'll check each claim against graded evidence.</Body>
      <TextInput
        style={styles.input}
        placeholder={"\"Seed oils are toxic and cause inflammation\""}
        placeholderTextColor={colors.muted}
        multiline
        value={text}
        onChangeText={setText}
        maxLength={4000}
      />
      <Button label="Check it" onPress={check} busy={busy} disabled={!text.trim()} />
      <ErrorText message={error} />
      {message ? <Body muted>{message}</Body> : null}

      {results?.map((r, i) => (
        <Card key={i}>
          <Text style={styles.claim}>"{r.claim}"</Text>
          <Text style={[styles.verdict, r.verdict === "not_reviewed" && { color: colors.muted }]}>{r.label}</Text>
          {r.confidence ? <ConfidenceMeter level={r.confidence} /> : null}
          <Body>{r.explanation}</Body>
          <ClaimLinks claims={r.claims} />
        </Card>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  input: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 12, minHeight: 110, fontSize: 15,
    color: colors.text, backgroundColor: colors.card, textAlignVertical: "top",
  },
  claim: { fontSize: 15, fontStyle: "italic", color: colors.muted },
  verdict: { fontSize: 20, fontWeight: "700", color: colors.text },
});
