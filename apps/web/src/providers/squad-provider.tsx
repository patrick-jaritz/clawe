"use client";

import { createContext, useContext } from "react";
import type { ReactNode } from "react";

export type Squad = {
  id: string;
  name: string;
  description?: string;
};

type SquadContextType = {
  squads: Squad[];
  selectedSquad: Squad | null;
  setSelectedSquad: (squad: Squad) => void;
  isLoading: boolean;
};

const SquadContext = createContext<SquadContextType | null>(null);

const CENTAUR_SQUAD: Squad = {
  id: "centaur",
  name: "CENTAUR",
  description: "Aurel & Søren",
};

export const SquadProvider = ({ children }: { children: ReactNode }) => {
  return (
    <SquadContext.Provider
      value={{
        squads: [CENTAUR_SQUAD],
        selectedSquad: CENTAUR_SQUAD,
        setSelectedSquad: () => {},
        isLoading: false,
      }}
    >
      {children}
    </SquadContext.Provider>
  );
};

export const useSquad = () => {
  const context = useContext(SquadContext);
  if (!context) {
    throw new Error("useSquad must be used within a SquadProvider");
  }
  return context;
};
