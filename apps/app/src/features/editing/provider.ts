import { formatDictation } from '../dictation/format.ts';
import type { EditProvider } from './session.ts';
/** Conservative local rules. Translation is delegated to a configured model, never invented. */
export const localEditProvider: EditProvider = async (text, instruction) => {
  if (instruction.kind === 'translate') throw new Error('Translation requires a configured editing provider. Your selection is unchanged.');
  if (instruction.kind === 'shorten') return text.replace(/\b(in order to)\b/gi, 'to').replace(/\b(at this point in time)\b/gi, 'now').replace(/\b(due to the fact that)\b/gi, 'because').replace(/\b(very|really|basically|actually)\s+/gi, '').trim();
  return formatDictation(text, { style: instruction.kind === 'professional' ? 'professional' : 'polished' });
};
