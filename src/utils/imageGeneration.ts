import type { Settings, TarotCard } from '../types';
import { generateImageWithGemini } from './geminiImageGeneration';
import configData from '../data/tarot-config.json';
import { toRoman } from './roman';
import { traditionalSymbols } from '../data/traditional-symbols';
import lotmLore from '../data/lotm-lore.json';
import deckLore from '../data/deck-lore.json';
import buddhistLore from '../data/buddhist-lore.json';
import { getInterpretationForDeck } from './deckInterpretation';

export interface ImageGenerationResult {
  imageUrl: string;
  error?: string;
}

/**
 * Generate a single image - routes to appropriate provider
 */
export async function generateImage(
  prompt: string,
  userPhoto: string,
  settings: Settings
): Promise<ImageGenerationResult> {
  // Route to appropriate provider
  if (settings.apiProvider === 'gemini') {
    return generateImageWithGemini(prompt, userPhoto, settings);
  }

  // OpenRouter implementation
  return generateImageWithOpenRouter(prompt, userPhoto, settings);
}

/**
 * Generate image using OpenRouter API (text-to-image only)
 */
async function generateImageWithOpenRouter(
  prompt: string,
  _userPhoto: string,
  settings: Settings
): Promise<ImageGenerationResult> {
  try {
    if (!settings.apiKey) {
      throw new Error('API key is required. Please add your OpenRouter API key in settings.');
    }

    const apiConfig = configData.configuration?.apiInstructions?.openrouter;
    const requestTemplate = apiConfig?.requestPrefix || '{prompt}';
    const requestPrompt = requestTemplate.includes('{prompt}')
      ? requestTemplate.replace('{prompt}', prompt)
      : `${requestTemplate}${prompt}`;
    const fullPrompt = settings.promptSuffix ? `${requestPrompt}${settings.promptSuffix}` : requestPrompt;

    const rawEndpoint = settings.apiEndpoint?.trim() || 'https://openrouter.ai/api/v1/chat/completions';
    const apiEndpoint = (() => {
      if (rawEndpoint.startsWith('http://') || rawEndpoint.startsWith('https://')) return rawEndpoint;
      if (rawEndpoint.startsWith('/')) return rawEndpoint; // relative path for proxy
      return `https://${rawEndpoint}`;
    })();

    const requestBody = {
      model: settings.generationModel,
      messages: [
        {
          role: 'user',
          content: fullPrompt,
        },
      ],
      modalities: ['image', 'text'],
    };

    console.log('[OpenRouter] settings.apiEndpoint:', settings.apiEndpoint);
    console.log('[OpenRouter] Using endpoint:', apiEndpoint);
    console.log('[OpenRouter] Model:', settings.generationModel);
    console.log('[OpenRouter] Request body:', requestBody);

    const response = await fetch(apiEndpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${settings.apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': window.location.origin,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      let errorMessage = `API request failed: ${response.status}`;
      try {
        const error = await response.json();
        if (error?.message) {
          errorMessage = error.message;
        }
      } catch {
        const text = await response.text();
        if (text) {
          errorMessage = `${errorMessage} - ${text}`;
        }
      }
      throw new Error(errorMessage);
    }

    const data = await response.json();

    console.log('[ImageGen] Response data:', JSON.stringify(data, null, 2));

    // Extract base64 image from response per OpenRouter docs:
    // response.choices[0].message.images[0].image_url.url
    const images = data.choices?.[0]?.message?.images;

    if (!images || !Array.isArray(images) || images.length === 0) {
      console.error('[ImageGen] No images in response. Full response:', data);
      throw new Error('No images in response');
    }

    const imageUrl = images[0]?.image_url?.url;

    if (!imageUrl || typeof imageUrl !== 'string') {
      console.error('[ImageGen] Invalid image format. Image object:', images[0]);
      throw new Error('Invalid image format in response');
    }

    console.log('[ImageGen] Successfully extracted image URL (first 50 chars):', imageUrl.substring(0, 50));

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
 * Generate a single card image (video generation will use this)
 * Note: frameCount parameter kept for backward compatibility but ignored
 */
export async function generateCardFrames(
  card: TarotCard,
  deckType: string,
  _frameCount: number,
  settings: Settings,
  onProgress?: (current: number, total: number) => void
): Promise<string[]> {
  const interpretation = getInterpretationForDeck(card, deckType);
  const config = configData.configuration;

  // Get narrative from card (now stored in JSON)
  const narrative = (card as any).narrative;

  // Build lore section using template from config
  let loreSection = '';
  if (narrative && config.promptComposition.loreTemplate) {
    loreSection = config.promptComposition.loreTemplate
      .replace('{summary}', narrative.summary || '')
      .replace('{axis}', narrative.axis || '')
      .replace('{feel}', narrative.feel || '')
      .replace('{stance}', narrative.stance || '')
      .replace('{scene}', narrative.scene || '')
      .replace('{question}', narrative.question || '');
  }

  // Build traditional symbolism section if applicable
  let tradition = '';
  if (deckType === 'traditional-rider-waite') {
    const entry = traditionalSymbols.find((e) => e.number === card.number);
    if (entry) {
      tradition = ` Traditional Rider-Waite symbolism: ${entry.symbols} Archetype: ${entry.archetype}. Astrological/Elemental: ${entry.astro}. Hebrew letter: ${entry.qabalah}. Upright themes: ${entry.upright}. Reversed themes: ${entry.reversed}.`;
    }
  }

  // LOTM lore if using lord-of-mysteries deck
  let lotm = '';
  if (deckType === 'lord-of-mysteries' || deckType === 'lord-of-mysteries-masterpiece') {
    const entry = (lotmLore as any).cards?.find((e: any) => e.number === card.number);
    if (entry) {
      const status = entry.status ? ` (${entry.status})` : '';
      lotm = ` LOTM inspiration (use as flavor only): Pathway ${entry.pathway}; Seq0 ${entry.deity}. Owner: ${entry.owner}${status}. Visual cues: ${entry.visual}.`;
    }
  }

  // Deck-specific lore for Egyptian/Celtic/Shinto
  let deckLoreText = '';
  const loreEntry = (deckLore as any).cards?.find((e: any) => e.number === card.number);
  if (loreEntry) {
    if (deckType === 'egyptian-tarot' && loreEntry.egyptian) {
      deckLoreText = ` Egyptian inspiration (flavor only): ${loreEntry.egyptian.title} — ${loreEntry.egyptian.motif}. Visual: ${loreEntry.egyptian.visual}.`;
    } else if (deckType === 'celtic-tarot' && loreEntry.celtic) {
      deckLoreText = ` Celtic inspiration (flavor only): ${loreEntry.celtic.title} — ${loreEntry.celtic.motif}. Visual: ${loreEntry.celtic.visual}.`;
    } else if (deckType === 'japanese-shinto' && loreEntry.shinto) {
      deckLoreText = ` Shinto inspiration (flavor only): ${loreEntry.shinto.title} — ${loreEntry.shinto.motif}. Visual: ${loreEntry.shinto.visual}.`;
    } else if (deckType === 'buddhist') {
      const bEntry = (buddhistLore as any).cards?.find((b: any) => b.number === card.number);
      if (bEntry) {
        deckLoreText = ` Buddhist inspiration (flavor only): ${bEntry.title} — ${bEntry.concept}. Visual: ${bEntry.visual}.`;
      }
    }
  }

  // Get framing instructions from config
  const framing = config.promptComposition.framingInstructions;

  // Compose final prompt using configurable order
  const compositionOrder =
    config.promptComposition.compositionOrder && config.promptComposition.compositionOrder.length > 0
      ? config.promptComposition.compositionOrder
      : ['deckPrompt', 'lore', 'tradition', 'framing'];

  const promptParts: Record<string, string> = {
    deckPrompt: interpretation.prompt || '',
    deckLore: deckLoreText || '',
    lore: loreSection || '',
    tradition: tradition || '',
    lotm,
    framing: framing || '',
  };

  const composed = compositionOrder
    .map((key) => promptParts[key]?.trim())
    .filter(Boolean)
    .join(' ')
    .trim() || interpretation.prompt;

  const roman = card.number > 0 ? toRoman(card.number) : '0';
  const cardNumberNote =
    card.number === 0
      ? 'Integrate the number 0 into the card design (corner, frame engraving, or sigil).'
      : `Integrate the card number ${card.number} (${roman}) into the design—subtle corner numbering, border engraving, or a small background sigil.`;

  const basePrompt = `${composed} ${cardNumberNote}`.trim();

  // Generate single image only (for video reference)
  onProgress?.(1, 1);

  const userPhoto = settings.usePhoto === false ? '' : settings.userPhoto;
  const result = await generateImage(basePrompt, userPhoto, settings);

  if (result.error) {
    throw new Error(`Image generation failed: ${result.error}`);
  }

  // Return as single-item array for backward compatibility
  return [result.imageUrl];
}
