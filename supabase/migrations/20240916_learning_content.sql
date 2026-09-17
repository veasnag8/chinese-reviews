-- Learning content extensions for user-created words and sentences.
-- Run this migration in Supabase SQL Editor after 20240101_initial.sql.

ALTER TABLE public.words
  ADD COLUMN IF NOT EXISTS writing_character TEXT,
  ADD COLUMN IF NOT EXISTS audio_provider TEXT,
  ADD COLUMN IF NOT EXISTS audio_voice TEXT;

ALTER TABLE public.sentences
  ADD COLUMN IF NOT EXISTS audio_provider TEXT,
  ADD COLUMN IF NOT EXISTS audio_voice TEXT;

-- Keep the writing target explicit when a word contains more than one character.
UPDATE public.words
SET writing_character = LEFT(chinese, 1)
WHERE writing_character IS NULL
  AND chinese IS NOT NULL
  AND LENGTH(chinese) > 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'words_audio_provider_check'
      AND conrelid = 'public.words'::regclass
  ) THEN
    ALTER TABLE public.words
      ADD CONSTRAINT words_audio_provider_check
      CHECK (audio_provider IS NULL OR audio_provider IN ('upload', 'tts', 'external'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'sentences_audio_provider_check'
      AND conrelid = 'public.sentences'::regclass
  ) THEN
    ALTER TABLE public.sentences
      ADD CONSTRAINT sentences_audio_provider_check
      CHECK (audio_provider IS NULL OR audio_provider IN ('upload', 'tts', 'external'));
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS words_user_created_at_idx
  ON public.words (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS words_user_chinese_idx
  ON public.words (user_id, chinese);

CREATE INDEX IF NOT EXISTS sentences_user_created_at_idx
  ON public.sentences (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS sentences_user_chinese_idx
  ON public.sentences (user_id, chinese_sentence);

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS words_set_updated_at ON public.words;
CREATE TRIGGER words_set_updated_at
  BEFORE UPDATE ON public.words
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS sentences_set_updated_at ON public.sentences;
CREATE TRIGGER sentences_set_updated_at
  BEFORE UPDATE ON public.sentences
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Re-assert ownership policies for environments where the base migration was
-- partially applied. Existing policies are left untouched by this migration.
ALTER TABLE public.words ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sentences ENABLE ROW LEVEL SECURITY;
