import { Stack } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Body, ErrorText } from "../components/ui";
import { SessionProvider, useSession } from "../lib/session";
import { colors } from "../lib/theme";

function Gate() {
  const { profile, error } = useSession();

  if (!profile) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 24 }}>
        {error ? <ErrorText message={`Couldn't start: ${error}`} /> : <ActivityIndicator color={colors.accent} />}
        {error ? <Body muted>Check that the Supabase URL and key in mobile/.env are correct.</Body> : null}
      </View>
    );
  }

  // Route guards send new users to onboarding and keep onboarded users out of it.
  // A failed guard removes its screens, so the stack falls back to the first allowed one.
  return (
    <Stack screenOptions={{ headerTintColor: colors.accent, contentStyle: { backgroundColor: colors.background } }}>
      <Stack.Protected guard={profile.onboarded}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="confirm" options={{ title: "Check your meal", presentation: "modal" }} />
        <Stack.Screen name="claim/[id]" options={{ title: "Evidence" }} />
      </Stack.Protected>
      <Stack.Protected guard={!profile.onboarded}>
        <Stack.Screen name="onboarding" options={{ title: "Welcome", headerBackVisible: false }} />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <SessionProvider>
        <Gate />
      </SessionProvider>
    </SafeAreaProvider>
  );
}
