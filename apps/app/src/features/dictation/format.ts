export type WritingStyle = 'verbatim' | 'polished' | 'professional' | 'casual';
export interface DictationOptions {
  style: WritingStyle;
  removeFillers?: boolean;
  replacements?: readonly { from: string; to: string }[];
}
const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** Ordered, literal, whole-word vocabulary rules. No executable regular expressions. */
export function formatDictation(input: string, options: DictationOptions): string {
  let text = input;
  for (const rule of options.replacements ?? []) {
    if (!rule.from.trim()) continue;
    text = text.replace(new RegExp(`(?<![\\p{L}\\p{N}_])${escape(rule.from)}(?![\\p{L}\\p{N}_])`, 'giu'), () => rule.to);
  }
  if (options.style === 'verbatim') return text;
  text = text.replace(/\bnew paragraph\b/gi, '\n\n').replace(/\bnew line\b/gi, '\n');
  text = text.replace(/\b(comma|full stop|period|question mark|exclamation mark|colon|semicolon)\b/gi,
    word => ({ comma: ',', 'full stop': '.', period: '.', 'question mark': '?', 'exclamation mark': '!', colon: ':', semicolon: ';' })[word.toLowerCase()]!);
  if (options.removeFillers) text = text.replace(/\b(um+|uh+|erm|you know)\b[, ]*/gi, '');
  text = text.replace(/[\t ]+/g, ' ').replace(/ *\n */g, '\n').replace(/ +([,.;:!?])/g, '$1').trim();
  if (options.style === 'professional') {
    text = text.replace(/\bcan't\b/gi, 'cannot').replace(/\bwon't\b/gi, 'will not').replace(/\bwanna\b/gi, 'want to').replace(/\bgonna\b/gi, 'going to');
  }
  if (options.style === 'casual') text = text.replace(/\bcannot\b/gi, "can't");
  text = text.replace(/\bi\b/g, 'I').replace(/(^|[.!?]\s+|\n+)(\p{L})/gu, (_, prefix, letter) => prefix + letter.toLocaleUpperCase());
  return text && !/[.!?:;]$/.test(text) ? text + '.' : text;
}
