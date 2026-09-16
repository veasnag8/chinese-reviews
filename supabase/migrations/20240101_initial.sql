-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Profiles table - user extension
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  email TEXT NOT NULL,
  full_name TEXT,
  native_language TEXT DEFAULT 'Chinese',
  target_language TEXT DEFAULT 'Chinese',
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Policies for profiles
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can create own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Create each user's profile when they register through Supabase Auth.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    NEW.raw_user_meta_data ->> 'full_name'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Classes table
CREATE TABLE IF NOT EXISTS public.classes (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  teacher TEXT,
  lesson_number INTEGER,
  date TEXT NOT NULL,
  user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;

-- Policies for classes
CREATE POLICY "Users can view own classes" ON public.classes
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create classes" ON public.classes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own class" ON public.classes
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own class" ON public.classes
  FOR DELETE USING (auth.uid() = user_id);

-- Words table
CREATE TABLE IF NOT EXISTS public.words (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  chinese TEXT NOT NULL,
  pinyin TEXT,
  khmer TEXT,
  english TEXT,
  part_of_speech TEXT,
  example_sentence TEXT,
  example_pinyin TEXT,
  example_khmer TEXT,
  hsk_level INTEGER,
  category TEXT,
  image_url TEXT,
  audio_url TEXT,
  class_id UUID REFERENCES public.classes ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.words ENABLE ROW LEVEL SECURITY;

-- Policies for words
CREATE POLICY "Users can view own words" ON public.words
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create words" ON public.words
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own word" ON public.words
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own word" ON public.words
  FOR DELETE USING (auth.uid() = user_id);

-- Sentences table
CREATE TABLE IF NOT EXISTS public.sentences (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  chinese_sentence TEXT NOT NULL,
  pinyin TEXT,
  khmer_translation TEXT,
  english_translation TEXT,
  audio_url TEXT,
  class_id UUID REFERENCES public.classes ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.sentences ENABLE ROW LEVEL SECURITY;

-- Policies for sentences
CREATE POLICY "Users can view own sentences" ON public.sentences
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create sentences" ON public.sentences
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own sentence" ON public.sentences
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own sentence" ON public.sentences
  FOR DELETE USING (auth.uid() = user_id);

-- Categories table
CREATE TABLE IF NOT EXISTS public.categories (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

-- Policies for categories
CREATE POLICY "Users can view own categories" ON public.categories
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create categories" ON public.categories
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own category" ON public.categories
  FOR UPDATE USING (auth.uid() = user_id);

-- HSK levels table
CREATE TABLE IF NOT EXISTS public.hsk_levels (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  level INTEGER NOT NULL,
  name TEXT NOT NULL,
  user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.hsk_levels ENABLE ROW LEVEL SECURITY;

-- Policies for hsk_levels
CREATE POLICY "Users can view own hsk levels" ON public.hsk_levels
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create hsk levels" ON public.hsk_levels
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own hsk level" ON public.hsk_levels
  FOR UPDATE USING (auth.uid() = user_id);

-- Review items table (spaced repetition)
CREATE TABLE IF NOT EXISTS public.review_items (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  word_id UUID REFERENCES public.words ON DELETE CASCADE,
  sentence_id UUID REFERENCES public.sentences ON DELETE CASCADE,
  item_type TEXT CHECK (item_type IN ('word', 'sentence')) NOT NULL,
  chinese TEXT NOT NULL,
  pinyin TEXT,
  khmer TEXT,
  english TEXT,
  due_date TEXT NOT NULL,
  last_reviewed TIMESTAMPTZ,
  next_review TIMESTAMPTZ NOT NULL,
  review_count INTEGER DEFAULT 0,
  correct_count INTEGER DEFAULT 0,
  wrong_count INTEGER DEFAULT 0,
  difficulty TEXT DEFAULT 'good' CHECK (difficulty IN ('easy', 'good', 'hard')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.review_items ENABLE ROW LEVEL SECURITY;

-- Policies for review_items
CREATE POLICY "Users can view own review items" ON public.review_items
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create review items" ON public.review_items
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own review item" ON public.review_items
  FOR UPDATE USING (auth.uid() = user_id);

-- Review history table
CREATE TABLE IF NOT EXISTS public.review_history (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  item_id UUID NOT NULL,
  item_type TEXT CHECK (item_type IN ('word', 'sentence')) NOT NULL,
  correct BOOLEAN NOT NULL,
  difficulty TEXT DEFAULT 'good' CHECK (difficulty IN ('easy', 'good', 'hard')),
  completed_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.review_history ENABLE ROW LEVEL SECURITY;

-- Policies for review_history
CREATE POLICY "Users can view own review history" ON public.review_history
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create review history" ON public.review_history
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Favorites table
CREATE TABLE IF NOT EXISTS public.favorites (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  word_id UUID REFERENCES public.words ON DELETE SET NULL,
  sentence_id UUID REFERENCES public.sentences ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;

-- Policies for favorites
CREATE POLICY "Users can view own favorites" ON public.favorites
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create favorites" ON public.favorites
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete favorites" ON public.favorites
  FOR DELETE USING (auth.uid() = user_id);

-- Study sessions table
CREATE TABLE IF NOT EXISTS public.study_sessions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  items_count INTEGER DEFAULT 0,
  correct_count INTEGER DEFAULT 0,
  wrong_count INTEGER DEFAULT 0,
  accuracy INTEGER DEFAULT 0
);

ALTER TABLE public.study_sessions ENABLE ROW LEVEL SECURITY;

-- Policies for study_sessions
CREATE POLICY "Users can view own study sessions" ON public.study_sessions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create study sessions" ON public.study_sessions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Quiz questions table
CREATE TABLE IF NOT EXISTS public.quiz_questions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  question_type TEXT CHECK (question_type IN ('chinese-to-meaning', 'meaning-to-chinese', 'pinyin', 'listening', 'sentence', 'translation')) NOT NULL,
  chinese TEXT NOT NULL,
  pinyin TEXT,
  khmer TEXT,
  english TEXT,
  correct_answer TEXT NOT NULL,
  options TEXT[],
  class_id UUID REFERENCES public.classes ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.quiz_questions ENABLE ROW LEVEL SECURITY;

-- Policies for quiz_questions
CREATE POLICY "Users can view own quiz questions" ON public.quiz_questions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create quiz questions" ON public.quiz_questions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Quiz attempts table
CREATE TABLE IF NOT EXISTS public.quiz_attempts (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  quiz_id UUID NOT NULL,
  question_id UUID NOT NULL,
  selected_answer TEXT,
  is_correct BOOLEAN NOT NULL,
  time_spent INTEGER DEFAULT 0,
  completed_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.quiz_attempts ENABLE ROW LEVEL SECURITY;

-- Policies for quiz_attempts
CREATE POLICY "Users can view own quiz attempts" ON public.quiz_attempts
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create quiz attempts" ON public.quiz_attempts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_words_user_id ON public.words(user_id);
CREATE INDEX IF NOT EXISTS idx_words_class_id ON public.words(class_id);
CREATE INDEX IF NOT EXISTS idx_sentences_user_id ON public.sentences(user_id);
CREATE INDEX IF NOT EXISTS idx_sentences_class_id ON public.sentences(class_id);
CREATE INDEX IF NOT EXISTS idx_review_items_user_id ON public.review_items(user_id);
CREATE INDEX IF NOT EXISTS idx_review_items_next_review ON public.review_items(next_review);
CREATE INDEX IF NOT EXISTS idx_review_history_user_id ON public.review_history(user_id);
CREATE INDEX IF NOT EXISTS idx_favorites_user_id ON public.favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_classes_user_id ON public.classes(user_id);

-- Grant permissions
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
