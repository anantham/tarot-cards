type BuildTarotVideoPromptArgs = {
  cardNumber: number;
  titleFallback: string;
  prompt: string;
};

export function getTarotVideoTitle(cardNumber: number, titleFallback: string): string {
  if (cardNumber === 0) return '0 – THE FOOL';
  return titleFallback;
}

export function buildTarotVideoPrompt({
  cardNumber,
  titleFallback,
  prompt,
}: BuildTarotVideoPromptArgs): { title: string; basePrompt: string } {
  const title = getTarotVideoTitle(cardNumber, titleFallback);
  const basePrompt =
    `8-second portrait (9:16) tarot card animation. Title: ${title}. ` +
    `${prompt} Render the title clearly on the card. ` +
    'Subtle motion only: gentle fabric sway, tiny head turn, light shimmer of cosmic symbols. Camera steady.';

  return { title, basePrompt };
}
