import React, { createContext, useContext, useState, useEffect } from "react";

type WorkspaceContextType = {
  activeWorkspaceId: number | null;
  setActiveWorkspaceId: (id: number | null) => void;
};

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<number | null>(() => {
    const saved = localStorage.getItem("flowdeck-workspace");
    return saved ? parseInt(saved, 10) : null;
  });

  useEffect(() => {
    if (activeWorkspaceId) {
      localStorage.setItem("flowdeck-workspace", activeWorkspaceId.toString());
    } else {
      localStorage.removeItem("flowdeck-workspace");
    }
  }, [activeWorkspaceId]);

  return (
    <WorkspaceContext.Provider value={{ activeWorkspaceId, setActiveWorkspaceId }}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (!context) {
    throw new Error("useWorkspace must be used within a WorkspaceProvider");
  }
  return context;
}
