/**
 * Utility to load and manage style reference images for tarot cards
 */

export interface StyleReference {
  cardNumber: number;
  fileName: string;
  url: string;
  name: string;
}

/**
 * Get the folder path for a card's style references
 */
export function getStyleFolderPath(cardNumber: number, cardName: string): string {
  const paddedNumber = cardNumber.toString().padStart(2, '0');
  return `/styles/card-${paddedNumber}-${cardName.toLowerCase().replace(/\s+/g, '-')}`;
}

/**
 * Load available style references for a specific card
 * This is a client-side function that attempts to load a manifest or discover images
 */
export async function loadAvailableStyles(cardNumber: number, cardName: string): Promise<StyleReference[]> {
  const folderPath = getStyleFolderPath(cardNumber, cardName);

  // Try to load manifest file if it exists
  try {
    const manifestResponse = await fetch(`${folderPath}/manifest.json`);
    if (manifestResponse.ok) {
      const manifest = await manifestResponse.json();
      return manifest.styles.map((style: any) => ({
        cardNumber,
        fileName: style.fileName,
        url: `${folderPath}/${style.fileName}`,
        name: style.name || style.fileName.replace(/\.[^.]+$/, ''),
      }));
    }
  } catch (error) {
    console.log('[StyleLoader] No manifest found, using fallback discovery');
  }

  // Fallback: Try common image names
  const commonNames = [
    'style-01.jpg',
    'style-02.jpg',
    'style-03.jpg',
    'mystical.jpg',
    'vintage.jpg',
    'modern.jpg',
    'golden.png',
    'dark.png',
    'celestial.png',
  ];

  const availableStyles: StyleReference[] = [];

  for (const fileName of commonNames) {
    try {
      const url = `${folderPath}/${fileName}`;
      const response = await fetch(url, { method: 'HEAD' });
      if (response.ok) {
        availableStyles.push({
          cardNumber,
          fileName,
          url,
          name: fileName.replace(/\.[^.]+$/, '').replace(/-/g, ' '),
        });
      }
    } catch {
      // File doesn't exist, skip
    }
  }

  return availableStyles;
}

/**
 * Create a manifest file template for a card
 */
export function createManifestTemplate(cardNumber: number, cardName: string): string {
  return JSON.stringify({
    card: {
      number: cardNumber,
      name: cardName,
    },
    styles: [
      {
        fileName: 'style-01.jpg',
        name: 'Mystical Purple',
        description: 'Deep purples with mystical atmosphere',
      },
      {
        fileName: 'style-02.jpg',
        name: 'Vintage Golden',
        description: 'Warm golds with vintage tarot aesthetic',
      },
    ],
  }, null, 2);
}
