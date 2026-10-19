import { createContext, type ReactNode, useCallback, useContext, useEffect, useState } from "react";
import { supabase } from "./supabase";
import type { Profile } from "./types";

interface SessionState {
  profile: Profile | null;
  error: string | null;
  refresh: () => Promise<void>;
  update: (changes: Partial<Profile>) => Promise<void>;
}

const SessionContext = createContext<SessionState | null>(null);

// Signs the tester in anonymously on first launch and keeps their profile in memory.
export function SessionProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const { data: session } = await supabase.auth.getSession();
    let userId = session.session?.user.id;
    if (!userId) {
      const { data, error: signInError } = await supabase.auth.signInAnonymously();
      if (signInError) throw signInError;
      userId = data.user!.id;
    }
    const { data, error: profileError } = await supabase.from("profiles").select("*").eq("id", userId).single();
    if (profileError) throw profileError;
    setProfile(data as Profile);
  }, []);

  const update = useCallback(async (changes: Partial<Profile>) => {
    if (!profile) return;
    const { data, error: updateError } = await supabase
      .from("profiles")
      .update(changes)
      .eq("id", profile.id)
      .select("*")
      .single();
    if (updateError) throw updateError;
    setProfile(data as Profile);
  }, [profile]);

  useEffect(() => {
    refresh().catch((e: Error) => setError(e.message));
  }, [refresh]);

  return <SessionContext.Provider value={{ profile, error, refresh, update }}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionState {
  const value = useContext(SessionContext);
  if (!value) throw new Error("useSession must be used inside SessionProvider");
  return value;
}
