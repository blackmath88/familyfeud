let context: AudioContext | null = null;
let enabled = false;

export async function unlockAudio(): Promise<void> {
  context ??= new AudioContext();
  await context.resume();
  enabled = true;
}

export function playSfx(name: 'ding' | 'strike' | 'intro' | 'win' | 'crowd' | 'tick'): void {
  if (!enabled || !context) return;
  const now = context.currentTime;
  if (name === 'crowd') return crowd(context, now);
  if (name === 'strike') return tone(context, now, 110, 0.6, 'sawtooth', 0.12, 70);
  if (name === 'tick') return tone(context, now, 720, 0.025, 'square', 0.015);
  const notes = name === 'ding' ? [660, 880] : name === 'intro' ? [392, 494, 587, 784] : [523, 659, 784, 1047];
  notes.forEach((frequency, index) => tone(context!, now + index * (name === 'ding' ? 0.09 : 0.12), frequency, 0.14, 'sine', 0.07));
}

function tone(audio: AudioContext, start: number, frequency: number, duration: number, type: OscillatorType, volume: number, endFrequency?: number) {
  const oscillator = audio.createOscillator();
  const gain = audio.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, start);
  if (endFrequency) oscillator.frequency.exponentialRampToValueAtTime(endFrequency, start + duration);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  oscillator.connect(gain).connect(audio.destination);
  oscillator.start(start);
  oscillator.stop(start + duration);
}

function crowd(audio: AudioContext, start: number) {
  const buffer = audio.createBuffer(1, audio.sampleRate * 1.2, audio.sampleRate);
  const data = buffer.getChannelData(0);
  for (let index = 0; index < data.length; index += 1) data[index] = Math.random() * 2 - 1;
  const source = audio.createBufferSource();
  const filter = audio.createBiquadFilter();
  const gain = audio.createGain();
  source.buffer = buffer;
  filter.type = 'bandpass';
  filter.frequency.value = 900;
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(0.055, start + 0.25);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + 1.2);
  source.connect(filter).connect(gain).connect(audio.destination);
  source.start(start);
}
