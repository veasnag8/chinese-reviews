'use client';

import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, BookOpenText, CalendarDays, Languages, Loader2, MessageCircle, Volume2 } from 'lucide-react';
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
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
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

  const dateGroups = conversations.reduce<Record<string, Conversation[]>>((groups, conversation) => {
    const date = conversation.classes?.date || new Date(conversation.created_at).toISOString().slice(0, 10);
    (groups[date] ||= []).push(conversation);
    return groups;
  }, {});
  const availableDates = Object.keys(dateGroups).sort((a, b) => b.localeCompare(a));
  const visibleConversations = selectedDate ? dateGroups[selectedDate] || [] : [];
  const displayDate = (date: string) => new Intl.DateTimeFormat(undefined, {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC',
  }).format(new Date(`${date}T00:00:00Z`));

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
      ) : !selectedDate ? (
        <section>
          <div className="mb-4"><h2 className="text-xl font-bold">Choose a learning date</h2><p className="mt-1 text-sm text-slate-500">Only dates that have conversations are shown.</p></div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {availableDates.map((date) => {
              const items = dateGroups[date];
              const classNames = [...new Set(items.map((item) => item.classes?.name).filter(Boolean))];
              return <button key={date} type="button" onClick={() => setSelectedDate(date)} className="group rounded-2xl border border-stone-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-red-200 hover:shadow-md">
                <span className="flex size-11 items-center justify-center rounded-xl bg-red-50 text-[#b91c1c]"><CalendarDays size={21} /></span>
                <span className="mt-4 block text-lg font-bold text-slate-900">{displayDate(date)}</span>
                <span className="mt-1 block text-sm text-slate-500">{items.length} {items.length === 1 ? 'conversation' : 'conversations'}</span>
                {classNames.length > 0 && <span className="mt-3 line-clamp-2 block text-xs font-medium text-slate-600">{classNames.join(' · ')}</span>}
                <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-[#b91c1c]">Start learning <span aria-hidden>→</span></span>
              </button>;
            })}
          </div>
        </section>
      ) : (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <button type="button" onClick={() => setSelectedDate(null)} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-stone-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-stone-50"><ArrowLeft size={17} /> Choose another date</button>
            <div className="text-right"><p className="font-bold text-slate-900">{displayDate(selectedDate)}</p><p className="text-xs text-slate-500">{visibleConversations.length} {visibleConversations.length === 1 ? 'conversation' : 'conversations'}</p></div>
          </div>
          {visibleConversations.map((conversation) => {
            const chineseLines = lines(conversation.chinese_sentence);
            const pinyinLines = lines(conversation.pinyin);
            const speakerNames = [...new Set(chineseLines.map((line) => splitSpeaker(line).speaker).filter(Boolean))];
            return (
              <article key={conversation.id} className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
                <div className="flex items-center justify-between gap-3 border-b border-stone-100 bg-stone-50 px-4 py-3 sm:px-6"><span className="inline-flex items-center gap-2 font-semibold text-slate-800"><BookOpenText size={18} className="text-[#b91c1c]" />{conversation.classes?.name || 'Conversation'}</span>{conversation.classes?.date && <span className="text-xs text-slate-500">{conversation.classes.date}</span>}</div>
                <div className="space-y-5 bg-gradient-to-b from-stone-50/70 to-white p-4 sm:p-6">
                  {chineseLines.map((line, index) => {
                    const { speaker, text } = splitSpeaker(line);
                    const speakerIndex = speaker ? Math.max(0, speakerNames.indexOf(speaker)) : index % 2;
                    const isRight = speakerIndex % 2 === 1;
                    const pinyin = splitSpeaker(pinyinLines[index] || '').text;
                    const rowKey = `${conversation.id}-${index}`;
                    const language = visibleTranslations[rowKey];
                    const translation = language === 'khmer' ? translationAt(conversation.khmer_translation, index) : language === 'english' ? translationAt(conversation.english_translation, index) : '';
                    return (
                      <div key={rowKey} className={`flex items-end gap-2.5 ${isRight ? 'flex-row-reverse' : ''}`}>
                        <div className={`flex size-11 shrink-0 items-center justify-center rounded-full px-2 text-center text-xs font-bold shadow-sm ${isRight ? 'bg-blue-600 text-white' : 'bg-[#b91c1c] text-white'}`}>{speaker || index + 1}</div>
                        <div className={`min-w-0 max-w-[85%] sm:max-w-[72%] ${isRight ? 'items-end' : 'items-start'}`}>
                          <p className={`mb-1 px-1 text-xs font-bold ${isRight ? 'text-right text-blue-700' : 'text-[#b91c1c]'}`}>{speaker || `Speaker ${speakerIndex + 1}`}</p>
                          <div className={`relative rounded-2xl px-4 py-3 shadow-sm ${isRight ? 'rounded-br-md bg-blue-600 text-white' : 'rounded-bl-md border border-red-100 bg-white text-slate-950'}`}>
                            {pinyin && <p className={`text-sm leading-relaxed ${isRight ? 'text-blue-100' : 'text-orange-500'}`}>{pinyin}</p>}
                            <div className="mt-0.5 flex items-start justify-between gap-3"><p className="text-lg font-semibold leading-relaxed sm:text-xl">{text}</p><button type="button" onClick={() => speakChinese(text)} aria-label={`Read ${text}`} className={`shrink-0 rounded-full p-2 ${isRight ? 'text-blue-100 hover:bg-blue-500 hover:text-white' : 'text-slate-500 hover:bg-red-50 hover:text-[#b91c1c]'}`}><Volume2 size={18} /></button></div>
                          </div>
                          <div className={`mt-2 flex gap-2 ${isRight ? 'justify-end' : ''}`}>
                            <button type="button" onClick={() => toggleTranslation(rowKey, 'khmer')} className={`inline-flex min-h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold ${language === 'khmer' ? isRight ? 'bg-blue-600 text-white' : 'bg-[#b91c1c] text-white' : 'border border-stone-200 bg-white text-slate-600 hover:bg-stone-50'}`}><Languages size={14} /> Khmer</button>
                            <button type="button" onClick={() => toggleTranslation(rowKey, 'english')} className={`inline-flex min-h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold ${language === 'english' ? isRight ? 'bg-blue-600 text-white' : 'bg-[#b91c1c] text-white' : 'border border-stone-200 bg-white text-slate-600 hover:bg-stone-50'}`}><Languages size={14} /> English</button>
                          </div>
                          {language && <p className={`mt-2 rounded-xl px-3 py-2.5 text-sm leading-relaxed ${isRight ? 'bg-blue-50 text-blue-900' : 'bg-amber-50 text-slate-700'}`}>{translation || 'No translation for this line yet.'}</p>}
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
