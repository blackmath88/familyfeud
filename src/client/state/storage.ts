import type { GameState } from '../../game/types';

const undefinedMarker = { __fqUndefined: true } as const;

export function serializeGameState(state: GameState): string {
  return JSON.stringify(state, (_key, value) => value === undefined ? undefinedMarker : value);
}

export function parseGameState(serialized: string | null): GameState | null {
  if (!serialized) return null;
  return restoreUndefined(JSON.parse(serialized)) as GameState;
}

function restoreUndefined(value: unknown): unknown {
  if (isUndefinedMarker(value)) return undefined;
  if (Array.isArray(value)) return value.map(restoreUndefined);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, restoreUndefined(entry)]));
  }
  return value;
}

function isUndefinedMarker(value: unknown): boolean {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).length === 1 && Reflect.get(value, '__fqUndefined') === true);
}
