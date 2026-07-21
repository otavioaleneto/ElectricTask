import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useState } from "react";

// Persisted on/off preference for the mind map "energy effects" (animated
// wires, sparks, flashes). Mirrors the web editor's toggle; defaults to on.
// System reduce-motion is combined by callers and always wins.
const STORAGE_KEY = "flowdeck.mindmap-energy";

export function useEnergyPref(): [boolean, () => void] {
  const [energyOn, setEnergyOn] = useState(true);

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (!cancelled && raw === "off") setEnergyOn(false);
      })
      .catch(() => {
        // Persistence is best-effort; keep the default.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const toggleEnergy = useCallback(() => {
    setEnergyOn((v) => {
      const next = !v;
      AsyncStorage.setItem(STORAGE_KEY, next ? "on" : "off").catch(() => {});
      return next;
    });
  }, []);

  return [energyOn, toggleEnergy];
}
