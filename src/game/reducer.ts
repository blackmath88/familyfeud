import { match } from './matcher';
import type {
  GameAction, GameSnapshot, GameState, Question, RoundState, TeamId,
} from './types';

export const initialGameState: GameState = {
  gameId: '',
  config: {
    title: 'FAMILIEN-QUIZ',
    teams: [{ name: 'Team A', players: ['A'] }, { name: 'Team B', players: ['B'] }],
    rounds: 3,
    multipliers: [1, 1, 3],
    packIds: ['beispiel'],
    allowRepeats: false,
    hostSeesAnswers: false,
    voice: { enabled: false, lang: 'de-DE', wakeWord: 'antwort' },
    llm: { enabled: false, autoAcceptAt: null },
  },
  phase: 'setup',
  queue: [],
  round: null,
  scores: [0, 0],
  turn: [0, 0],
  faceOffTurn: [0, 0],
  pending: null,
  lastEvent: null,
  history: [],
};

export function gameReducer(state: GameState, action: GameAction): GameState {
  if (action.type === 'UNDO') return undo(state);
  const next = reduceAction(state, action);
  if (next === state) return state;
  if (action.type === 'START_GAME') return next;
  if (action.type === 'JUDGE_RESULT' || action.type === 'DISCARD') return next;
  return { ...next, history: [...state.history, snapshot(state)].slice(-50) };
}

function reduceAction(state: GameState, action: Exclude<GameAction, { type: 'UNDO' }>): GameState {
  switch (action.type) {
    case 'START_GAME': {
      if (!action.queue.length) return state;
      const config = normalizeConfig(action.config, action.queue.length);
      return {
        ...initialGameState,
        gameId: action.gameId,
        config,
        queue: action.queue.slice(0, config.rounds),
        phase: 'roundIntro',
        round: createRound(action.queue[0], 0, multiplierFor(config, 0)),
      };
    }
    case 'NEXT':
      return advance(state);
    case 'GUESS':
      return guess(state, action.text);
    case 'JUDGE_RESULT':
      return state.pending ? { ...state, pending: { ...state.pending, judge: action.judge } } : state;
    case 'ACCEPT':
      return accept(state, action.rank);
    case 'STRIKE':
      return strike(state);
    case 'DISCARD':
      return state.pending ? { ...state, pending: null } : state;
    case 'SET_CONTROL':
      if (state.phase !== 'faceOff' || !state.round) return state;
      return { ...state, phase: 'playing', pending: null, faceOffTurn: advanceFaceOffTurns(state), round: { ...state.round, control: action.team } };
    case 'SET_FACEOFF_TURN':
      if (state.phase !== 'faceOff' || !state.round) return state;
      return { ...state, round: { ...state.round, faceOff: { ...state.round.faceOff, turn: action.team } } };
  }
}

function advance(state: GameState): GameState {
  if (state.phase === 'roundIntro' && state.round) return { ...state, phase: 'faceOff' };
  if (state.phase !== 'roundEnd' || !state.round) return state;
  const nextIndex = state.round.index + 1;
  if (nextIndex >= state.config.rounds || nextIndex >= state.queue.length) {
    const winner = state.scores[0] === state.scores[1] ? null : state.scores[0] > state.scores[1] ? 0 : 1;
    return { ...state, phase: 'gameOver', lastEvent: { seq: nextSeq(state), type: 'gameOver', winner } };
  }
  return {
    ...state,
    phase: 'roundIntro',
    round: createRound(state.queue[nextIndex], nextIndex, multiplierFor(state.config, nextIndex)),
    pending: null,
  };
}

function guess(state: GameState, text: string): GameState {
  const team = activeTeam(state);
  if (!state.round || team === null || !['faceOff', 'playing', 'steal'].includes(state.phase) || !text.trim()) return state;
  const result = match(text, state.round.slots.map((slot) => ({
    rank: slot.rank, label: slot.label, aliases: slot.aliases, revealed: slot.revealed !== null,
  })), state.config.voice.wakeWord);
  if (result.kind === 'sure' && result.rank !== null) return accept(state, result.rank);
  return {
    ...state,
    pending: { text, team, match: result },
    lastEvent: result.kind === 'duplicate' ? { seq: nextSeq(state), type: 'duplicate' } : state.lastEvent,
  };
}

function accept(state: GameState, rank: number): GameState {
  const round = state.round;
  const team = activeTeam(state);
  if (!round || team === null || !['faceOff', 'playing', 'steal'].includes(state.phase)) return state;
  const index = round.slots.findIndex((slot) => slot.rank === rank);
  if (index < 0 || round.slots[index].revealed !== null) {
    return { ...state, pending: state.pending ? { ...state.pending, match: { ...state.pending.match, kind: 'duplicate', rank } } : state.pending, lastEvent: { seq: nextSeq(state), type: 'duplicate' } };
  }
  const slots = round.slots.map((slot, slotIndex) => slotIndex === index ? { ...slot, revealed: 'hit' as const, revealedBy: team } : slot);
  const updatedRound = { ...round, slots, pot: round.pot + round.slots[index].points };
  const withReveal: GameState = {
    ...state,
    pending: null,
    round: updatedRound,
    turn: advanceTeamTurn(state.turn, team, state.config.teams[team].players.length),
    lastEvent: { seq: nextSeq(state), type: 'reveal', rank },
  };
  if (state.phase === 'faceOff') return resolveFaceOffHit(withReveal, team, rank);
  if (state.phase === 'steal') return finishRound(withReveal, team);
  if (slots.every((slot) => slot.revealed !== null)) return finishRound(withReveal, round.control ?? team);
  return withReveal;
}

