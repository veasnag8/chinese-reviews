'use client';

import { useCallback, useEffect, useState } from 'react';
import { BookOpenText, Languages, Loader2, MessageCircle, Volume2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { speakChinese } from '@/lib/speech';

type Conversation = {
  id: string;
  chinese_sentence: string;
  pinyin: string | null;
  khmer_translation: string | null;
  english_translation: string | null;
  created_at: string;
  classes: { name?: string | null; date?: string | null } | null;
};

type TranslationLanguage = 'khmer' | 'english';

const lines = (value?: string | null) => (value || '').split(/\r?\n/).map((line) => line.trim()).filter(Boolean);

const splitSpeaker = (value: string) => {
  const match = value.match(/^([^:：]+)[:：]\s*(.*)$/);
  return match ? { speaker: match[1].trim(), text: match[2].trim() } : { speaker: '', text: value.trim() };
};

const translationAt = (value: string | null, index: number) => {
  const row = lines(value)[index] || '';
  return splitSpeaker(row).text;
};

export default function ConversationsPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [visibleTranslations, setVisibleTranslations] = useState<Record<string, TranslationLanguage | undefined>>({});

  const load = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    setError('');
    const { data, error: queryError } = await (supabase.from('sentences') as any)
      .select('id, chinese_sentence, pinyin, khmer_translation, english_translation, created_at, classes(name, date)')
      .eq('sentence_type', 'conversation')
      .order('created_at', { ascending: false });
    if (queryError) setError(queryError.message);
    else setConversations((data || []) as Conversation[]);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const toggleTranslation = (key: string, language: TranslationLanguage) => {
    setVisibleTranslations((current) => ({ ...current, [key]: current[key] === language ? undefined : language }));
  };

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#b91c1c]">Learn by dialogue</p>
        <h1 className="mt-1 text-3xl font-bold">Conversations</h1>
        <p className="mt-2 text-slate-500">Listen and reveal the translation for only the line you are studying.</p>
      </header>

      {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {loading ? <div className="flex items-center gap-2 text-slate-500"><Loader2 className="animate-spin" size={18} /> Loading conversations…</div> : conversations.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-stone-300 bg-white p-12 text-center"><MessageCircle className="mx-auto text-stone-300" size={42} /><h2 className="mt-3 text-lg font-bold">No conversations yet</h2><p className="mt-1 text-sm text-slate-500">New conversations from your teacher will appear here.</p></div>
      ) : (
        <div className="space-y-5">
          {conversations.map((conversation) => {
            const chineseLines = lines(conversation.chinese_sentence);
            const pinyinLines = lines(conversation.pinyin);
            return (
              <article key={conversation.id} className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
                <div className="flex items-center justify-between gap-3 border-b border-stone-100 bg-stone-50 px-4 py-3 sm:px-6"><span className="inline-flex items-center gap-2 font-semibold text-slate-800"><BookOpenText size={18} className="text-[#b91c1c]" />{conversation.classes?.name || 'Conversation'}</span>{conversation.classes?.date && <span className="text-xs text-slate-500">{conversation.classes.date}</span>}</div>
                <div className="divide-y divide-stone-100">
                  {chineseLines.map((line, index) => {
                    const { speaker, text } = splitSpeaker(line);
                    const pinyin = splitSpeaker(pinyinLines[index] || '').text;
                    const rowKey = `${conversation.id}-${index}`;
                    const language = visibleTranslations[rowKey];
                    const translation = language === 'khmer' ? translationAt(conversation.khmer_translation, index) : language === 'english' ? translationAt(conversation.english_translation, index) : '';
                    return (
                      <div key={rowKey} className="grid gap-3 p-4 sm:grid-cols-[auto_1fr] sm:p-6">
                        <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-red-50 px-2 text-center text-xs font-bold text-[#b91c1c]">{speaker || index + 1}</div>
                        <div className="min-w-0">
                          {pinyin && <p className="text-sm leading-relaxed text-orange-500">{pinyin}</p>}
                          <div className="mt-0.5 flex items-start justify-between gap-3"><p className="text-xl font-semibold leading-relaxed text-slate-950 sm:text-2xl">{text}</p><button type="button" onClick={() => speakChinese(text)} aria-label={`Read ${text}`} className="shrink-0 rounded-full p-2 text-slate-500 hover:bg-red-50 hover:text-[#b91c1c]"><Volume2 size={19} /></button></div>
                          <div className="mt-3 flex gap-2">
                            <button type="button" onClick={() => toggleTranslation(rowKey, 'khmer')} className={`inline-flex min-h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold ${language === 'khmer' ? 'bg-[#b91c1c] text-white' : 'border border-stone-200 text-slate-600 hover:bg-stone-50'}`}><Languages size={14} /> Khmer</button>
                            <button type="button" onClick={() => toggleTranslation(rowKey, 'english')} className={`inline-flex min-h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold ${language === 'english' ? 'bg-[#b91c1c] text-white' : 'border border-stone-200 text-slate-600 hover:bg-stone-50'}`}><Languages size={14} /> English</button>
                          </div>
                          {language && <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2.5 text-sm leading-relaxed text-slate-700">{translation || 'No translation for this line yet.'}</p>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
