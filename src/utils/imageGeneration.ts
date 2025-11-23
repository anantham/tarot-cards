import type { Settings, TarotCard, CardInterpretation } from '../types';

export interface ImageGenerationResult {
  imageUrl: string;
  error?: string;
}

/**
 * Generate a single image using OpenRouter API
 */
export async function generateImage(
  prompt: string,
  userPhoto: string,
  settings: Settings
): Promise<ImageGenerationResult> {
  try {
    if (!settings.apiKey) {
      throw new Error('API key is required. Please add your OpenRouter API key in settings.');
    }

    const fullPrompt = `${prompt}${settings.promptSuffix}. Reference photo for face composition: [User will provide photo]`;

    const response = await fetch(settings.apiEndpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${settings.apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': window.location.origin,
      },
      body: JSON.stringify({
        model: settings.generationModel,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: fullPrompt,
              },
              {
                type: 'image_url',
                image_url: {
                  url: userPhoto,
                },
              },
            ],
          },
        ],
        // For image generation models, we might need different parameters
        // This is a placeholder - actual API might differ
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || `API request failed: ${response.status}`);
    }

    const data = await response.json();

    // Extract image URL from response
    // Note: This might need adjustment based on actual OpenRouter image generation response format
    const imageUrl = data.choices?.[0]?.message?.content || '';

    if (!imageUrl) {
      throw new Error('No image URL in response');
    }

    return { imageUrl };
  } catch (error) {
    console.error('Image generation error:', error);
    return {
      imageUrl: '',
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

/**
 * Generate multiple frames for animation
 */
export async function generateCardFrames(
  card: TarotCard,
  deckType: string,
  frameCount: number,
  settings: Settings,
  onProgress?: (current: number, total: number) => void
): Promise<string[]> {
  const interpretation = getInterpretationForDeck(card, deckType);
  const basePrompt = interpretation.prompt;

  const frames: string[] = [];

  for (let i = 0; i < frameCount; i++) {
    onProgress?.(i + 1, frameCount);

    // Add slight variations to prompt for animation effect
    const framePrompt = addFrameVariation(basePrompt, i);

    const result = await generateImage(framePrompt, settings.userPhoto, settings);

    if (result.error) {
      throw new Error(`Frame ${i + 1} generation failed: ${result.error}`);
    }

    frames.push(result.imageUrl);

    // Small delay between requests to avoid rate limiting
    if (i < frameCount - 1) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  return frames;
}

/**
 * Get the correct interpretation based on deck type
 */
function getInterpretationForDeck(
  card: TarotCard,
  deckType: string
): CardInterpretation {
  switch (deckType) {
    case 'lord-of-mysteries':
      return card.lordOfMysteries;
    case 'traditional-rider-waite':
      return card.traditional;
    case 'egyptian-tarot':
      return card.egyptian;
    case 'celtic-tarot':
      return card.celtic;
    case 'japanese-shinto':
      return card.shinto;
    default:
      return card.traditional;
  }
}

/**
 * Add slight variations to create animation effect
 */
function addFrameVariation(basePrompt: string, frameIndex: number): string {
  const variations = [
    'subtle head tilt to the left',
    'subtle head tilt to the right',
    'eyes looking slightly to the left',
    'eyes looking slightly to the right',
    'slight smile',
    'serene expression',
    'contemplative expression',
    'confident expression',
  ];

  // Cycle through variations
  const variation = variations[frameIndex % variations.length];

  return `${basePrompt}, ${variation}`;
}
