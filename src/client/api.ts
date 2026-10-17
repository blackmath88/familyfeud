import type { GameConfig, Pack, Question } from '../game/types';

export async function getPacks(): Promise<Pack[]> {
  return request('/api/packs');
}

export async function getQuestions(packIds: string[], count: number, excludePlayed: boolean): Promise<Question[]> {
  const query = new URLSearchParams({ packs: packIds.join(','), count: String(count), excludePlayed: excludePlayed ? '1' : '0' });
  return request(`/api/questions?${query}`);
}

export async function createGame(config: GameConfig, questionIds: string[]): Promise<{ id: string }> {
  return request('/api/games', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ config, questionIds }) });
}

export async function persistGame(gameId: string, state: unknown): Promise<void> {
  await request(`/api/games/${gameId}`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ state }) });
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const body = await response.json() as T & { error?: string };
  if (!response.ok) throw new Error(body.error ?? 'Unbekannter Fehler');
  return body;
}
