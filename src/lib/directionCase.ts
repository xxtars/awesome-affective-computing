const LOWER_WORDS = new Set([
  'a',
  'an',
  'and',
  'as',
  'at',
  'but',
  'by',
  'for',
  'from',
  'in',
  'into',
  'nor',
  'of',
  'on',
  'onto',
  'or',
  'over',
  'per',
  'the',
  'to',
  'under',
  'up',
  'via',
  'with',
]);

const UPPER_TOKENS = new Set([
  'ai',
  'bci',
  'eeg',
  'ecg',
  'emg',
  'erp',
  'fnirs',
  'fmri',
  'hci',
  'llm',
  'llms',
  'ml',
  'mllm',
  'mllms',
  'nlp',
  'rppg',
]);

function formatToken(token: string, isBoundaryWord: boolean) {
  const parts = token.split('-');
  const normalizedParts = parts.map((part, idx) => {
    const raw = String(part || '');
    const lower = raw.toLowerCase();
    if (!raw) return raw;
    if (UPPER_TOKENS.has(lower)) return lower.toUpperCase();
    if (!isBoundaryWord && idx === 0 && LOWER_WORDS.has(lower)) return lower;
    return lower.charAt(0).toUpperCase() + lower.slice(1);
  });
  return normalizedParts.join('-');
}

export function formatDirectionText(text: string) {
  const words = String(text || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return '';

  return words
    .map((word, index) => formatToken(word, index === 0 || index === words.length - 1))
    .join(' ');
}

export function formatDirectionList(items: string[] | undefined) {
  const normalized = (items || []).map((item) => String(item || '').trim()).filter(Boolean);
  if (normalized.length === 0) return '-';
  return normalized.map((item) => formatDirectionText(item)).join(', ');
}
