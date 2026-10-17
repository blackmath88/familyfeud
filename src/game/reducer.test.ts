import { describe, expect, it } from 'vitest';
import { toBoardView } from './boardView';
import { gameReducer, initialGameState } from './reducer';
import type { GameAction, GameConfig, GameState, Question } from './types';

const config: GameConfig = {
  title: 'FAMILIEN-QUIZ',
  teams: [{ name: 'Orange', players: ['Anna', 'Alex'] }, { name: 'Blau', players: ['Beat', 'Bea'] }],
  rounds: 3,
  multipliers: [1, 2, 2],
  packIds: ['test'], allowRepeats: false, hostSeesAnswers: false,
  voice: { enabled: false, lang: 'de-CH', wakeWord: 'antwort' },
  llm: { enabled: false, autoAcceptAt: null },
};

function question(id: string): Question {
  return {
    id, packId: 'test', text: `Frage ${id}?`, surveySize: 100, difficulty: 1, status: 'approved',
    answers: [
      { rank: 1, label: 'Apfel', points: 40, aliases: ['äpfel'] },
      { rank: 2, label: 'Birne', points: 25, aliases: [] },
      { rank: 3, label: 'Banane', points: 20, aliases: [] },
      { rank: 4, label: 'Kiwi', points: 10, aliases: [] },
    ],
  };
}

function run(state: GameState, ...actions: GameAction[]): GameState {
  return actions.reduce(gameReducer, state);
}

function start(): GameState {
  return gameReducer(initialGameState, { type: 'START_GAME', gameId: 'g1', config, queue: [question('1'), question('2'), question('3')] });
}

