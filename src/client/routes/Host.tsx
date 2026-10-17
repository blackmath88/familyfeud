import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { toBoardView } from '../../game/boardView';
import type { GameSnapshot } from '../../game/types';
import { createGame, getQuestions, persistGame } from '../api';
import { useGame } from '../state/GameContext';
import { useHostSync } from '../sync/useHostSync';

const phaseNames = {
  setup: 'Setup', roundIntro: 'Rundenstart', faceOff: 'Duell', playing: 'Spiel',
  steal: 'Klauen', roundEnd: 'Rundenende', gameOver: 'Finale',
};

export function Host() {
  const { state, dispatch } = useGame();
  const [guess, setGuess] = useState('');
  const [muted, setMuted] = useState(() => localStorage.getItem('fq:muted') === '1');
  const [notice, setNotice] = useState('');
  const [resetting, setResetting] = useState(false);
  const resettingRef = useRef(false);
  const persistedRef = useRef('');
  const persistQueueRef = useRef<Promise<void>>(Promise.resolve());
  const view = useMemo(() => toBoardView(state), [state]);
  useHostSync(state.gameId, view);

  useEffect(() => {
    if (!state.gameId || !['roundEnd', 'gameOver'].includes(state.phase)) {
      persistedRef.current = '';
      return;
    }
    const signature = `${state.phase}:${state.round?.index}:${state.lastEvent?.seq}`;
    if (persistedRef.current === signature) return;
    persistedRef.current = signature;
    const { history: _history, ...snapshot } = state;
    const write = persistQueueRef.current.catch(() => undefined).then(() => persistGame(state.gameId, snapshot));
    persistQueueRef.current = write;
    write.catch(() => setNotice('Lokaler Spielstand ist sicher; D1-Sicherung fehlgeschlagen.'));
  }, [state]);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.repeat) return;
      const typing = event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement;
      if (typing && !['Escape'].includes(event.key)) return;
      if (/^[1-8]$/.test(event.key)) dispatch({ type: 'ACCEPT', rank: Number(event.key) });
      else if (event.key.toLowerCase() === 'x') dispatch({ type: 'STRIKE' });
      else if (event.key.toLowerCase() === 'j' && state.pending?.match.rank) dispatch({ type: 'ACCEPT', rank: state.pending.match.rank });
      else if (event.key.toLowerCase() === 'n') dispatch(state.pending ? { type: 'DISCARD' } : { type: 'NEXT' });
      else if (event.key.toLowerCase() === 'r' || event.key === 'Escape') dispatch({ type: 'DISCARD' });
      else if (event.key.toLowerCase() === 'a' && state.phase === 'faceOff') dispatch({ type: 'SET_FACEOFF_TURN', team: 0 });
      else if (event.key.toLowerCase() === 'b' && state.phase === 'faceOff') dispatch({ type: 'SET_FACEOFF_TURN', team: 1 });
      else if (event.key.toLowerCase() === 'z') dispatch({ type: 'UNDO' });
      else if (event.key.toLowerCase() === 'm') toggleMuted();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [dispatch, state.pending, state.phase]);

  if (!state.gameId || !state.round) return <Navigate replace to="/setup" />;

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!guess.trim()) return;
    event.currentTarget.querySelector('input')?.blur();
    dispatch({ type: 'GUESS', text: guess });
    setGuess('');
  }

  function openBoard() {
    window.open('/board?intro=1', 'familien-quiz-board', 'popup,width=1280,height=720');
  }

  function toggleMuted() {
    setMuted((value) => {
      const next = !value;
      localStorage.setItem('fq:muted', next ? '1' : '0');
      return next;
    });
  }

  async function reset() {
    if (resettingRef.current) return;
    resettingRef.current = true;
    setResetting(true);
    setNotice('Neue Fragen werden vorbereitet …');
    try {
      const questions = await getQuestions(state.config.packIds, state.config.rounds, !state.config.allowRepeats);
      if (questions.length < state.config.rounds) throw new Error(`Nur ${questions.length} neue Fragen verfügbar.`);
      const game = await createGame(state.config, questions.map((question) => question.id));
      dispatch({ type: 'START_GAME', gameId: game.id, config: state.config, queue: questions });
      setNotice('');
    } catch (caught) {
      setNotice(caught instanceof Error ? caught.message : 'Neues Spiel konnte nicht vorbereitet werden.');
    } finally {
      resettingRef.current = false;
      setResetting(false);
    }
  }

  const active = view.activeTeam;
  const canAnswer = ['faceOff', 'playing', 'steal'].includes(state.phase);
  const canAdvance = ['roundIntro', 'roundEnd'].includes(state.phase);
  const canSelectFaceOffStarter = state.phase === 'faceOff' && !state.pending && state.round.faceOff.results.every((result) => result === undefined);
  return (
    <main className="host-page">
      <header className="host-header">
        <div><span className="eyebrow">{phaseNames[state.phase]}</span><h1>{state.config.title}</h1><p>Runde {view.roundNumber}/{view.roundsTotal} · ×{view.multiplier}</p></div>
        <div className="header-actions"><button onClick={toggleMuted} aria-pressed={muted}>{muted ? '🔇 Stumm' : '🔊 Ton'}</button><button onClick={openBoard}>Brett öffnen</button><button onClick={() => dispatch({ type: 'UNDO' })} disabled={!state.history.length}>↶ Rückgängig</button></div>
      </header>
      {notice && <p className="notice host-notice">{notice}</p>}
      <div className="host-grid">
        <section className="host-panel mini-board"><div className="panel-title"><span>Frage {view.roundNumber}</span><strong>{view.pot} Pkt.</strong></div><h2>{state.round.question.text}</h2>
          <ol>{state.round.slots.map((slot) => <li key={slot.rank} className={slot.revealed ? 'shown' : ''}><span>{slot.rank}.</span><b>{slot.revealed || state.config.hostSeesAnswers ? slot.label : '••••••••'}</b><em>{slot.revealed || state.config.hostSeesAnswers ? slot.points : '--'}</em></li>)}</ol>
          <div className="strike-row" aria-label={`${view.strikes} Fehler`}>{[0, 1, 2].map((index) => <span key={index} className={index < view.strikes ? 'on' : ''}>✕</span>)}</div>
        </section>
        <section className="host-panel answer-panel">
          <span className="eyebrow">ANTWORT EINGEBEN</span>
          <form onSubmit={submit}><input autoFocus value={guess} onChange={(event) => setGuess(event.target.value)} placeholder="Antwort tippen …" disabled={!canAnswer || !!state.pending} /><button className="primary" disabled={!canAnswer || !!state.pending || !guess.trim()}>Prüfen ↵</button></form>
          {state.pending ? <Decision state={state} onAccept={() => state.pending?.match.rank && dispatch({ type: 'ACCEPT', rank: state.pending.match.rank })} onStrike={() => dispatch({ type: 'STRIKE' })} onDiscard={() => dispatch({ type: 'DISCARD' })} /> : <div className="decision quiet"><strong>{state.phase === 'roundIntro' ? 'Bereit für die Runde?' : state.phase === 'roundEnd' ? 'Punkte vergeben!' : state.phase === 'gameOver' ? 'Das war das Familien-Quiz!' : 'Wir hören zu.'}</strong><span>{state.phase === 'faceOff' ? 'Wer ist schneller?' : active !== null ? `${state.config.teams[active].name} ist dran.` : 'Mit N fortfahren.'}</span></div>}
          <div className="quick-actions"><button disabled={!canAnswer} onClick={() => dispatch({ type: 'STRIKE' })}>✕ Fehler</button><button disabled={!canAdvance} onClick={() => dispatch({ type: 'NEXT' })}>Weiter N</button></div>
        </section>
        <section className="host-panel teams-panel">
          {state.config.teams.map((team, index) => <article className={`host-team team-${index} ${view.activeTeam === index ? 'active' : ''}`} key={team.name}><div><span>TEAM {index === 0 ? 'A' : 'B'}</span><strong>{team.name}</strong></div><b>{state.scores[index]}</b><p>{team.players.map((player, playerIndex) => <span className={view.currentPlayer === player ? 'current' : ''} key={`${player}-${playerIndex}`}>{player}</span>)}</p><div className="faceoff-actions"><button onClick={() => dispatch({ type: 'SET_FACEOFF_TURN', team: index as 0 | 1 })} disabled={!canSelectFaceOffStarter}>Beginnt {index === 0 ? 'A' : 'B'}</button><button onClick={() => dispatch({ type: 'SET_CONTROL', team: index as 0 | 1 })} disabled={state.phase !== 'faceOff'}>Kontrolle {index === 0 ? 'A' : 'B'}</button></div></article>)}
          {state.phase === 'gameOver' && <button className="primary reset-button" onClick={reset} disabled={resetting}>{resetting ? 'Neue Fragen werden vorbereitet …' : 'Neues Spiel · gleiche Teams'}</button>}
          <Link className="text-link" to="/setup">Zur Einrichtung</Link>
        </section>
      </div>
      <details className="cheatsheet"><summary>Tastatur</summary><div><kbd>Enter</kbd> Antwort · <kbd>1–8</kbd> aufdecken · <kbd>X</kbd> Fehler · <kbd>J/N</kbd> bestätigen/verwerfen · <kbd>R</kbd> nochmals · <kbd>A/B</kbd> Duellstart · <kbd>Z</kbd> zurück · <kbd>N</kbd> weiter · <kbd>M</kbd> Ton</div></details>
    </main>
  );
}

function Decision({ state, onAccept, onStrike, onDiscard }: { state: ReturnType<typeof useGame>['state']; onAccept: () => void; onStrike: () => void; onDiscard: () => void }) {
  const pending = state.pending!;
  const label = pending.match.rank ? state.round?.slots.find((slot) => slot.rank === pending.match.rank)?.label : null;
  if (pending.match.kind === 'duplicate') return <div className="decision duplicate"><span>SCHON GENANNT</span><strong>{label}</strong><div><button onClick={onStrike}>X · Fehler</button><button onClick={onDiscard}>R · Nochmal</button></div></div>;
  if (pending.match.kind === 'unsure') return <div className="decision unsure"><span>Meinst du</span><strong>{label}?</strong><div><button onClick={onAccept}>J · Ja</button><button onClick={onDiscard}>N · Nein</button></div></div>;
  return <div className="decision miss"><span>Kein Treffer</span><strong>«{pending.text}»</strong><div><button onClick={onStrike}>X · Fehler</button><button onClick={onDiscard}>R · Nochmal</button></div></div>;
}
