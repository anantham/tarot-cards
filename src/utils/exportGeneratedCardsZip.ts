import JSZip from 'jszip';
import type { GeneratedCard } from '../types';

function getExtensionFromUrl(url: string): string {
  const match = url.split('.').pop();
  if (!match) return '.bin';
  const ext = match.split('?')[0].split('#')[0];
  return ext ? `.${ext}` : '.bin';
}

function mimeToExtension(mime: string): string {
  if (mime.includes('png')) return '.png';
  if (mime.includes('jpeg') || mime.includes('jpg')) return '.jpg';
  if (mime.includes('gif')) return '.gif';
  if (mime.includes('mp4')) return '.mp4';
  if (mime.includes('webm')) return '.webm';
  if (mime.includes('octet-stream')) return '.bin';
  return '';
}

async function fetchAsArrayBuffer(url: string): Promise<{ data: ArrayBuffer; ext: string }> {
  if (url.startsWith('data:')) {
    const [meta, data] = url.split(',');
    const mime = meta.split(';')[0].replace('data:', '') || 'application/octet-stream';
    const ext = mimeToExtension(mime);
    const buffer = Uint8Array.from(atob(data), (c) => c.charCodeAt(0)).buffer;
    return { data: buffer, ext };
  }

  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Failed to fetch ${url}`);
  const blob = await resp.blob();
  const ext = mimeToExtension(blob.type) || getExtensionFromUrl(url);
  const buffer = await blob.arrayBuffer();
  return { data: buffer, ext };
}

type ExportStatusWriter = (status: string) => void;

export async function exportGeneratedCardsZip(
  generatedCards: GeneratedCard[],
  onStatus: ExportStatusWriter
): Promise<void> {
  const zip = new JSZip();

  const manifest = generatedCards.map((card) => ({
    cardNumber: card.cardNumber,
    deckType: card.deckType,
    timestamp: card.timestamp,
    shared: card.shared,
    source: card.source,
    frames: [] as string[],
    gifUrl: undefined as string | undefined,
    videoUrl: undefined as string | undefined,
  }));

  zip.file('manifest.json', JSON.stringify(manifest, null, 2));

  let processed = 0;
  const totalAssets = generatedCards.reduce(
    (sum, card) => sum + card.frames.length + (card.gifUrl ? 1 : 0) + (card.videoUrl ? 1 : 0),
    0
  );

  for (let cardIndex = 0; cardIndex < generatedCards.length; cardIndex++) {
    const card = generatedCards[cardIndex];

    for (let i = 0; i < card.frames.length; i++) {
      onStatus(`Exporting card ${card.cardNumber} frame ${i + 1}/${card.frames.length}...`);
      const { data, ext } = await fetchAsArrayBuffer(card.frames[i]);
      const path = `media/card-${card.cardNumber}-frame-${i}${ext}`;
      zip.file(path, data);
      manifest[cardIndex].frames.push(path);
      processed++;
    }

    if (card.gifUrl) {
      onStatus(`Exporting card ${card.cardNumber} gif...`);
      const { data, ext } = await fetchAsArrayBuffer(card.gifUrl);
      const path = `media/card-${card.cardNumber}-gif${ext}`;
      zip.file(path, data);
      manifest[cardIndex].gifUrl = path;
      processed++;
    }

    if (card.videoUrl) {
      onStatus(`Exporting card ${card.cardNumber} video...`);
      const { data, ext } = await fetchAsArrayBuffer(card.videoUrl);
      const path = `media/card-${card.cardNumber}-video${ext}`;
      zip.file(path, data);
      manifest[cardIndex].videoUrl = path;
      processed++;
    }
  }

  onStatus(`Bundling ${processed}/${totalAssets} assets...`);
  const content = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(content);
  const a = document.createElement('a');
  a.href = url;
  a.download = `tarot-cards-export-${Date.now()}.zip`;
  a.click();
  URL.revokeObjectURL(url);
}
