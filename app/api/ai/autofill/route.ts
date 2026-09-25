import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

const apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY || '';

export async function POST(request: NextRequest) {
  try {
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Gemini API key is not configured in server environment.' },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { type, chinese } = body;

    if (!chinese || typeof chinese !== 'string' || !chinese.trim()) {
      return NextResponse.json({ error: 'Chinese input is required.' }, { status: 400 });
    }

    const ai = new GoogleGenAI({ apiKey });

    if (type === 'sentence') {
      const prompt = `You are an expert Chinese-Khmer-English translator and linguist.
Given the Chinese sentence: "${chinese.trim()}"
Provide accurate and natural translations in JSON format with exactly these fields:
- "pinyin": standard Hanyu Pinyin with tone marks (e.g. "Nǐ hǎo! Wǒ jiào Dàwèi.")
- "khmerTranslation": natural, standard Cambodian Khmer translation
- "englishTranslation": accurate English translation

Output ONLY valid raw JSON with no markdown wrapping.`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
        },
      });

      const text = response.text || '';
      try {
        const cleanJson = text.replace(/^```json\s*/i, '').replace(/\s*```$/, '').trim();
        const data = JSON.parse(cleanJson);
        return NextResponse.json({
          pinyin: data.pinyin || '',
          khmerTranslation: data.khmerTranslation || data.khmer || '',
          englishTranslation: data.englishTranslation || data.english || '',
        });
      } catch (err) {
        console.error('Failed to parse Gemini sentence response:', text, err);
        return NextResponse.json({ error: 'Failed to parse AI response' }, { status: 500 });
      }
    } else {
      // type === 'word'
      const prompt = `You are an expert Chinese language teacher and linguist.
Given the Chinese word/phrase: "${chinese.trim()}"
Provide accurate Pinyin with tone marks, Khmer meaning, English meaning, category, part of speech, and a simple natural example sentence with its Pinyin and Khmer translation.
Output in JSON format with exactly these fields:
- "pinyin": standard Hanyu Pinyin with tone marks
- "khmer": clear, natural Khmer translation
- "english": clear English translation
- "category": topic or category (e.g., Greetings, Food, Numbers, Family, Work, Daily Life, Travel, etc.)
- "partOfSpeech": noun, verb, adjective, adverb, pronoun, preposition, conjunction, particle, interjection, phrase, idiom, etc.
- "exampleSentence": an authentic, simple example sentence in Chinese containing the word
- "examplePinyin": Pinyin with tone marks for the example sentence
- "exampleKhmer": Khmer translation for the example sentence

Output ONLY valid raw JSON with no markdown wrapping.`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
        },
      });

      const text = response.text || '';
      try {
        const cleanJson = text.replace(/^```json\s*/i, '').replace(/\s*```$/, '').trim();
        const data = JSON.parse(cleanJson);
        return NextResponse.json({
          pinyin: data.pinyin || '',
          khmer: data.khmer || '',
          english: data.english || '',
          category: data.category || '',
          partOfSpeech: data.partOfSpeech || '',
          exampleSentence: data.exampleSentence || '',
          examplePinyin: data.examplePinyin || '',
          exampleKhmer: data.exampleKhmer || '',
        });
      } catch (err) {
        console.error('Failed to parse Gemini word response:', text, err);
        return NextResponse.json({ error: 'Failed to parse AI response' }, { status: 500 });
      }
    }
  } catch (error: any) {
    console.error('Gemini API auto-fill error:', error);
    return NextResponse.json(
      { error: error?.message || 'Error communicating with Gemini API' },
      { status: 500 }
    );
  }
}
