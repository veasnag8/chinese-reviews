export type WordAutofillResult = {
  pinyin: string;
  khmer: string;
  english: string;
  category?: string;
  partOfSpeech?: string;
  exampleSentence?: string;
  examplePinyin?: string;
  exampleKhmer?: string;
};

export type SentenceAutofillResult = {
  pinyin: string;
  khmerTranslation: string;
  englishTranslation: string;
};

export async function fetchWordAutofill(chinese: string): Promise<{ data?: WordAutofillResult; error?: string }> {
  if (!chinese.trim()) return { error: 'Please enter a Chinese character or word first.' };
  try {
    const res = await fetch('/api/ai/autofill', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'word', chinese: chinese.trim() }),
    });
    const result = await res.json();
    if (!res.ok || result.error) {
      return { error: result.error || 'Failed to auto-fill with AI.' };
    }
    return { data: result };
  } catch (err: any) {
    return { error: err?.message || 'Network error while fetching AI auto-fill.' };
  }
}

export async function fetchSentenceAutofill(chineseSentence: string): Promise<{ data?: SentenceAutofillResult; error?: string }> {
  if (!chineseSentence.trim()) return { error: 'Please enter a Chinese sentence first.' };
  try {
    const res = await fetch('/api/ai/autofill', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'sentence', chinese: chineseSentence.trim() }),
    });
    const result = await res.json();
    if (!res.ok || result.error) {
      return { error: result.error || 'Failed to auto-fill with AI.' };
    }
    return { data: result };
  } catch (err: any) {
    return { error: err?.message || 'Network error while fetching AI auto-fill.' };
  }
}

