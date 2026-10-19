import { router } from "expo-router";
import { useState } from "react";
import { StyleSheet, Switch, Text, View } from "react-native";
import { Body, Button, Card, ErrorText, Heading, Screen } from "../../components/ui";
import { useSession } from "../../lib/session";
import { supabase } from "../../lib/supabase";
import { colors } from "../../lib/theme";

export default function Me() {
  const { profile, update, refresh } = useSession();
  const [error, setError] = useState<string | null>(null);
  if (!profile) return null;

  const run = (action: () => Promise<unknown>) => () => {
    setError(null);
    action().catch((e: Error) => setError(e.message));
  };

  return (
    <Screen title="Me">
      <Card>
        <Heading>Your profile</Heading>
        <Body>Diet: {profile.named_diet === "none" ? "No particular diet" : profile.named_diet}</Body>
        <Body>Goals: {profile.goals.length ? profile.goals.join(", ") : "None set"}</Body>
        <Body>Activity: {profile.activity ?? "Not set"}</Body>
        <Button label="Edit answers" kind="secondary" onPress={run(() => update({ onboarded: false }).then(() => router.replace("/onboarding")))} />
      </Card>

      <Card>
        <Heading>Numbers</Heading>
        <View style={styles.row}>
          <Text style={styles.label}>Hide calories and nutrient numbers</Text>
          <Switch
            value={profile.hide_numbers || profile.safe_mode}
            disabled={profile.safe_mode}
            onValueChange={(value) => run(() => update({ hide_numbers: value }))()}
            trackColor={{ true: colors.accent }}
          />
        </View>
        {profile.safe_mode
          ? <Body muted>Safe mode is on, so numbers and personal suggestions stay hidden.</Body>
          : null}
      </Card>

      <Card>
        <Heading>Your data</Heading>
        <Body muted>This prototype signs you in anonymously. Signing out starts a fresh, empty account.</Body>
        <Button label="Sign out and start over" kind="secondary" onPress={run(async () => {
          await supabase.auth.signOut();
          await refresh();
        })} />
      </Card>

      <ErrorText message={error} />
      <Body muted>General information based on published research, not medical advice.</Body>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  label: { flex: 1, fontSize: 15, color: colors.text },
});
