-- Separate learning content into single sentences and conversations.
ALTER TABLE public.sentences
  ADD COLUMN IF NOT EXISTS sentence_type TEXT NOT NULL DEFAULT 'single';

ALTER TABLE public.sentences
  DROP CONSTRAINT IF EXISTS sentences_sentence_type_check;

ALTER TABLE public.sentences
  ADD CONSTRAINT sentences_sentence_type_check
  CHECK (sentence_type IN ('single', 'conversation'));

CREATE INDEX IF NOT EXISTS idx_sentences_sentence_type
  ON public.sentences (sentence_type);

NOTIFY pgrst, 'reload schema';
