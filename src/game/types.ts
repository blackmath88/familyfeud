// Familien-Quiz — shared type contract.
// All lanes build against this file. Change it only in its own commit and log the reason in docs/DECISIONS.md.

// ───────────────────────── Content ─────────────────────────

export type PackSource = 'manual' | 'protoqa' | 'survey';

export interface Pack {
  id: string; // slug
  name: string;
  source: PackSource;
  questionCount?: number; // approved questions, returned by GET /api/packs
}

export interface Answer {
  rank: number; // 1..8, contiguous
  label: string; // as typed, e.g. "Zähne putzen"; board renders UPPERCASE; ≤ 18 chars
  points: number; // people who gave this answer
  aliases: string[]; // lowercase variants/synonyms
}

export interface Question {
  id: string;
  packId: string;
  text: string;
  surveySize: number; // default 100
  difficulty: 1 | 2 | 3;
  status: 'draft' | 'approved';
  answers: Answer[]; // 4..8, sorted by rank
}

export type QuestionInput = Omit<Question, 'id'> & { id?: string };

export interface PackFile {
  pack: Pack;
  questions: QuestionInput[];
}

// ───────────────────────── Config ─────────────────────────

export type TeamId = 0 | 1;

export interface TeamConfig {
  name: string; // e.g. "Müllers"
  players: string[]; // 1..6 names
}

export interface GameConfig {
  title: string; // default "FAMILIEN-QUIZ"
  teams: [TeamConfig, TeamConfig];
  rounds: number; // 3..10
  multipliers: number[]; // per round; missing entries → last value; last round forced ×3
  packIds: string[];
  allowRepeats: boolean;
  hostSeesAnswers: boolean; // Spielleiter-Modus
  voice: {
    enabled: boolean;
    lang: 'de-DE' | 'de-CH';
    wakeWord: string; // default "antwort"
  };
  llm: {
    enabled: boolean; // use /api/judge for unsure/miss
    autoAcceptAt: number | null; // e.g. 0.9; null = always ask host (default)
  };
}

// ───────────────────────── Matching ─────────────────────────

export type MatchKind = 'sure' | 'unsure' | 'miss' | 'duplicate';
export type MatchVia = 'exact' | 'contains' | 'phonetic' | 'fuzzy' | null;

export interface MatchResult {
  kind: MatchKind;
  rank: number | null; // best candidate (null for clear miss)
  score: number; // 0..1
  via: MatchVia;
  normalizedGuess: string;
}

export interface AnswerRef {
  rank: number;
  label: string;
  aliases: string[];
  revealed: boolean;
}

export interface JudgeRequest {
  question: string;
  answers: { rank: number; label: string; aliases: string[] }[];
  guess: string;
}

export interface JudgeResponse {
  rank: number | null;
  confidence: number; // 0..1
  reason: string; // short German explanation, or "judge_unavailable"
}

// ───────────────────────── Game state ─────────────────────────

export type Phase =
  | 'setup'
  | 'roundIntro'
  | 'faceOff'
  | 'playing'
  | 'steal'
  | 'roundEnd'
  | 'gameOver';

export type SlotReveal = null | 'hit' | 'end'; // 'end' = shown after the round, no points

export interface Slot extends Answer {
  revealed: SlotReveal;
  revealedBy?: TeamId;
}

export interface FaceOff {
  turn: TeamId; // whose face-off player answers now
  results: [number | null | undefined, number | null | undefined]; // undefined = not answered, null = miss, n = rank hit
}

export interface RoundState {
  index: number; // 0-based
  question: Question;
  multiplier: number;
  slots: Slot[];
  strikes: number; // 0..3 (playing phase only)
  pot: number; // sum of points revealed as 'hit'
  control: TeamId | null;
  faceOff: FaceOff;
  winner: TeamId | null;
}

export interface PendingGuess {
  text: string; // raw transcript or typed text
  team: TeamId;
  match: MatchResult;
  judge?: JudgeResponse; // filled by JUDGE_RESULT
}

export type BoardEvent =
  | { seq: number; type: 'reveal'; rank: number }
  | { seq: number; type: 'strike'; count: number }
  | { seq: number; type: 'duplicate' }
  | { seq: number; type: 'steal'; team: TeamId }
  | { seq: number; type: 'roundWin'; team: TeamId; points: number }
  | { seq: number; type: 'gameOver'; winner: TeamId | null };

export interface GameSnapshot {
  gameId: string;
  config: GameConfig;
  phase: Phase;
  queue: Question[]; // questions for all rounds, index = round index
  round: RoundState | null;
  scores: [number, number];
  turn: [number, number]; // next player index per team (playing/steal)
  faceOffTurn: [number, number]; // next face-off player index per team
  pending: PendingGuess | null;
  lastEvent: BoardEvent | null;
}

export interface GameState extends GameSnapshot {
  history: GameSnapshot[]; // undo stack, max 50
}

// ───────────────────────── Actions ─────────────────────────
// The reducer is pure: matching happens inside GUESS (matcher is pure too); the async judge call happens
// outside and its result comes back as JUDGE_RESULT.

export type GameAction =
  | { type: 'START_GAME'; gameId: string; config: GameConfig; queue: Question[] }
  | { type: 'NEXT' } // roundIntro→faceOff, roundEnd→roundIntro|gameOver
  | { type: 'GUESS'; text: string } // team = active team derived from phase; sure non-duplicate hit auto-accepts
  | { type: 'JUDGE_RESULT'; judge: JudgeResponse }
  | { type: 'ACCEPT'; rank: number } // confirm pending as hit on rank (J, or manual 1–8 without pending)
  | { type: 'STRIKE' } // confirm miss/duplicate (X); in faceOff records a miss, no strike count
  | { type: 'DISCARD' } // drop pending, listen again (R / Esc)
  | { type: 'SET_CONTROL'; team: TeamId } // faceOff: A/B → give control, go to playing
  | { type: 'SET_FACEOFF_TURN'; team: TeamId } // who buzzed first
  | { type: 'UNDO' };

// ───────────────────────── Board view (sent to /board) ─────────────────────────
// Derived by toBoardView(state, ui). Hidden slots carry NO label and NO points.

export interface BoardSlot {
  rank: number;
  state: 'hidden' | 'hit' | 'end';
  label?: string; // UPPERCASE, only when not hidden
  points?: number; // only when not hidden
}

export interface BoardView {
  title: string;
  phase: Phase;
  roundNumber: number; // 1-based, 0 before the first round
  roundsTotal: number;
  multiplier: number;
  question: string | null; // UPPERCASE
  surveySize: number;
  slots: BoardSlot[];
  strikes: number;
  pot: number;
  teams: { name: string; score: number; hasControl: boolean }[];
  activeTeam: TeamId | null;
  currentPlayer: string | null;
  winner: TeamId | null;
  lastEvent: BoardEvent | null;
  mic: 'off' | 'listening' | 'capturing'; // from the voice hook, not game state
  transcript: string | null; // live text of the current guess
}

// ───────────────────────── Sync messages ─────────────────────────

export type SyncMessage =
  | { type: 'hello' } // board → host: please send a snapshot
  | { type: 'board'; view: BoardView }; // host → board(s)
