import { useEffect, useState } from 'react';
import type { BoardSlot, BoardView } from '../../game/types';

export type BulbMode = 'idle' | 'reveal' | 'strike' | 'roundWinA' | 'roundWinB' | 'gameOver';

export function BoardStage({ view, mode }: { view: BoardView; mode: BulbMode }) {
  const isTitle = view.phase === 'setup';
  const isIntro = view.phase === 'roundIntro';
  const gameOver = view.phase === 'gameOver';
  const status = statusText(view);
  return (
    <div className={`board-stage mode-${mode}`} data-phase={view.phase}>
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
            <TypedQuestion text={view.question ?? ''} animate={isIntro} />
            <div className={`answer-grid rows-${view.slots.length}`}>{view.slots.map((slot) => <AnswerRow slot={slot} key={slot.rank} />)}</div>
            <div className="screen-status"><span>{status}</span><span>SUMME&nbsp;&nbsp; {view.pot}</span></div>
            <div className="total-bar">{view.pot}</div>
            <div className="compact-strip"><span>{'✕'.repeat(view.strikes)}{'·'.repeat(3 - view.strikes)}</span><span>{view.currentPlayer ? `${view.currentPlayer} IST DRAN` : ''}</span><span className={`mic ${view.mic}`}>● MIKRO</span></div>
          </>}
          {(mode === 'strike' || view.lastEvent?.type === 'duplicate') && <div className={`event-overlay ${view.lastEvent?.type === 'duplicate' ? 'duplicate-overlay' : 'strike-overlay'}`}>{view.lastEvent?.type === 'duplicate' ? 'SCHON GENANNT' : '✕'}</div>}
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

function AnswerRow({ slot }: { slot: BoardSlot }) {
  return <div className={`answer-row ${slot.state}`}><span>{slot.rank}.</span><strong>{slot.state === 'hidden' ? '' : slot.label}</strong><i aria-hidden="true" /><b>{slot.state === 'hidden' ? '--' : slot.points}</b></div>;
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
      if (index >= text.length) clearInterval(timer);
    }, 30);
    return () => clearInterval(timer);
  }, [animate, text]);
  return <h1 className="question">{shown}<span aria-hidden="true" className="cursor">_</span></h1>;
}

function TitleWall({ title }: { title: string }) {
  return <div className="pixel-wall"><span>BEREIT FÜR</span><strong>{title.split('-').map((part) => <b key={part}>{part}</b>)}</strong><em>DRÜCKT N ZUM START</em></div>;
}

function GameOver({ view }: { view: BoardView }) {
  const message = view.winner === null ? 'UNENTSCHIEDEN' : `${view.teams[view.winner].name} GEWINNT`;
  return <div className="game-over"><span>ENDSTAND</span><strong>{message}</strong><div><b>{view.teams[0].score}</b><i>:</i><b>{view.teams[1].score}</b></div><em>{view.title}</em></div>;
}

function statusText(view: BoardView): string {
  if (view.lastEvent?.type === 'duplicate') return 'SCHON GENANNT';
  if (view.phase === 'steal') return `KLAUEN! ${view.activeTeam === null ? '' : view.teams[view.activeTeam].name}`;
  if (view.phase === 'faceOff') return 'WER IST SCHNELLER?';
  if (view.phase === 'roundEnd') return view.winner === null ? 'RUNDE BEENDET' : `${view.teams[view.winner].name} GEWINNT`;
  return view.transcript || '';
}