describe('game reducer', () => {
  it('plays a complete deterministic game with successful and failed steals and multipliers', () => {
    let state = run(start(), { type: 'NEXT' }, { type: 'GUESS', text: 'Apfel' });
    expect(state.phase).toBe('playing');
    state = run(state,
      { type: 'GUESS', text: 'Birne' }, { type: 'GUESS', text: 'Birne' }, { type: 'STRIKE' },
      { type: 'STRIKE' }, { type: 'STRIKE' },
    );
    expect(state.phase).toBe('steal');
    state = run(state, { type: 'GUESS', text: 'Banane' });
    expect(state).toMatchObject({ phase: 'roundEnd', scores: [0, 85] });

    state = run(state, { type: 'NEXT' }, { type: 'NEXT' }, { type: 'SET_CONTROL', team: 0 },
      { type: 'ACCEPT', rank: 1 }, { type: 'STRIKE' }, { type: 'STRIKE' }, { type: 'STRIKE' }, { type: 'STRIKE' });
    expect(state).toMatchObject({ phase: 'roundEnd', scores: [80, 85] });

    state = run(state, { type: 'NEXT' }, { type: 'NEXT' }, { type: 'SET_CONTROL', team: 0 },
      { type: 'ACCEPT', rank: 1 }, { type: 'ACCEPT', rank: 2 }, { type: 'ACCEPT', rank: 3 }, { type: 'ACCEPT', rank: 4 });
    expect(state).toMatchObject({ phase: 'roundEnd', scores: [365, 85] });
    expect(state.round?.slots.every((slot) => slot.revealed !== null)).toBe(true);
    state = gameReducer(state, { type: 'NEXT' });
    expect(state).toMatchObject({ phase: 'gameOver' });
    expect(state.lastEvent).toMatchObject({ type: 'gameOver', winner: 0 });
  });

  it('lets face-off compare both hits and handles misses', () => {
    let state = run(start(), { type: 'NEXT' }, { type: 'ACCEPT', rank: 3 });
    expect(state.round?.faceOff.turn).toBe(1);
    state = gameReducer(state, { type: 'ACCEPT', rank: 2 });
    expect(state).toMatchObject({ phase: 'playing', faceOffTurn: [1, 1], round: { control: 1 } });
  });

  it('lets the host select team B as the first face-off responder', () => {
    let state = run(start(), { type: 'NEXT' }, { type: 'SET_FACEOFF_TURN', team: 1 });
    expect(state).toMatchObject({ phase: 'faceOff', round: { faceOff: { turn: 1 } } });
    state = gameReducer(state, { type: 'ACCEPT', rank: 3 });
    expect(state).toMatchObject({ phase: 'faceOff', round: { faceOff: { turn: 0, results: [undefined, 3] } } });
  });

  it('preserves the final answer rank in the round-win event', () => {
    const state = run(start(), { type: 'NEXT' }, { type: 'SET_CONTROL', team: 0 },
      { type: 'ACCEPT', rank: 1 }, { type: 'ACCEPT', rank: 2 }, { type: 'ACCEPT', rank: 3 }, { type: 'ACCEPT', rank: 4 });
    expect(state.lastEvent).toMatchObject({ type: 'roundWin', team: 0, revealRank: 4 });
  });

  it('rotates both face-off players after a rank-one win', () => {
    const state = run(start(), { type: 'NEXT' }, { type: 'ACCEPT', rank: 1 });
    expect(state).toMatchObject({ phase: 'playing', faceOffTurn: [1, 1], round: { control: 0 } });
  });

  it('rotates face-off players when the host assigns control', () => {
    const state = run(start(), { type: 'NEXT' }, { type: 'SET_CONTROL', team: 1 });
    expect(state).toMatchObject({ phase: 'playing', faceOffTurn: [1, 1], round: { control: 1 } });
  });

  it('rotates each team turn after a face-off miss', () => {
    let state = run(start(), { type: 'NEXT' }, { type: 'STRIKE' });
    expect(state).toMatchObject({ phase: 'faceOff', turn: [1, 0], round: { faceOff: { turn: 1 } } });
    state = gameReducer(state, { type: 'STRIKE' });
    expect(state).toMatchObject({ phase: 'faceOff', turn: [1, 1], faceOffTurn: [1, 1] });
  });

  it('rotates the stealing player after a failed steal', () => {
    const state = run(start(), { type: 'NEXT' }, { type: 'SET_CONTROL', team: 0 },
      { type: 'STRIKE' }, { type: 'STRIKE' }, { type: 'STRIKE' }, { type: 'STRIKE' });
    expect(state).toMatchObject({ phase: 'roundEnd', turn: [1, 1], round: { winner: 0 } });
  });

  it('restores the exact prior snapshot with undo', () => {
    const before = run(start(), { type: 'NEXT' }, { type: 'SET_CONTROL', team: 0 });
    const changed = gameReducer(before, { type: 'ACCEPT', rank: 1 });
    const undone = gameReducer(changed, { type: 'UNDO' });
    const { history: _beforeHistory, ...beforeSnapshot } = before;
    const { history: _undoneHistory, ...undoneSnapshot } = undone;
    expect(undoneSnapshot).toEqual(beforeSnapshot);
  });

  it('starts a replacement game with an empty undo history', () => {
    const completedAction = run(start(), { type: 'NEXT' }, { type: 'SET_CONTROL', team: 0 });
    expect(completedAction.history.length).toBeGreaterThan(0);
    const replacement = gameReducer(completedAction, {
      type: 'START_GAME', gameId: 'g2', config, queue: [question('4'), question('5'), question('6')],
    });
    expect(replacement).toMatchObject({ gameId: 'g2', phase: 'roundIntro', history: [] });
    expect(gameReducer(replacement, { type: 'UNDO' })).toBe(replacement);
  });

  it('never serializes hidden answer labels or points', () => {
    const view = toBoardView(start());
    const serialized = JSON.stringify(view);
    expect(view.slots.every((slot) => !('label' in slot) && !('points' in slot))).toBe(true);
    expect(serialized).not.toContain('Apfel');
    expect(serialized).not.toContain('40');
  });

  it('represents a tied game with a null winner', () => {
    const started = start();
    const state = { ...started, phase: 'roundEnd' as const, scores: [100, 100] as [number, number], round: { ...started.round!, index: 2 } };
    expect(gameReducer(state, { type: 'NEXT' }).lastEvent).toMatchObject({ type: 'gameOver', winner: null });
  });
});
