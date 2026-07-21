import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

const STORAGE_KEY = "flowdeck.workspace";

interface WorkspaceContextValue {
  selectedId: number | null;
  setSelectedId: (id: number) => void;
  ready: boolean;
}

const WorkspaceContext = createContext<WorkspaceContextValue | undefined>(
  undefined,
);

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const [selectedId, setSelectedIdState] = useState<number | null>(null);
  const [ready, setReady] = useState<boolean>(false);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) setSelectedIdState(Number(raw));
      } catch {
        // ignore
      } finally {
        setReady(true);
      }
    })();
  }, []);

  const setSelectedId = useCallback((id: number) => {
    setSelectedIdState(id);
    AsyncStorage.setItem(STORAGE_KEY, String(id)).catch(() => {});
  }, []);

  return (
    <WorkspaceContext.Provider value={{ selectedId, setSelectedId, ready }}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace(): WorkspaceContextValue {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) {
    throw new Error("useWorkspace must be used within a WorkspaceProvider");
  }
  return ctx;
}
