-- Store the names of both participants for conversation content.
ALTER TABLE public.sentences
  ADD COLUMN IF NOT EXISTS speaker_one_name TEXT,
  ADD COLUMN IF NOT EXISTS speaker_two_name TEXT;

-- Keep any conversations created before this migration valid and editable.
UPDATE public.sentences
SET
  speaker_one_name = COALESCE(NULLIF(BTRIM(speaker_one_name), ''), 'Speaker A'),
  speaker_two_name = COALESCE(NULLIF(BTRIM(speaker_two_name), ''), 'Speaker B')
WHERE sentence_type = 'conversation';

ALTER TABLE public.sentences
  DROP CONSTRAINT IF EXISTS sentences_conversation_speakers_check;

ALTER TABLE public.sentences
  ADD CONSTRAINT sentences_conversation_speakers_check
  CHECK (
    sentence_type = 'single'
    OR (
      NULLIF(BTRIM(speaker_one_name), '') IS NOT NULL
      AND NULLIF(BTRIM(speaker_two_name), '') IS NOT NULL
    )
  );

NOTIFY pgrst, 'reload schema';
