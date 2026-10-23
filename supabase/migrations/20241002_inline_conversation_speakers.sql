-- Conversation speaker names are written inline, for example: 马丁: 老师，您好
ALTER TABLE public.sentences
  DROP CONSTRAINT IF EXISTS sentences_conversation_speakers_check;

NOTIFY pgrst, 'reload schema';
