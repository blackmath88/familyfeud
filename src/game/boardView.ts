import type { BoardView, GameState } from './types';

export interface BoardUiState {
  mic?: BoardView['mic'];
  transcript?: string | null;
}

export function toBoardView(state: GameState, ui: BoardUiState = {}): BoardView {
  const round = state.round;
  const activeTeam = !round ? null
    : state.phase === 'faceOff' ? round.faceOff.turn
    : state.phase === 'playing' ? round.control
    : state.phase === 'steal' && round.control !== null ? (round.control === 0 ? 1 : 0)
    : null;
  const currentPlayer = activeTeam === null ? null : state.config.teams[activeTeam].players[
    state.phase === 'faceOff' ? state.faceOffTurn[activeTeam] : state.turn[activeTeam]
  ] ?? null;
  const winner = state.phase === 'gameOver'
    ? state.scores[0] === state.scores[1] ? null : state.scores[0] > state.scores[1] ? 0 : 1
    : round?.winner ?? null;
  return {
    title: state.config.title,
    phase: state.phase,
    roundNumber: round ? round.index + 1 : 0,
    roundsTotal: state.config.rounds,
    multiplier: round?.multiplier ?? 1,
    question: round?.question.text.toLocaleUpperCase('de-CH') ?? null,
    surveySize: round?.question.surveySize ?? 0,
    slots: round?.slots.map((slot) => slot.revealed === null
      ? { rank: slot.rank, state: 'hidden' as const }
      : { rank: slot.rank, state: slot.revealed, label: slot.label.toLocaleUpperCase('de-CH'), points: slot.points }) ?? [],
    strikes: round?.strikes ?? 0,
    pot: round?.pot ?? 0,
    teams: state.config.teams.map((team, index) => ({
      name: team.name,
      score: state.scores[index],
      hasControl: round?.control === index,
    })),
    activeTeam,
    currentPlayer,
    winner,
    lastEvent: state.lastEvent,
    mic: ui.mic ?? 'off',
    transcript: ui.transcript ?? null,
  };
}
