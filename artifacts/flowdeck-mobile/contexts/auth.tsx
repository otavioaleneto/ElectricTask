import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import {
  getCurrentUser,
  login as loginApi,
  logout as logoutApi,
  type AuthUser,
} from "@workspace/api-client-react";

const STORAGE_KEY = "flowdeck.user";

interface AuthContextValue {
  user: AuthUser | null;
  initializing: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [initializing, setInitializing] = useState<boolean>(true);

  useEffect(() => {
    let mounted = true;

    (async () => {
      // Hydrate the cached user immediately for a fast, flicker-free boot.
      try {
        const cached = await AsyncStorage.getItem(STORAGE_KEY);
        if (cached && mounted) {
          setUser(JSON.parse(cached) as AuthUser);
        }
      } catch {
        // ignore cache read errors
      }

      // Verify the session cookie is still valid against the server.
      try {
        const current = await getCurrentUser();
        if (!mounted) return;
        setUser(current);
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(current));
      } catch {
        if (!mounted) return;
        setUser(null);
        await AsyncStorage.removeItem(STORAGE_KEY);
      } finally {
        if (mounted) setInitializing(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const authenticated = await loginApi({ email, password });
    setUser(authenticated);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(authenticated));
  }, []);

  const signOut = useCallback(async () => {
    try {
      await logoutApi();
    } catch {
      // Even if the network call fails, drop the local session.
    }
    setUser(null);
    await AsyncStorage.removeItem(STORAGE_KEY);
  }, []);

  return (
    <AuthContext.Provider value={{ user, initializing, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
