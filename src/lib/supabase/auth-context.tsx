import React, { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { User, Session } from "@supabase/supabase-js";
import { supabase, isSupabaseConfigured, formatAuthError } from "@/lib/supabase/client";
import type { AuthContextType, UserProfile } from "@/lib/supabase/types";
import { sanitizeRedirectPath } from "@/lib/auth/require-auth";

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Fetch or populate user profile from public.profiles
  const fetchProfile = async (currentUser: User): Promise<UserProfile | null> => {
    if (!isSupabaseConfigured) return null;
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", currentUser.id)
        .maybeSingle();

      const userMeta = (currentUser.user_metadata as Record<string, unknown> | undefined) || {};
      const fallbackDisplayName =
        (userMeta["display_name"] as string | undefined) ||
        (userMeta["full_name"] as string | undefined) ||
        (userMeta["name"] as string | undefined) ||
        currentUser.email?.split("@")[0] ||
        null;

      if (error) {
        console.warn("Could not fetch profile from profiles table:", error.message);
        // Fall back to user metadata
        return {
          id: currentUser.id,
          email: currentUser.email || null,
          display_name: fallbackDisplayName,
          created_at: currentUser.created_at,
          updated_at: currentUser.updated_at || currentUser.created_at,
        };
      }

      if (data) {
        return data as UserProfile;
      }

      // If no row exists yet, self-heal by inserting a default profile record
      const defaultProfile: UserProfile = {
        id: currentUser.id,
        email: currentUser.email || null,
        display_name: fallbackDisplayName,
        created_at: currentUser.created_at,
        updated_at: currentUser.updated_at || currentUser.created_at,
      };

      try {
        const { data: inserted, error: insertError } = await supabase
          .from("profiles")
          .insert({
            id: currentUser.id,
            email: currentUser.email || null,
            display_name: fallbackDisplayName,
          })
          .select("*")
          .maybeSingle();

        if (!insertError && inserted) {
          return inserted as UserProfile;
        }
      } catch (insertErr) {
        console.warn("Self-healing profile insert skipped:", insertErr);
      }

      return defaultProfile;
    } catch {
      return null;
    }
  };

  const refreshProfile = async () => {
    if (user) {
      const p = await fetchProfile(user);
      setProfile(p);
    }
  };

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setIsLoading(false);
      return;
    }

    let isMounted = true;

    // 1. Check active session on mount
    supabase.auth
      .getSession()
      .then(async ({ data: { session: initialSession } }) => {
        if (!isMounted) return;
        setSession(initialSession);
        setUser(initialSession?.user ?? null);
        if (initialSession?.user) {
          const p = await fetchProfile(initialSession.user);
          if (isMounted) setProfile(p);
        }
      })
      .catch((err) => {
        console.warn("Initial session recovery failed:", err);
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    // 2. Subscribe to auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      if (!isMounted) return;

      setSession(newSession);
      setUser(newSession?.user ?? null);

      if (newSession?.user) {
        const p = await fetchProfile(newSession.user);
        if (isMounted) setProfile(p);
      } else {
        setProfile(null);
      }

      if (event === "SIGNED_OUT") {
        setUser(null);
        setSession(null);
        setProfile(null);
      }

      setIsLoading(false);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signUp = async (email: string, password: string, displayName?: string) => {
    if (!isSupabaseConfigured) {
      return {
        error: new Error(
          "Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env",
        ),
        needsConfirmation: false,
      };
    }

    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            display_name: displayName?.trim() || email.split("@")[0],
          },
        },
      });

      if (error) {
        return { error: new Error(formatAuthError(error)), needsConfirmation: false };
      }

      // Check if email confirmation is required
      // When email confirmation is enabled, data.user is set but data.session is null
      const needsConfirmation = Boolean(data.user && !data.session);

      if (data.session && data.user) {
        setUser(data.user);
        setSession(data.session);
        const p = await fetchProfile(data.user);
        setProfile(p);
      }

      return { error: null, needsConfirmation };
    } catch (err) {
      return { error: new Error(formatAuthError(err)), needsConfirmation: false };
    }
  };

  const signIn = async (email: string, password: string) => {
    if (!isSupabaseConfigured) {
      return {
        error: new Error(
          "Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env",
        ),
      };
    }

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        return { error: new Error(formatAuthError(error)) };
      }

      if (data.session && data.user) {
        setUser(data.user);
        setSession(data.session);
        const p = await fetchProfile(data.user);
        setProfile(p);
      }

      return { error: null };
    } catch (err) {
      return { error: new Error(formatAuthError(err)) };
    }
  };

  const signOut = async () => {
    if (!isSupabaseConfigured) {
      setUser(null);
      setSession(null);
      setProfile(null);
      return { error: null };
    }

    try {
      const { error } = await supabase.auth.signOut();
      setUser(null);
      setSession(null);
      setProfile(null);
      if (error) {
        return { error: new Error(formatAuthError(error)) };
      }
      return { error: null };
    } catch (err) {
      setUser(null);
      setSession(null);
      setProfile(null);
      return { error: new Error(formatAuthError(err)) };
    }
  };

  const resetPasswordForEmail = async (email: string) => {
    if (!isSupabaseConfigured) {
      return {
        error: new Error(
          "Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env",
        ),
      };
    }

    try {
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${origin}/reset-password`,
      });

      if (error) {
        return { error: new Error(formatAuthError(error)) };
      }

      return { error: null };
    } catch (err) {
      return { error: new Error(formatAuthError(err)) };
    }
  };

  const updatePassword = async (newPassword: string) => {
    if (!isSupabaseConfigured) {
      return {
        error: new Error(
          "Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env",
        ),
      };
    }

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        return { error: new Error(formatAuthError(error)) };
      }

      return { error: null };
    } catch (err) {
      return { error: new Error(formatAuthError(err)) };
    }
  };

  const updateProfile = async (updates: Partial<UserProfile>) => {
    if (!isSupabaseConfigured || !user) {
      return { error: new Error("Cannot update profile: user is not signed in.") };
    }

    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq("id", user.id);

      if (error) {
        return { error: new Error(formatAuthError(error)) };
      }

      // Also update auth user metadata if display_name changed
      if (updates.display_name) {
        await supabase.auth.updateUser({
          data: { display_name: updates.display_name },
        });
      }

      await refreshProfile();
      return { error: null };
    } catch (err) {
      return { error: new Error(formatAuthError(err)) };
    }
  };

  const signInWithGoogle = async (redirectTo?: string) => {
    if (!isSupabaseConfigured) {
      return {
        error: new Error(
          "Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env",
        ),
      };
    }

    try {
      const origin =
        typeof window !== "undefined" ? window.location.origin : "http://localhost:3000";
      const safePath = sanitizeRedirectPath(redirectTo, "/dashboard");

      // Persist intended post-auth destination in sessionStorage
      if (typeof window !== "undefined") {
        try {
          window.sessionStorage.setItem("docly_auth_next", safePath);
        } catch {
          // ignore storage quota / sandbox issues
        }
      }

      // Clean canonical callback URL with no dynamic query parameters
      const callbackUrl = `${origin}/auth/callback`;

      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: callbackUrl,
          queryParams: {
            access_type: "offline",
            prompt: "consent",
          },
        },
      });

      if (error) {
        return { error: new Error(formatAuthError(error)) };
      }

      return { error: null };
    } catch (err) {
      return { error: new Error(formatAuthError(err)) };
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        isLoading,
        isConfigured: isSupabaseConfigured,
        signUp,
        signIn,
        signInWithGoogle,
        signOut,
        resetPasswordForEmail,
        updatePassword,
        updateProfile,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
