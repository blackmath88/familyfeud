import type { JudgeRequest, JudgeResponse } from '../game/types';

interface JudgeEnv {
  MISTRAL_API_KEY?: string;
  MOCK_JUDGE?: string;
}

export async function judgeGuess(request: JudgeRequest, env: JudgeEnv): Promise<JudgeResponse> {
  if (env.MOCK_JUDGE === '1') {
    const guess = request.guess.toLocaleLowerCase('de-CH');
    const answer = request.answers.find((candidate) =>
      [candidate.label, ...candidate.aliases].some((text) => guess.includes(text.toLocaleLowerCase('de-CH')))
      || (guess.includes('nachthemd') && candidate.label.toLocaleLowerCase('de-CH').includes('schlafanzug')),
    );
    return answer
      ? { rank: answer.rank, confidence: 0.95, reason: 'mock_semantic_match' }
      : { rank: null, confidence: 0, reason: 'mock_no_match' };
  }
  if (!env.MISTRAL_API_KEY) return unavailable();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4_000);
  try {
    const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
      method: 'POST',
      headers: { authorization: `Bearer ${env.MISTRAL_API_KEY}`, 'content-type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        model: 'mistral-small-latest', temperature: 0, response_format: { type: 'json_object' },
        messages: [{ role: 'user', content: `Prüfe, ob die Vermutung alltagssprachlich dieselbe Bedeutung wie eine Antwort hat.\nFrage: ${request.question}\nAntworten: ${request.answers.map((answer) => `${answer.rank}. ${answer.label} (${answer.aliases.join(', ')})`).join('\n')}\nVermutung: ${request.guess}\nAntworte nur als JSON: {"rank": Zahl oder null, "confidence": 0 bis 1, "reason": "kurz"}` }],
      }),
    });
    if (!response.ok) return unavailable();
    const payload = await response.json() as { choices?: { message?: { content?: string } }[] };
    const parsed = JSON.parse(payload.choices?.[0]?.message?.content ?? '{}') as Partial<JudgeResponse>;
    if ((parsed.rank !== null && (!Number.isInteger(parsed.rank) || !request.answers.some((answer) => answer.rank === parsed.rank)))
      || typeof parsed.confidence !== 'number' || typeof parsed.reason !== 'string') return unavailable();
    return { rank: parsed.rank ?? null, confidence: Math.max(0, Math.min(1, parsed.confidence)), reason: parsed.reason };
  } catch {
    return unavailable();
  } finally {
    clearTimeout(timeout);
  }
}

function unavailable(): JudgeResponse {
  return { rank: null, confidence: 0, reason: 'judge_unavailable' };
}
