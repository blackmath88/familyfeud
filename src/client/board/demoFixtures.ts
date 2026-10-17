import type { BoardEvent, BoardSlot, BoardView, Phase } from '../../game/types';

const answerLabels = ['ZÄHNE PUTZEN', 'LESEN', 'SCHLAFANZUG AN', 'TOILETTE', 'WECKER STELLEN', 'HANDY SCHAUEN', 'WASSER TRINKEN', 'LICHT LÖSCHEN'];
const answerPoints = [38, 17, 12, 10, 8, 7, 4, 2];

function slots(count: number, revealed = 0): BoardSlot[] {
  return Array.from({ length: count }, (_, index) => index < revealed
    ? { rank: index + 1, state: 'hit', label: answerLabels[index], points: answerPoints[index] }
    : { rank: index + 1, state: 'hidden' });
}

function fixture(label: string, phase: Phase, slotCount: number, revealed: number, event: BoardEvent | null, extras: Partial<BoardView> = {}) {
  return {
    label,
    view: {
      title: 'FAMILIEN-QUIZ', phase, roundNumber: phase === 'setup' ? 0 : 2, roundsTotal: 3, multiplier: 2,
      question: phase === 'setup' ? null : 'NENNEN SIE ETWAS, DAS MAN VOR DEM SCHLAFENGEHEN MACHT.',
      surveySize: 100, slots: slots(slotCount, revealed), strikes: 0,
      pot: answerPoints.slice(0, revealed).reduce((sum, points) => sum + points, 0),
      teams: [{ name: 'DIE UNGLAUBLICH LANGEN ORANGEN', score: 74, hasControl: true }, { name: 'BLAUE BLITZE', score: 61, hasControl: false }],
      activeTeam: 0, currentPlayer: 'Anna', winner: null, lastEvent: event, mic: 'off', transcript: null,
      ...extras,
    } satisfies BoardView,
  };
}

export const demoFixtures = [
  fixture('Titelwand · 4 Antworten', 'setup', 4, 0, null),
  fixture('Rundenstart · 6 Antworten', 'roundIntro', 6, 0, null),
  fixture('Duell · Team Orange', 'faceOff', 6, 0, null, { activeTeam: 0 }),
  fixture('Duell · Team Blau', 'faceOff', 6, 0, null, { activeTeam: 1, teams: [{ name: 'ORANGE', score: 74, hasControl: false }, { name: 'BLAUE BLITZE', score: 61, hasControl: true }] }),
  fixture('Treffer · 8 Antworten', 'playing', 8, 2, { seq: 1, type: 'reveal', rank: 2 }),
  fixture('Ein Fehler', 'playing', 8, 2, { seq: 2, type: 'strike', count: 1 }, { strikes: 1 }),
  fixture('Zwei Fehler', 'playing', 8, 2, { seq: 3, type: 'strike', count: 2 }, { strikes: 2 }),
  fixture('Drei Fehler', 'playing', 8, 2, { seq: 4, type: 'strike', count: 3 }, { strikes: 3 }),
  fixture('Schon genannt', 'playing', 6, 2, { seq: 5, type: 'duplicate' }),
  fixture('Klauen', 'steal', 6, 2, { seq: 6, type: 'steal', team: 1 }, { activeTeam: 1 }),
  fixture('Rundensieg Orange', 'roundEnd', 6, 6, { seq: 7, type: 'roundWin', team: 0, points: 184 }, { winner: 0 }),
  fixture('Rundensieg Blau', 'roundEnd', 6, 6, { seq: 8, type: 'roundWin', team: 1, points: 184 }, { winner: 1 }),
  fixture('Finale', 'gameOver', 8, 8, { seq: 9, type: 'gameOver', winner: 0 }, { winner: 0, teams: [{ name: 'ORANGE', score: 358, hasControl: false }, { name: 'BLAUE BLITZE', score: 214, hasControl: false }] }),
  fixture('Unentschieden', 'gameOver', 4, 4, { seq: 10, type: 'gameOver', winner: null }, { winner: null, teams: [{ name: 'ORANGE', score: 250, hasControl: false }, { name: 'BLAU', score: 250, hasControl: false }] }),
];
