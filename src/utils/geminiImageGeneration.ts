import { GoogleGenerativeAI } from '@google/generative-ai';
import type { Settings } from '../types';
import type { ImageGenerationResult } from './imageGeneration';
import configData from '../data/tarot-config.json';

/**
 * Generate image using Gemini API with img2img support
 * Based on Gemini 2.5 Flash Image (Nano Banana)
 */
export async function generateImageWithGemini(
  prompt: string,
  userPhoto: string,
  settings: Settings
): Promise<ImageGenerationResult> {
  try {
    const apiKey = settings.geminiApiKey;
    if (!apiKey) {
      throw new Error('Gemini API key is required. Please add it in settings.');
    }

    const apiInstructions = configData.configuration?.apiInstructions?.gemini || {};
    const promptWithSuffix = settings.promptSuffix ? `${prompt}${settings.promptSuffix}` : prompt;
    const requestTemplate =
      apiInstructions.requestPrefix ||
      'Generate a tarot card image based on this description: {prompt}. Aspect ratio: 2:3 (vertical tarot card).';
    const resolvedPrompt = requestTemplate.includes('{prompt}')
      ? requestTemplate.replace('{prompt}', promptWithSuffix)
      : `${requestTemplate}${promptWithSuffix}`;
    const photoInstruction =
      apiInstructions.photoInstruction || "Use the provided reference photo to maintain the person's facial features and likeness.";
    const multiInstructionTemplate = apiInstructions.multiImageInstructionTemplate || '{instruction}';

    const allowImages = settings.usePhoto !== false;

    console.log('[Gemini] Starting image generation');
    console.log('[Gemini] Model:', settings.generationModel);
    console.log('[Gemini] Prompt:', resolvedPrompt);
    console.log(
      '[Gemini] Reference images:',
      allowImages ? settings.referenceImages?.length || 'Using legacy userPhoto' : 'Disabled by setting'
    );

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: settings.generationModel });
    const hasReferenceImages = allowImages && Array.isArray(settings.referenceImages) && settings.referenceImages.length > 0;
    const hasUserPhoto = allowImages && Boolean(userPhoto);

    // Build parts array for the request
    const parts: any[] = [
      {
        text: resolvedPrompt,
      },
    ];

    // Use new multi-image system if available
    if (hasReferenceImages) {
      console.log('[Gemini] Using multi-image reference system');

      settings.referenceImages.forEach((refImg, index) => {
        const base64Data = refImg.dataUrl.split(',')[1];
        const mimeType = refImg.dataUrl.match(/data:([^;]+);/)?.[1] || 'image/jpeg';

        console.log(`[Gemini] Adding reference image ${index + 1}: ${refImg.type} - "${refImg.instruction}"`);

        parts.push({
          inlineData: {
            mimeType,
            data: base64Data,
          },
        });

        parts.push({
          text: multiInstructionTemplate.includes('{instruction}')
            ? multiInstructionTemplate.replace('{instruction}', refImg.instruction || photoInstruction)
            : refImg.instruction || photoInstruction,
        });
      });
    } else if (hasUserPhoto) {
      // Fallback to legacy single photo
      console.log('[Gemini] Using legacy single photo system');
      const base64Data = userPhoto.split(',')[1];
      const mimeType = userPhoto.match(/data:([^;]+);/)?.[1] || 'image/jpeg';

      parts.push({
        inlineData: {
          mimeType,
          data: base64Data,
        },
      });

      parts.push({
        text: photoInstruction,
      });
    } else if (!allowImages) {
      console.log('[Gemini] Personal images disabled via settings; generating from text prompt only');
    }

    // Prepare request with all parts
    const requestPayload: any = {
      contents: [
        {
          role: 'user',
          parts,
        },
      ],
    };

    // Add response modalities for image generation with Pro model features
    const isPro = settings.generationModel.includes('gemini-3-pro');

    requestPayload.generationConfig = {
      responseModalities: ['TEXT', 'IMAGE'],
    };

    console.log('[Gemini] Config:', JSON.stringify(requestPayload.generationConfig, null, 2));
    console.log('[Gemini] Request:', {
      model: settings.generationModel,
      textParts: parts.filter((p) => p.text).map((p) => p.text),
      inlineImages: parts.filter((p) => p.inlineData).length,
      inlineImageSizes: parts
        .filter((p) => p.inlineData)
        .map((p) => `${p.inlineData.mimeType || 'unknown'} (${p.inlineData.data.length} chars base64)`),
    });

    console.log('[Gemini] Sending request...');
    const result = await model.generateContent(requestPayload);
    const response = result.response;

    console.log('[Gemini] Response received');

    // Extract image from response
    let foundImageData: string | null = null;
    const responseParts = response.candidates?.[0]?.content?.parts || [];

    for (const part of responseParts) {
      if (part.inlineData?.data) {
        foundImageData = part.inlineData.data;
        const partMimeType = part.inlineData.mimeType || 'image/png';
        console.log('[Gemini] Found image data, mime type:', partMimeType);

        // Return as data URL
        const imageUrl = `data:${partMimeType};base64,${foundImageData}`;
        return { imageUrl };
      }
    }

    // If no image found, log full response for debugging
    console.error('[Gemini] No image data found in response:', JSON.stringify(response, null, 2));
    throw new Error('No image data in Gemini response. The model may not support image generation or the prompt was rejected.');

  } catch (error: any) {
    console.error('[Gemini] Image generation error:', error);

    // Enhanced error messages
    let message = error?.message || 'Unknown error occurred';

    if (message.includes('API key')) {
      message = 'Invalid Gemini API key. Please check your API key in Settings.';
    } else if (message.includes('response_mime_type') || message.includes('response modalities')) {
      message = 'This Gemini model does not support image generation. Please select "gemini-2.5-flash-image" model.';
    } else if (message.includes('safety') || message.includes('blocked')) {
      message = 'Content blocked by safety filters. Try rephrasing the prompt to be less specific.';
    } else if (message.includes('quota') || message.includes('rate limit')) {
      message = 'API rate limit exceeded. Please wait a moment and try again.';
    }

    return {
      imageUrl: '',
      error: message,
    };
  }
}
