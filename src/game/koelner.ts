import { foldUmlauts } from './normalize';

/** Kölner Phonetik per Postel, applied to letters only. */
export function koelnerPhonetik(input: string): string {
  const letters = foldUmlauts(input.toLocaleLowerCase('de-CH'))
    .replace(/ß/g, 's').replace(/[^a-z]/g, '').toUpperCase();
  const codes: string[] = [];
  for (let index = 0; index < letters.length; index += 1) {
    const char = letters[index];
    const previous = letters[index - 1] ?? '';
    const next = letters[index + 1] ?? '';
    let code = '';
    if ('AEIJOUY'.includes(char)) code = '0';
    else if (char === 'H') code = '';
    else if (char === 'B' || (char === 'P' && next !== 'H')) code = '1';
    else if ('DT'.includes(char) && !(next && 'CSZ'.includes(next))) code = '2';
    else if ('FVW'.includes(char) || (char === 'P' && next === 'H')) code = '3';
    else if ('GKQ'.includes(char)) code = '4';
    else if (char === 'C') {
      if (index === 0) code = 'AHKLOQRUX'.includes(next) ? '4' : '8';
      else code = 'SZ'.includes(previous) || !(next && 'AHKOQUX'.includes(next)) ? '8' : '4';
    } else if (char === 'X') code = previous && 'CKQ'.includes(previous) ? '8' : '48';
    else if (char === 'L') code = '5';
    else if ('MN'.includes(char)) code = '6';
    else if (char === 'R') code = '7';
    else if ('SZ'.includes(char) || ('DT'.includes(char) && Boolean(next) && 'CSZ'.includes(next))) code = '8';
    for (const digit of code) {
      if (digit !== codes.at(-1)) codes.push(digit);
    }
  }
  return codes.filter((digit, index) => digit !== '0' || index === 0).join('');
}
