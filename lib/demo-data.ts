export type StudyWord = { id: string; chinese: string; pinyin: string; khmer: string; english: string; className: string; hsk: string; favorite?: boolean; due?: boolean; mistakes?: number };
export type StudySentence = { id: string; chinese: string; pinyin: string; khmer: string; english: string; className: string; favorite?: boolean; due?: boolean };
export type StudyClass = { id: string; name: string; date: string; teacher: string; words: number; sentences: number };

export const initialWords: StudyWord[] = [
  { id: 'w1', chinese: '学习', pinyin: 'xuéxí', khmer: 'រៀន', english: 'Study / Learn', className: 'Class 05', hsk: 'HSK 1', favorite: true, due: true },
  { id: 'w2', chinese: '老师', pinyin: 'lǎoshī', khmer: 'គ្រូ', english: 'Teacher', className: 'Class 05', hsk: 'HSK 1', due: true },
  { id: 'w3', chinese: '学生', pinyin: 'xuéshēng', khmer: 'សិស្ស', english: 'Student', className: 'Class 04', hsk: 'HSK 1', due: true, mistakes: 2 },
  { id: 'w4', chinese: '学校', pinyin: 'xuéxiào', khmer: 'សាលារៀន', english: 'School', className: 'Class 04', hsk: 'HSK 1', favorite: true },
  { id: 'w5', chinese: '中文', pinyin: 'Zhōngwén', khmer: 'ភាសាចិន', english: 'Chinese language', className: 'Class 03', hsk: 'HSK 1', due: true },
];

export const initialSentences: StudySentence[] = [
  { id: 's1', chinese: '我每天学习中文。', pinyin: 'Wǒ měitiān xuéxí Zhōngwén.', khmer: 'ខ្ញុំរៀនភាសាចិនរាល់ថ្ងៃ។', english: 'I study Chinese every day.', className: 'Class 05', due: true },
  { id: 's2', chinese: '我是学生。', pinyin: 'Wǒ shì xuéshēng.', khmer: 'ខ្ញុំជាសិស្ស។', english: 'I am a student.', className: 'Class 04', favorite: true },
];

export const initialClasses: StudyClass[] = [
  { id: 'c5', name: 'Class 05', date: '2026-09-15', teacher: 'Ms. Lin', words: 25, sentences: 8 },
  { id: 'c4', name: 'Class 04', date: '2026-09-13', teacher: 'Ms. Lin', words: 30, sentences: 10 },
  { id: 'c3', name: 'Class 03', date: '2026-09-10', teacher: 'Ms. Lin', words: 28, sentences: 6 },
];