function resolveFaceOffHit(state: GameState, team: TeamId, rank: number): GameState {
  const round = state.round!;
  const results = [...round.faceOff.results] as RoundState['faceOff']['results'];
  results[team] = rank;
  if (rank === 1) {
    return { ...state, phase: 'playing', faceOffTurn: advanceFaceOffTurns(state), round: { ...round, faceOff: { ...round.faceOff, results }, control: team } };
  }
  const other = otherTeam(team);
  if (results[other] === undefined) {
    return { ...state, round: { ...round, faceOff: { results, turn: other } } };
  }
  const otherRank = results[other];
  const winner = otherRank === null || (typeof otherRank === 'number' && rank < otherRank) ? team : other;
  return { ...state, phase: 'playing', faceOffTurn: advanceFaceOffTurns(state), round: { ...round, faceOff: { results, turn: team }, control: winner } };
}

function strike(state: GameState): GameState {
  const round = state.round;
  const team = activeTeam(state);
  if (!round || team === null || !['faceOff', 'playing', 'steal'].includes(state.phase)) return state;
  if (state.phase === 'faceOff') {
    const results = [...round.faceOff.results] as RoundState['faceOff']['results'];
    results[team] = null;
    const other = otherTeam(team);
    if (results[other] === undefined) {
      return {
        ...state,
        pending: null,
        turn: advanceTeamTurn(state.turn, team, state.config.teams[team].players.length),
        round: { ...round, faceOff: { results, turn: other } },
      };
    }
    const turn = advanceTeamTurn(state.turn, team, state.config.teams[team].players.length);
    if (typeof results[other] === 'number') {
      return { ...state, phase: 'playing', pending: null, turn, faceOffTurn: advanceFaceOffTurns(state), round: { ...round, faceOff: { results, turn: team }, control: other } };
    }
    const faceOffTurn: [number, number] = [
      (state.faceOffTurn[0] + 1) % state.config.teams[0].players.length,
      (state.faceOffTurn[1] + 1) % state.config.teams[1].players.length,
    ];
    return { ...state, pending: null, turn, faceOffTurn, round: { ...round, faceOff: { results: [undefined, undefined], turn: 0 } } };
  }
  if (state.phase === 'steal') {
    return finishRound({ ...state, pending: null, turn: advanceTeamTurn(state.turn, team, state.config.teams[team].players.length) }, round.control ?? otherTeam(team));
  }
  const count = Math.min(3, round.strikes + 1);
  const next: GameState = {
    ...state,
    pending: null,
    turn: advanceTeamTurn(state.turn, team, state.config.teams[team].players.length),
    round: { ...round, strikes: count },
    lastEvent: { seq: nextSeq(state), type: 'strike', count },
  };
  if (count === 3) {
    return { ...next, phase: 'steal' };
  }
  return next;
}

function finishRound(state: GameState, winner: TeamId): GameState {
  const round = state.round!;
  const slots = round.slots.map((slot) => slot.revealed === null ? { ...slot, revealed: 'end' as const } : slot);
  const award = round.pot * round.multiplier;
  const scores: [number, number] = [...state.scores];
  scores[winner] += award;
  return {
    ...state,
    phase: 'roundEnd',
    scores,
    pending: null,
    round: { ...round, slots, winner },
    lastEvent: { seq: nextSeq(state), type: 'roundWin', team: winner, points: award },
  };
}

function createRound(question: Question, index: number, multiplier: number): RoundState {
  return {
    index,
    question,
    multiplier,
    slots: question.answers.map((answer) => ({ ...answer, revealed: null })),
    strikes: 0,
    pot: 0,
    control: null,
    faceOff: { turn: 0, results: [undefined, undefined] },
    winner: null,
  };
}

function normalizeConfig(config: GameState['config'], queueLength: number): GameState['config'] {
  const rounds = Math.max(1, Math.min(config.rounds, queueLength));
  const multipliers = Array.from({ length: rounds }, (_, index) => {
    if (index === rounds - 1) return 3;
    return config.multipliers[index] ?? config.multipliers.at(-1) ?? 1;
  });
  return { ...config, rounds, multipliers };
}

function multiplierFor(config: GameState['config'], index: number): number {
  return index === config.rounds - 1 ? 3 : config.multipliers[index] ?? config.multipliers.at(-1) ?? 1;
}

function activeTeam(state: GameState): TeamId | null {
  if (!state.round) return null;
  if (state.phase === 'faceOff') return state.round.faceOff.turn;
  if (state.phase === 'playing') return state.round.control;
  if (state.phase === 'steal') return state.round.control === null ? null : otherTeam(state.round.control);
  return null;
}

function otherTeam(team: TeamId): TeamId {
  return team === 0 ? 1 : 0;
}

function nextSeq(state: GameState): number {
  return (state.lastEvent?.seq ?? 0) + 1;
}

function advanceTeamTurn(turn: [number, number], team: TeamId, players: number): [number, number] {
  const next: [number, number] = [...turn];
  next[team] = (next[team] + 1) % Math.max(1, players);
  return next;
}

function advanceFaceOffTurns(state: GameState): [number, number] {
  return [
    (state.faceOffTurn[0] + 1) % Math.max(1, state.config.teams[0].players.length),
    (state.faceOffTurn[1] + 1) % Math.max(1, state.config.teams[1].players.length),
  ];
}

function snapshot(state: GameState): GameSnapshot {
  const { history: _history, ...rest } = state;
  return structuredClone(rest);
}

function undo(state: GameState): GameState {
  const previous = state.history.at(-1);
  if (!previous) return state;
  return { ...structuredClone(previous), history: state.history.slice(0, -1) };
}
