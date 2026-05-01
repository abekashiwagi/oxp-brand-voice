"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

const STORAGE_KEY = "oxp-voice-v1-1";

type VoiceV1_1ContextValue = {
  isVoiceV1_1: boolean;
  toggleVoiceV1_1: () => void;
  setVoiceV1_1: (value: boolean) => void;
};

const VoiceV1_1Context = createContext<VoiceV1_1ContextValue | null>(null);

export function VoiceV1_1Provider({ children }: { children: React.ReactNode }) {
  const [isVoiceV1_1, setIsVoiceV1_1] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored !== null) setIsVoiceV1_1(stored === "true");
    } catch { /* ignore */ }
  }, []);

  const setVoiceV1_1 = useCallback((value: boolean) => {
    setIsVoiceV1_1(value);
    try { localStorage.setItem(STORAGE_KEY, String(value)); } catch { /* ignore */ }
  }, []);

  const toggleVoiceV1_1 = useCallback(() => {
    setVoiceV1_1(!isVoiceV1_1);
  }, [isVoiceV1_1, setVoiceV1_1]);

  return (
    <VoiceV1_1Context.Provider value={{ isVoiceV1_1, toggleVoiceV1_1, setVoiceV1_1 }}>
      {children}
    </VoiceV1_1Context.Provider>
  );
}

export function useVoiceV1_1() {
  const ctx = useContext(VoiceV1_1Context);
  if (!ctx) throw new Error("useVoiceV1_1 must be used within VoiceV1_1Provider");
  return ctx;
}
