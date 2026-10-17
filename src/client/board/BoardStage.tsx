import { useEffect, useState } from 'react';
import type { BoardSlot, BoardView } from '../../game/types';
import { playSfx } from '../audio/sfx';

export type BulbMode = 'idle' | 'reveal' | 'strike' | 'roundWinA' | 'roundWinB' | 'gameOver';

export function BoardStage({ view, mode, revealRank = null, demo = false, showDuplicate = false, animateIntro = false, animateRoundEnd = false }: { view: BoardView; mode: BulbMode; revealRank?: number | null; demo?: boolean; showDuplicate?: boolean; animateIntro?: boolean; animateRoundEnd?: boolean }) {
  const isTitle = view.phase === 'setup';
  const gameOver = view.phase === 'gameOver';
  const status = statusText(view, showDuplicate);
  const revealedPoints = mode === 'reveal' && revealRank !== null
    ? view.slots.find((slot) => slot.rank === revealRank)?.points ?? 0
    : 0;
  const potFrom = Math.max(0, view.pot - revealedPoints);
  return (
    <div className={`board-stage mode-${mode} ${demo ? 'demo-mode' : ''}`} data-phase={view.phase}>
      <div className="stage-stars" aria-hidden="true" />
      <div className="light-bar light-bar-a" aria-hidden="true" />
      <div className="light-bar light-bar-b" aria-hidden="true" />
      <Podium view={view} team={0} />
      <Podium view={view} team={1} />
      <main className="marquee">
        <div className="bulbs" aria-hidden="true">{Array.from({ length: 48 }, (_, index) => <i key={index} />)}</div>
        <div className="title-sign" aria-label={view.title}>{view.title}</div>
        <section className="crt" aria-live="polite">
          <div className="crt-scanlines" aria-hidden="true" />
          {isTitle ? <TitleWall title={view.title} /> : gameOver ? <GameOver view={view} /> : <>
            <div className="round-bar">RUNDE {view.roundNumber} · ×{view.multiplier}<span>WIR HABEN {view.surveySize} LEUTE GEFRAGT</span></div>
            <TypedQuestion text={view.question ?? ''} animate={animateIntro} />
            <div className={`answer-grid rows-${view.slots.length}`}>{view.slots.map((slot, index) => <AnswerRow slot={slot} animateReveal={mode === 'reveal' && revealRank === slot.rank} animateEnd={animateRoundEnd && slot.state === 'end'} delay={index * 320} key={slot.rank} />)}</div>
            <div className="screen-status"><span>{status}</span><span>SUMME&nbsp;&nbsp; <AnimatedNumber value={view.pot} from={potFrom} animate={mode === 'reveal'} /></span></div>
            <div className="total-bar"><AnimatedNumber value={view.pot} from={potFrom} animate={mode === 'reveal'} /></div>
            <div className="compact-strip"><span>{'✕'.repeat(view.strikes)}{'·'.repeat(3 - view.strikes)}</span><span>{view.currentPlayer ? `${view.currentPlayer} IST DRAN` : ''}</span><span className={`mic ${view.mic}`}>● MIKRO</span></div>
          </>}
          {(mode === 'strike' || showDuplicate) && <div className={`event-overlay ${showDuplicate ? 'duplicate-overlay' : 'strike-overlay'}`}>{showDuplicate ? 'SCHON GENANNT' : '✕'}</div>}
        </section>
      </main>
      {view.phase === 'faceOff' && <div className="faceoff-pillars" aria-label="Duell"><div className={view.activeTeam === 0 ? 'lit' : ''}><i />TEAM A</div><span>DUELL</span><div className={view.activeTeam === 1 ? 'lit' : ''}><i />TEAM B</div></div>}
      <div className="floor-reflection" aria-hidden="true"><div className="reflection-glow" /></div>
    </div>
  );
}

function Podium({ view, team }: { view: BoardView; team: 0 | 1 }) {
  const data = view.teams[team];
  const winner = view.winner === team;
  return <aside className={`podium podium-${team} ${data.hasControl ? 'control' : ''} ${winner ? 'winner' : ''}`}><span className="team-label">TEAM {team === 0 ? 'A' : 'B'}</span><strong>{data.name}</strong><b>{String(data.score).padStart(3, '0')}</b></aside>;
}

function AnswerRow({ slot, animateReveal, animateEnd, delay }: { slot: BoardSlot; animateReveal: boolean; animateEnd: boolean; delay: number }) {
  return <div className={`answer-row ${slot.state} ${animateReveal ? 'animate-reveal' : ''} ${animateEnd ? 'animate-end' : ''}`} style={animateEnd ? { animationDelay: `${delay}ms` } : undefined}><span>{slot.rank}.</span><strong>{slot.state === 'hidden' ? '' : slot.label}</strong><i aria-hidden="true" /><b>{slot.state === 'hidden' ? '--' : slot.points}</b></div>;
}

function TypedQuestion({ text, animate }: { text: string; animate: boolean }) {
  const [shown, setShown] = useState(text);
  useEffect(() => {
    if (!animate || matchMedia('(prefers-reduced-motion: reduce)').matches) { setShown(text); return; }
    setShown('');
    let index = 0;
    const timer = window.setInterval(() => {
      index += 1;
      setShown(text.slice(0, index));
      if (index % 2 === 0) playSfx('tick');
      if (index >= text.length) clearInterval(timer);
    }, 30);
    return () => clearInterval(timer);
  }, [animate, text]);
  return <h1 className="question">{shown}<span aria-hidden="true" className="cursor">_</span></h1>;
}

function AnimatedNumber({ value, from, animate }: { value: number; from: number; animate: boolean }) {
  const [shown, setShown] = useState(value);
  useEffect(() => {
    if (!animate || matchMedia('(prefers-reduced-motion: reduce)').matches || from >= value) { setShown(value); return; }
    setShown(from);
    const started = performance.now();
    let frame = 0;
    const draw = (now: number) => {
      const progress = Math.min(1, (now - started) / 520);
      setShown(Math.round(from + (value - from) * progress));
      if (progress < 1) frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [animate, from, value]);
  return <>{shown}</>;
}

function TitleWall({ title }: { title: string }) {
  return <div className="pixel-wall"><span>BEREIT FÜR</span><strong>{title.split('-').map((part) => <b key={part}>{part}</b>)}</strong><em>DRÜCKT N ZUM START</em></div>;
}

function GameOver({ view }: { view: BoardView }) {
  const message = view.winner === null ? 'UNENTSCHIEDEN' : `${view.teams[view.winner].name} GEWINNT`;
  return <div className="game-over"><span>ENDSTAND</span><strong>{message}</strong><div><b>{view.teams[0].score}</b><i>:</i><b>{view.teams[1].score}</b></div><em>{view.title}</em></div>;
}

function statusText(view: BoardView, showDuplicate: boolean): string {
  if (showDuplicate) return 'SCHON GENANNT';
  if (view.phase === 'steal') return `KLAUEN! ${view.activeTeam === null ? '' : view.teams[view.activeTeam].name}`;
  if (view.phase === 'faceOff') return 'WER IST SCHNELLER?';
  if (view.phase === 'roundEnd') return view.winner === null ? 'RUNDE BEENDET' : `${view.teams[view.winner].name} GEWINNT`;
  return view.transcript || '';
}
