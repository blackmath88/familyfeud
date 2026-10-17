import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import type { GameConfig, Pack } from '../../game/types';
import { createGame, getPacks, getQuestions } from '../api';
import { useGame } from '../state/GameContext';

export function Setup() {
  const navigate = useNavigate();
  const { dispatch } = useGame();
  const [packs, setPacks] = useState<Pack[]>([]);
  const [teamA, setTeamA] = useState('Familie Orange');
  const [teamB, setTeamB] = useState('Familie Blau');
  const [playersA, setPlayersA] = useState('Anna, Alex');
  const [playersB, setPlayersB] = useState('Beat, Bea');
  const [rounds, setRounds] = useState(3);
  const [multipliers, setMultipliers] = useState('1,1,3');
  const [allowRepeats, setAllowRepeats] = useState(false);
  const [hostSeesAnswers, setHostSeesAnswers] = useState(false);
  const [selectedPacks, setSelectedPacks] = useState<string[]>(['beispiel']);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getPacks().then((result) => {
      setPacks(result);
      if (result.length && !result.some((pack) => pack.id === 'beispiel')) setSelectedPacks([result[0].id]);
    }).catch(() => setError('Lokale Datenbank noch nicht bereit. Bitte Migration und Seed ausführen.'));
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError('');
    const listA = splitPlayers(playersA);
    const listB = splitPlayers(playersB);
    const multiplierList = multipliers.split(',').map(Number).filter((value) => Number.isFinite(value) && value > 0);
    if (!teamA.trim() || !teamB.trim() || !listA.length || !listB.length || !selectedPacks.length) {
      setError('Bitte zwei Teams, Spielerinnen und Spieler sowie ein Paket angeben.');
      return;
    }
    setBusy(true);
    try {
      const config: GameConfig = {
        title: 'FAMILIEN-QUIZ', teams: [{ name: teamA.trim(), players: listA }, { name: teamB.trim(), players: listB }],
        rounds, multipliers: multiplierList.length ? multiplierList : [1, 1, 3], packIds: selectedPacks,
        allowRepeats, hostSeesAnswers, voice: { enabled: false, lang: 'de-DE', wakeWord: 'antwort' },
        llm: { enabled: false, autoAcceptAt: null },
      };
      const questions = await getQuestions(selectedPacks, rounds, !allowRepeats);
      if (questions.length < rounds) throw new Error(`Nur ${questions.length} passende Fragen verfügbar.`);
      const game = await createGame(config, questions.map((question) => question.id));
      dispatch({ type: 'START_GAME', gameId: game.id, config, queue: questions });
      navigate('/host');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Spiel konnte nicht gestartet werden.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="app-shell setup-page">
      <header className="app-header"><div><span className="eyebrow">WOHNZIMMER · QUIZ</span><h1>Familien-Quiz</h1></div><a href="/board?demo=1">Board-Demo</a></header>
      <form className="setup-card" onSubmit={submit}>
        <section><h2>Wer spielt?</h2><div className="form-grid">
          <label>Team Orange<input value={teamA} onChange={(event) => setTeamA(event.target.value)} /></label>
          <label>Team Blau<input value={teamB} onChange={(event) => setTeamB(event.target.value)} /></label>
          <label>Spieler (Komma getrennt)<input value={playersA} onChange={(event) => setPlayersA(event.target.value)} /></label>
          <label>Spieler (Komma getrennt)<input value={playersB} onChange={(event) => setPlayersB(event.target.value)} /></label>
        </div></section>
        <section><h2>Spiel</h2><div className="form-grid">
          <label>Runden<input type="number" min="3" max="10" value={rounds} onChange={(event) => setRounds(Number(event.target.value))} /></label>
          <label>Multiplikatoren<input value={multipliers} onChange={(event) => setMultipliers(event.target.value)} /></label>
        </div>
          <fieldset><legend>Fragepakete</legend>{packs.map((pack) => <label className="check" key={pack.id}><input type="checkbox" checked={selectedPacks.includes(pack.id)} onChange={() => setSelectedPacks((current) => current.includes(pack.id) ? current.filter((id) => id !== pack.id) : [...current, pack.id])} />{pack.name} <small>{pack.questionCount ?? 0} Fragen</small></label>)}</fieldset>
          <p className="notice">Die Punkte im Beispielpaket sind Schätzwerte und stammen nicht aus einer echten Umfrage.</p>
          <label className="check"><input type="checkbox" checked={allowRepeats} onChange={(event) => setAllowRepeats(event.target.checked)} />Wiederholungen erlauben</label>
          <label className="check"><input type="checkbox" checked={hostSeesAnswers} onChange={(event) => setHostSeesAnswers(event.target.checked)} />Spielleiter-Modus: Antworten vorab zeigen</label>
        </section>
        {error && <p className="error" role="alert">{error}</p>}
        <button className="primary" disabled={busy}>{busy ? 'Wird vorbereitet …' : 'Spiel starten'}</button>
      </form>
    </main>
  );
}

function splitPlayers(value: string): string[] {
  return value.split(',').map((player) => player.trim()).filter(Boolean).slice(0, 6);
}
