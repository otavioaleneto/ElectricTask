import { createContext, useContext, useState, type ReactNode } from "react";

export type FloatingTaskInfo = {
  taskId: number;
  projectId: number;
  workspaceId: number;
};

type FloatingTaskContextValue = {
  floating: FloatingTaskInfo | null;
  expanded: boolean;
  floatTask: (info: FloatingTaskInfo) => void;
  openFloating: () => void;
  minimizeFloating: () => void;
  closeFloating: () => void;
};

const FloatingTaskContext = createContext<FloatingTaskContextValue | null>(null);

export function FloatingTaskProvider({ children }: { children: ReactNode }) {
  const [floating, setFloating] = useState<FloatingTaskInfo | null>(null);
  const [expanded, setExpanded] = useState(false);

  const floatTask = (info: FloatingTaskInfo) => {
    setFloating(info);
    setExpanded(false);
  };
  const openFloating = () => setExpanded(true);
  const minimizeFloating = () => setExpanded(false);
  const closeFloating = () => {
    setFloating(null);
    setExpanded(false);
  };

  return (
    <FloatingTaskContext.Provider
      value={{
        floating,
        expanded,
        floatTask,
        openFloating,
        minimizeFloating,
        closeFloating,
      }}
    >
      {children}
    </FloatingTaskContext.Provider>
  );
}

export function useFloatingTask() {
  const ctx = useContext(FloatingTaskContext);
  if (!ctx) {
    throw new Error("useFloatingTask must be used within FloatingTaskProvider");
  }
  return ctx;
}
