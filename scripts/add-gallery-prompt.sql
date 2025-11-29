-- Adds prompt and deck_prompt_suffix to gallery if not present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'gallery' AND column_name = 'prompt'
  ) THEN
    ALTER TABLE public.gallery ADD COLUMN prompt text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'gallery' AND column_name = 'deck_prompt_suffix'
  ) THEN
    ALTER TABLE public.gallery ADD COLUMN deck_prompt_suffix text;
  END IF;
END $$;
