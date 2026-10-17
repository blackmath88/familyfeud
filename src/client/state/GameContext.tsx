import { createContext, useContext, useEffect, useMemo, useReducer, type Dispatch, type ReactNode } from 'react';
import { gameReducer, initialGameState } from '../../game/reducer';
import type { GameAction, GameState } from '../../game/types';

const STORAGE_KEY = 'fq:active-game';
export const ACTIVE_GAME_ID_KEY = 'fq:active-game-id';

interface GameContextValue {
  state: GameState;
  dispatch: Dispatch<GameAction>;
}

const GameContext = createContext<GameContextValue | null>(null);

function restore(): GameState {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as GameState | null;
    return parsed?.gameId ? parsed : initialGameState;
  } catch {
    return initialGameState;
  }
}

export function GameProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(gameReducer, undefined, restore);
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      if (state.gameId) localStorage.setItem(ACTIVE_GAME_ID_KEY, state.gameId);
      else localStorage.removeItem(ACTIVE_GAME_ID_KEY);
    } catch { /* private mode can reject writes */ }
  }, [state]);
  const value = useMemo(() => ({ state, dispatch }), [state]);
  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

export function useGame(): GameContextValue {
  const value = useContext(GameContext);
  if (!value) throw new Error('useGame must be used inside GameProvider');
  return value;
}
