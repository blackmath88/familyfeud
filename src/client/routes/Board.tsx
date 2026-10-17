import { useEffect, useRef, useState } from 'react';
import { BoardStage, type BulbMode } from '../board/BoardStage';
import { demoFixtures } from '../board/demoFixtures';
import { playSfx, unlockAudio } from '../audio/sfx';
import { ACTIVE_GAME_ID_KEY } from '../state/GameContext';
import { useBoardSync } from '../sync/useBoardSync';
import type { BoardView } from '../../game/types';

export function Board() {
  const params = new URLSearchParams(location.search);
  const demo = params.get('demo') === '1';
  const [storedGameId, setStoredGameId] = useState(() => localStorage.getItem(ACTIVE_GAME_ID_KEY) ?? '');
  const gameId = params.get('game') || storedGameId;
  const synced = useBoardSync(demo ? '' : gameId);
  const [demoIndex, setDemoIndex] = useState(0);
  const [mode, setMode] = useState<BulbMode>('idle');
  const [showDuplicate, setShowDuplicate] = useState(false);
  const [animateIntro, setAnimateIntro] = useState(false);
  const [animateRoundEnd, setAnimateRoundEnd] = useState(false);
  const [audioReady, setAudioReady] = useState(false);
  const lastSeq = useRef<number | null>(null);
  const lastPhase = useRef<string | null>(null);
  const view = demo ? demoFixtures[demoIndex].view : synced;

  useEffect(() => {
    const followNewGame = (event: StorageEvent) => {
      if (event.key === ACTIVE_GAME_ID_KEY) setStoredGameId(event.newValue ?? '');
    };
    window.addEventListener('storage', followNewGame);
    return () => window.removeEventListener('storage', followNewGame);
  }, []);

  useEffect(() => {
    if (!demo) return;
    const move = (event: KeyboardEvent) => {
      if (event.key === 'ArrowRight' || event.key === 'ArrowDown') setDemoIndex((index) => (index + 1) % demoFixtures.length);
      if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') setDemoIndex((index) => (index - 1 + demoFixtures.length) % demoFixtures.length);
    };
    window.addEventListener('keydown', move);
    return () => window.removeEventListener('keydown', move);
  }, [demo]);

  useEffect(() => {
    lastSeq.current = null;
    lastPhase.current = null;
    setMode('idle');
    setShowDuplicate(false);
    setAnimateIntro(false);
    setAnimateRoundEnd(false);
  }, [gameId]);

  useEffect(() => {
    if (!view) return;
    const firstSnapshot = lastPhase.current === null;
    if (!firstSnapshot && view.phase === 'roundIntro' && lastPhase.current !== 'roundIntro') {
      setAnimateIntro(true);
      playSfx('intro');
    } else if (view.phase !== 'roundIntro' || firstSnapshot) {
      setAnimateIntro(false);
    }
    if (!firstSnapshot && view.phase === 'roundEnd' && lastPhase.current !== 'roundEnd') setAnimateRoundEnd(true);
    else if (view.phase !== 'roundEnd' || firstSnapshot) setAnimateRoundEnd(false);
    lastPhase.current = view.phase;
    const event = view.lastEvent;
    if (!event || (!demo && firstSnapshot) || (!demo && event.seq <= (lastSeq.current ?? -1))) {
      setMode(view.phase === 'gameOver' ? 'gameOver' : 'idle');
      setShowDuplicate(false);
      lastSeq.current = event?.seq ?? null;
      return;
    }
    lastSeq.current = event.seq;
    setShowDuplicate(event.type === 'duplicate');
    if (event.type === 'reveal') { setMode('reveal'); playSfx('ding'); }
    else if (event.type === 'strike') { setMode('strike'); playSfx('strike'); }
    else if (event.type === 'roundWin') {
      const winnerMode = event.team === 0 ? 'roundWinA' : 'roundWinB';
      if (event.revealRank !== undefined) {
        setMode('reveal');
        playSfx('ding');
        const timer = window.setTimeout(() => {
          setMode(winnerMode);
          playSfx('win');
          playSfx('crowd');
        }, 800);
        return () => clearTimeout(timer);
      }
      setMode(winnerMode);
      playSfx('win');
      playSfx('crowd');
    }
    else if (event.type === 'gameOver') { setMode('gameOver'); playSfx('win'); }
    else setMode('idle');
    if (event.type === 'reveal' || event.type === 'strike') {
      const timer = window.setTimeout(() => setMode('idle'), event.type === 'strike' ? 950 : 800);
      return () => clearTimeout(timer);
    }
  }, [demo, demoIndex, view]);

  async function enableAudio() {
    await unlockAudio();
    setAudioReady(true);
    playSfx('intro');
  }

  if (!view) return <main className="board-wait"><div className="wait-logo">FAMILIEN<br />QUIZ</div><p>Warte auf den Spielleiter …</p><small>Öffne dieses Brett über «Brett öffnen» im Host-Fenster.</small></main>;
  return <>
    <BoardStage view={view} mode={mode} demo={demo} showDuplicate={showDuplicate} animateIntro={animateIntro} animateRoundEnd={animateRoundEnd} />
    {demo && <aside className="demo-controls"><button aria-label="Vorheriger Demo-Zustand" onClick={() => setDemoIndex((demoIndex - 1 + demoFixtures.length) % demoFixtures.length)}>←</button><span><b>DEMO {demoIndex + 1}/{demoFixtures.length}</b>{demoFixtures[demoIndex].label}</span><button aria-label="Nächster Demo-Zustand" onClick={() => setDemoIndex((demoIndex + 1) % demoFixtures.length)}>→</button>{!audioReady && <button className="audio-unlock" onClick={enableAudio}>Ton aktivieren</button>}</aside>}
    {!demo && !audioReady && <button className="board-audio-unlock" onClick={enableAudio}>Ton aktivieren</button>}
  </>;
}
