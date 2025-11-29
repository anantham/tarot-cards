import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useStore } from '../store/useStore';
import { useCardGeneration } from '../hooks/useCardGeneration';
import { useGallerySharing } from '../hooks/useGallerySharing';
import { getUnsharedCards } from '../utils/idb';
import tarotData from '../data/tarot-decks.json';
import CommunityGallery from './CommunityGallery';
import type { TarotDeckData } from '../types';

const deckData = tarotData as TarotDeckData;

export default function Settings() {
  const {
    settings,
    updateSettings,
    setShowSettings,
    clearGeneratedCards,
    isGenerating,
    generatedCards,
    setSelectedCard,
    setReturnToSettingsOnClose,
  } = useStore();

  const { generateSingleCard, generateAllCards, generateAllVideos, error: generationError } = useCardGeneration();
  const { uploadSession, uploading: isUploading, progress: uploadProgress } = useGallerySharing();

  const [testCardNumber, setTestCardNumber] = useState(0);
  const [unsharedCount, setUnsharedCount] = useState(0);
  const [photoPreview, setPhotoPreview] = useState(settings.userPhoto);
  const [referenceImages, setReferenceImages] = useState<Array<{
    id: string;
    dataUrl: string;
    instruction: string;
    type: 'face' | 'body' | 'style' | 'background' | 'custom';
  }>>(settings.referenceImages || []);
  const [showControls, setShowControls] = useState(false);
  const [showGallery, setShowGallery] = useState(false);
  const [galleryDeckFilter, setGalleryDeckFilter] = useState<string>('all');
  const [dismissedError, setDismissedError] = useState(false);
  const [showCommunityGallery, setShowCommunityGallery] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportStatus, setExportStatus] = useState<string>('');
  const [deckName, setDeckName] = useState(settings.deckName || settings.selectedDeckType || '');
  const [deckDescription, setDeckDescription] = useState(settings.deckDescription || '');

  // Shared generation state
  const showCardInfo = settings.showCardInfo !== false;
  const navWithArrows = settings.navigateWithArrows === true;
  const usePhoto = settings.usePhoto !== false;
  const lowerError = (generationError || '').toLowerCase();
  const isRateLimitError = lowerError.includes('rate limit') || lowerError.includes('quota');
  const hasImageApiKey = settings.apiProvider === 'gemini'
    ? Boolean(settings.geminiApiKey)
    : Boolean(settings.apiKey);
  const missingApiKeyMessage =
    settings.apiProvider === 'gemini'
      ? 'Enter your Gemini API key above to enable generation.'
      : 'Enter your OpenRouter API key above to enable generation.';

  useEffect(() => {
    setDismissedError(false);
  }, [generationError]);

  // Update unshared card count
  useEffect(() => {
    getUnsharedCards().then((cards) => setUnsharedCount(cards.length));
  }, [generatedCards]);

  // Navigation guard: prevent closing tab during upload
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isUploading) {
        e.preventDefault();
        e.returnValue = 'Upload in progress. Are you sure you want to leave?';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isUploading]);

  const handleSettingsClose = async () => {
    // Auto-upload unshared cards if enabled
    if (settings.autoShareEnabled && unsharedCount > 0 && !isUploading) {
      const success = await uploadSession(settings.displayName);
      if (success) {
        updateSettings({ lastSharedTimestamp: Date.now() });
      }
    }
    setShowSettings(false);
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        setPhotoPreview(result);
        updateSettings({ userPhoto: result, usePhoto: settings.usePhoto ?? true });
      };
      reader.readAsDataURL(file);
    }
  };

  const handlePhotoRemove = () => {
    setPhotoPreview('');
    updateSettings({ userPhoto: '', usePhoto: false });
  };

  const handleReferenceImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const newImage = {
          id: `img-${Date.now()}-${Math.random()}`,
          dataUrl: reader.result as string,
          instruction: 'Use facial features from this photo',
          type: 'face' as const,
        };
        const updated = [...referenceImages, newImage];
        setReferenceImages(updated);
        updateSettings({ referenceImages: updated });
      };
      reader.readAsDataURL(file);
    });
  };

  const updateReferenceImage = (id: string, updates: Partial<typeof referenceImages[0]>) => {
    const updated = referenceImages.map((img) =>
      img.id === id ? { ...img, ...updates } : img
    );
    setReferenceImages(updated);
    updateSettings({ referenceImages: updated });
  };

  const removeReferenceImage = (id: string) => {
    const updated = referenceImages.filter((img) => img.id !== id);
    setReferenceImages(updated);
    updateSettings({ referenceImages: updated });
  };

  const getInstructionForType = (type: string): string => {
    switch (type) {
      case 'face':
        return 'Use facial features and likeness from this photo';
      case 'body':
        return 'Use body pose and stance from this reference';
      case 'style':
        return 'Match the artistic style from this image';
      case 'background':
        return 'Use background elements from this reference';
      case 'custom':
        return 'Custom instruction...';
      default:
        return '';
    }
  };

  // Export all generated cards (frames/videos) as a zip with manifest
  const handleExportAll = async () => {
    try {
      if (generatedCards.length === 0) {
        alert('No generated cards to export.');
        return;
      }
      setExporting(true);
      setExportStatus('Loading zip library...');

      // @ts-expect-error - Dynamic CDN import without type definitions
      const { default: JSZip } = await import('https://cdn.jsdelivr.net/npm/jszip@3.10.1/+esm');
      const zip = new JSZip();

      // Manifest for re-import/interoperability
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
      const totalAssets = generatedCards.reduce((sum, card) => sum + card.frames.length + (card.gifUrl ? 1 : 0) + (card.videoUrl ? 1 : 0), 0);

      const fetchAsArrayBuffer = async (url: string): Promise<{ data: ArrayBuffer; ext: string }> => {
        // Handle data URLs directly
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
      };

      // Helper: derive extension from URL or mime
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

      for (let cardIndex = 0; cardIndex < generatedCards.length; cardIndex++) {
        const card = generatedCards[cardIndex];
        // Frames
        for (let i = 0; i < card.frames.length; i++) {
          setExportStatus(`Exporting card ${card.cardNumber} frame ${i + 1}/${card.frames.length}...`);
          const { data, ext } = await fetchAsArrayBuffer(card.frames[i]);
          const path = `media/card-${card.cardNumber}-frame-${i}${ext}`;
          zip.file(path, data);
          manifest[cardIndex].frames.push(path);
          processed++;
        }
        // GIF
        if (card.gifUrl) {
          setExportStatus(`Exporting card ${card.cardNumber} gif...`);
          const { data, ext } = await fetchAsArrayBuffer(card.gifUrl);
          const path = `media/card-${card.cardNumber}-gif${ext}`;
          zip.file(path, data);
          manifest[cardIndex].gifUrl = path;
          processed++;
        }
        // Video
        if (card.videoUrl) {
          setExportStatus(`Exporting card ${card.cardNumber} video...`);
          const { data, ext } = await fetchAsArrayBuffer(card.videoUrl);
          const path = `media/card-${card.cardNumber}-video${ext}`;
          zip.file(path, data);
          manifest[cardIndex].videoUrl = path;
          processed++;
        }
      }

      setExportStatus(`Bundling ${processed}/${totalAssets} assets...`);
      const content = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(content);
      const a = document.createElement('a');
      a.href = url;
      a.download = `tarot-cards-export-${Date.now()}.zip`;
      a.click();
      URL.revokeObjectURL(url);
      setExportStatus('Export complete. Zip downloaded.');
    } catch (err) {
      console.error('Export error:', err);
      alert(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setExporting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 300,
        background: 'rgba(10, 14, 39, 0.95)',
        backdropFilter: 'blur(20px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem',
      }}
      onClick={handleSettingsClose}
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: '900px',
          width: '100%',
          maxHeight: '90vh',
          background: 'linear-gradient(135deg, rgba(26, 26, 46, 0.98) 0%, rgba(22, 33, 62, 0.98) 100%)',
          borderRadius: '20px',
          border: '2px solid rgba(147, 51, 234, 0.3)',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
          overflow: 'auto',
          padding: '2.5rem',
        }}
      >
        <div style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: '2rem', fontWeight: '700' }}>Settings</h2>
          <button
            onClick={handleSettingsClose}
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              background: 'rgba(255, 255, 255, 0.1)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              color: '#e8e8e8',
              fontSize: '1.2rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            ✕
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          {/* Photo Upload Section */}
          <section>
            <h3 style={{ fontSize: '1.3rem', marginBottom: '1rem', color: '#d4af37' }}>
              Your Photo
            </h3>
            <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'flex-start' }}>
              <div
                style={{
                  width: '150px',
                  height: '150px',
                  borderRadius: '12px',
                  border: '2px solid rgba(147, 51, 234, 0.5)',
                  overflow: 'hidden',
                  background: 'rgba(0, 0, 0, 0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {photoPreview ? (
                  <img src={photoPreview} alt="Your photo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <div style={{ textAlign: 'center', opacity: 0.5 }}>
                    <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📸</div>
                    <div style={{ fontSize: '0.8rem' }}>No photo</div>
                  </div>
                )}
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: '0.95rem', marginBottom: '1rem', opacity: 0.8, lineHeight: '1.5' }}>
                  Upload your photo to generate personalized tarot cards. This will be used as the base for all 22 cards, placing you in each archetypal role.
                </p>
                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <label
                    style={{
                      display: 'inline-block',
                      padding: '0.75rem 1.5rem',
                      background: 'rgba(147, 51, 234, 0.3)',
                      border: '1px solid rgba(147, 51, 234, 0.5)',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontSize: '0.95rem',
                      fontWeight: '500',
                      transition: 'all 0.3s ease',
                    }}
                  >
                    📁 Choose Photo
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoUpload}
                      style={{ display: 'none' }}
                    />
                  </label>
                  <button
                    onClick={handlePhotoRemove}
                    disabled={!photoPreview}
                    style={{
                      padding: '0.75rem 1.25rem',
                      background: photoPreview ? 'rgba(255, 0, 0, 0.15)' : 'rgba(100, 100, 100, 0.2)',
                      border: photoPreview ? '1px solid rgba(255, 0, 0, 0.35)' : '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: '8px',
                      color: '#e8e8e8',
                      fontSize: '0.95rem',
                      fontWeight: '500',
                      cursor: photoPreview ? 'pointer' : 'not-allowed',
                      opacity: photoPreview ? 1 : 0.5,
                      transition: 'all 0.3s ease',
                    }}
                  >
                    🗑️ Remove Photo
                  </button>
                </div>
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={usePhoto}
                    onChange={(e) => updateSettings({ usePhoto: e.target.checked })}
                    style={{ width: '18px', height: '18px', marginTop: '0.15rem' }}
                  />
                  <div>
                    <div style={{ fontSize: '0.95rem', fontWeight: '600' }}>
                      Use uploaded images for generation
                    </div>
                    <div style={{ fontSize: '0.85rem', opacity: 0.7, lineHeight: '1.6' }}>
                      Toggle off to keep your photo and reference images stored locally but generate cards without sending them to the API.
                    </div>
                  </div>
                </label>
              </div>
            </div>
          </section>

          {/* Multi-Image References (Gemini only) */}
          {settings.apiProvider === 'gemini' && (
            <section>
              <h3 style={{ fontSize: '1.3rem', marginBottom: '1rem', color: '#d4af37' }}>
                Reference Images (Advanced)
              </h3>
              <p style={{ fontSize: '0.9rem', marginBottom: '1rem', opacity: 0.8, lineHeight: '1.5' }}>
                Upload multiple reference images to blend faces, poses, styles, and backgrounds into your tarot cards.
              </p>
              {settings.usePhoto === false && (
                <div style={{
                  marginBottom: '1rem',
                  padding: '0.75rem 1rem',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '8px',
                  color: '#ffb347',
                  fontSize: '0.85rem',
                }}>
                  Image references are currently disabled. Turn on "Use uploaded images for generation" above to include them.
                </div>
              )}

              {/* Upload Button */}
              <label
                style={{
                  display: 'inline-block',
                  padding: '0.75rem 1.5rem',
                  background: 'rgba(212, 175, 55, 0.2)',
                  border: '1px solid rgba(212, 175, 55, 0.5)',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '0.95rem',
                  fontWeight: '500',
                  marginBottom: '1.5rem',
                  transition: 'all 0.3s ease',
                }}
              >
                + Add Reference Images
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleReferenceImageUpload}
                  style={{ display: 'none' }}
                />
              </label>

              {/* Image Gallery */}
              {referenceImages.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
                  {referenceImages.map((img) => (
                    <div
                      key={img.id}
                      style={{
                        background: 'rgba(0, 0, 0, 0.3)',
                        border: '1px solid rgba(147, 51, 234, 0.3)',
                        borderRadius: '8px',
                        padding: '0.75rem',
                        position: 'relative',
                      }}
                    >
                      {/* Remove Button */}
                      <button
                        onClick={() => removeReferenceImage(img.id)}
                        style={{
                          position: 'absolute',
                          top: '0.5rem',
                          right: '0.5rem',
                          width: '24px',
                          height: '24px',
                          borderRadius: '50%',
                          background: 'rgba(255, 0, 0, 0.8)',
                          border: 'none',
                          color: 'white',
                          cursor: 'pointer',
                          fontSize: '0.9rem',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        ✕
                      </button>

                      {/* Image Preview */}
                      <img
                        src={img.dataUrl}
                        alt="Reference"
                        style={{
                          width: '100%',
                          height: '120px',
                          objectFit: 'cover',
                          borderRadius: '4px',
                          marginBottom: '0.75rem',
                        }}
                      />

                      {/* Type Selector */}
                      <select
                        value={img.type}
                        onChange={(e) => {
                          const newType = e.target.value as typeof img.type;
                          updateReferenceImage(img.id, {
                            type: newType,
                            instruction: getInstructionForType(newType),
                          });
                        }}
                        style={{
                          width: '100%',
                          padding: '0.5rem',
                          background: 'rgba(0, 0, 0, 0.4)',
                          border: '1px solid rgba(255, 255, 255, 0.2)',
                          borderRadius: '4px',
                          color: '#e8e8e8',
                          fontSize: '0.85rem',
                          marginBottom: '0.5rem',
                          cursor: 'pointer',
                        }}
                      >
                        <option value="face">Face Reference</option>
                        <option value="body">Body/Pose Reference</option>
                        <option value="style">Style Reference</option>
                        <option value="background">Background Reference</option>
                        <option value="custom">Custom Instruction</option>
                      </select>

                      {/* Instruction Input */}
                      <textarea
                        value={img.instruction}
                        onChange={(e) => updateReferenceImage(img.id, { instruction: e.target.value })}
                        placeholder="Instruction for this image..."
                        rows={2}
                        style={{
                          width: '100%',
                          padding: '0.5rem',
                          background: 'rgba(0, 0, 0, 0.4)',
                          border: '1px solid rgba(255, 255, 255, 0.2)',
                          borderRadius: '4px',
                          color: '#e8e8e8',
                          fontSize: '0.8rem',
                          fontFamily: 'inherit',
                          resize: 'vertical',
                        }}
                      />
                    </div>
                  ))}
                </div>
              )}

              {referenceImages.length === 0 && (
                <p style={{ fontSize: '0.85rem', opacity: 0.5, fontStyle: 'italic' }}>
                  No reference images added yet. Click "Add Reference Images" to get started.
                </p>
              )}
            </section>
          )}

          {/* Deck Type Selection */}
          <section>
            <h3 style={{ fontSize: '1.3rem', marginBottom: '1rem', color: '#d4af37' }}>
              Deck Type
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {deckData.deckTypes.map((deck) => (
                <label
                  key={deck.id}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '0.75rem',
                    padding: '1rem',
                    background: settings.selectedDeckType === deck.id ? 'rgba(147, 51, 234, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                    border: `1px solid ${settings.selectedDeckType === deck.id ? 'rgba(147, 51, 234, 0.5)' : 'rgba(255, 255, 255, 0.1)'}`,
                    borderRadius: '8px',
                    cursor: 'pointer',
                    transition: 'all 0.3s ease',
                  }}
                >
                  <input
                    type="radio"
                    name="deckType"
                    value={deck.id}
                    checked={settings.selectedDeckType === deck.id}
                    onChange={(e) => updateSettings({ selectedDeckType: e.target.value })}
                    style={{ marginTop: '0.25rem' }}
                  />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '0.25rem' }}>
                      {deck.name}
                    </div>
                    <div style={{ fontSize: '0.85rem', opacity: 0.7 }}>
                      {deck.description}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </section>

          {/* Generation Settings */}
          <section>
            <h3 style={{ fontSize: '1.3rem', marginBottom: '1rem', color: '#d4af37' }}>
              Generation Settings
            </h3>

            {/* API Provider */}
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: '0.5rem', opacity: 0.9 }}>
                API Provider
              </label>
              <select
                value={settings.apiProvider || 'gemini'}
                onChange={(e) => updateSettings({ apiProvider: e.target.value as 'openrouter' | 'gemini' })}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  background: 'rgba(0, 0, 0, 0.3)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  borderRadius: '8px',
                  color: '#e8e8e8',
                  fontSize: '0.95rem',
                  cursor: 'pointer',
                }}
              >
                <option value="gemini">Gemini Direct (Supports img2img with your photo!)</option>
                <option value="openrouter">OpenRouter (Text-to-image only)</option>
              </select>
              <p style={{ fontSize: '0.8rem', marginTop: '0.5rem', opacity: 0.6 }}>
                Gemini Direct allows using your photo as reference for tarot cards
              </p>
            </div>

            {/* Gemini API Key */}
            {settings.apiProvider === 'gemini' && (
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: '0.5rem', opacity: 0.9 }}>
                  Gemini API Key
                </label>
                <input
                  type="password"
                  value={settings.geminiApiKey || ''}
                  onChange={(e) => updateSettings({ geminiApiKey: e.target.value })}
                  placeholder="AIza..."
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    background: 'rgba(0, 0, 0, 0.3)',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    borderRadius: '8px',
                    color: '#e8e8e8',
                    fontSize: '0.95rem',
                  }}
                />
                <p style={{ fontSize: '0.8rem', marginTop: '0.5rem', opacity: 0.6 }}>
                  Get your API key from{' '}
                  <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" style={{ color: '#9333ea' }}>
                    Google AI Studio
                  </a>
                </p>
              </div>
            )}

            {/* OpenRouter API Key */}
            {settings.apiProvider === 'openrouter' && (
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: '0.5rem', opacity: 0.9 }}>
                  OpenRouter API Key
                </label>
                <input
                  type="password"
                  value={settings.apiKey || ''}
                  onChange={(e) => updateSettings({ apiKey: e.target.value })}
                  placeholder="sk-or-v1-..."
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    background: 'rgba(0, 0, 0, 0.3)',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    borderRadius: '8px',
                    color: '#e8e8e8',
                    fontSize: '0.95rem',
                  }}
                />
                <p style={{ fontSize: '0.8rem', marginTop: '0.5rem', opacity: 0.6 }}>
                  Get your API key from{' '}
                  <a href="https://openrouter.ai/keys" target="_blank" rel="noopener noreferrer" style={{ color: '#9333ea' }}>
                    openrouter.ai
                  </a>
                </p>
              </div>
            )}

            {/* Image Generation Model */}
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: '0.5rem', opacity: 0.9 }}>
                Image Generation Model
              </label>
              <select
                value={settings.generationModel}
                onChange={(e) => updateSettings({ generationModel: e.target.value })}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  background: 'rgba(0, 0, 0, 0.3)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  borderRadius: '8px',
                  color: '#e8e8e8',
                  fontSize: '0.95rem',
                  cursor: 'pointer',
                }}
              >
                {settings.apiProvider === 'gemini' ? (
                  <>
                    <option value="gemini-2.5-flash-image">Gemini 2.5 Flash Image - $0.039/image (Fast)</option>
                    <option value="gemini-3-pro-image-preview">Gemini 3 Pro Image - Higher quality, 2K resolution</option>
                  </>
                ) : (
                  <>
                    <option value="google/gemini-2.5-flash-image">Gemini 2.5 Flash - ~$0.003/image (Cheapest)</option>
                    <option value="openai/gpt-5-image-mini">GPT-5 Image Mini - ~$0.0035/image</option>
                    <option value="google/gemini-3-pro-image-preview">Gemini 3 Pro - ~$0.013/image (Best Quality)</option>
                  </>
                )}
              </select>
              <p style={{ fontSize: '0.8rem', marginTop: '0.5rem', opacity: 0.6 }}>
                {settings.apiProvider === 'gemini'
                  ? 'Gemini Direct models support multi-image blending. Pro model generates 2K resolution images.'
                  : 'Choose the AI model for generating tarot card images. Costs are approximate per image.'}
              </p>
            </div>

            {/* Image Size (Pro models only) */}
            {settings.apiProvider === 'gemini' && settings.generationModel.includes('gemini-3-pro') && (
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: '0.5rem', opacity: 0.9 }}>
                  Image Resolution
                </label>
                <select
                  value={settings.imageSize || '2K'}
                  onChange={(e) => updateSettings({ imageSize: e.target.value as '1K' | '2K' })}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    background: 'rgba(0, 0, 0, 0.3)',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    borderRadius: '8px',
                    color: '#e8e8e8',
                    fontSize: '0.95rem',
                    cursor: 'pointer',
                  }}
                >
                  <option value="1K">1K (1024×1024) - Faster</option>
                  <option value="2K">2K (2048×2048) - Higher Quality</option>
                </select>
                <p style={{ fontSize: '0.8rem', marginTop: '0.5rem', opacity: 0.6 }}>
                  Higher resolution provides better detail but takes longer to generate
                </p>
              </div>
            )}

            {/* Card info visibility */}
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: '0.5rem', opacity: 0.9 }}>
                Card Info on Hover
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={showCardInfo}
                  onChange={(e) => updateSettings({ showCardInfo: e.target.checked })}
                  style={{ width: '18px', height: '18px' }}
                />
                <div>
                  <div style={{ fontSize: '0.95rem' }}>
                    Show card name and number on hover
                  </div>
                  <div style={{ fontSize: '0.85rem', opacity: 0.7 }}>
                    Toggle off for surprise mode—cards stay mysterious until you open them.
                  </div>
                </div>
              </label>
            </div>

            {/* Arrow navigation */}
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: '0.5rem', opacity: 0.9 }}>
                Arrow Navigation (Detail View)
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={navWithArrows}
                  onChange={(e) => updateSettings({ navigateWithArrows: e.target.checked })}
                  style={{ width: '18px', height: '18px' }}
                />
                <div>
                  <div style={{ fontSize: '0.95rem' }}>
                    {navWithArrows ? 'Arrow keys/buttons enabled' : 'Arrow navigation disabled'}
                  </div>
                  <div style={{ fontSize: '0.85rem', opacity: 0.7 }}>
                    Toggle left/right arrow navigation and buttons in the card detail view.
                  </div>
                </div>
              </label>
            </div>

            {/* Prompt suffix */}
            <div>
              <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: '0.5rem', opacity: 0.9 }}>
                Prompt Suffix (style modifiers)
              </label>
              <textarea
                value={settings.promptSuffix}
                onChange={(e) => updateSettings({ promptSuffix: e.target.value })}
                placeholder=", highly detailed, cinematic lighting..."
                rows={3}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  background: 'rgba(0, 0, 0, 0.3)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  borderRadius: '8px',
                  color: '#e8e8e8',
                  fontSize: '0.9rem',
                  fontFamily: 'monospace',
                  resize: 'vertical',
                }}
              />
            </div>

            {/* Deck metadata for sharing */}
            <div style={{ marginTop: '1.5rem' }}>
              <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: '0.5rem', opacity: 0.9 }}>
                Deck Name (for community sharing)
              </label>
              <input
                type="text"
                value={deckName}
                onChange={(e) => {
                  setDeckName(e.target.value);
                  updateSettings({ deckName: e.target.value });
                }}
                placeholder="My Cosmic Deck"
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  background: 'rgba(0, 0, 0, 0.3)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  borderRadius: '8px',
                  color: '#e8e8e8',
                  fontSize: '0.95rem',
                }}
              />
              <label style={{ display: 'block', fontSize: '0.9rem', margin: '0.75rem 0 0.5rem', opacity: 0.9 }}>
                Deck Description (shown in community gallery)
              </label>
              <textarea
                value={deckDescription}
                onChange={(e) => {
                  setDeckDescription(e.target.value);
                  updateSettings({ deckDescription: e.target.value });
                }}
                placeholder="Short description of this deck..."
                rows={2}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  background: 'rgba(0, 0, 0, 0.3)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  borderRadius: '8px',
                  color: '#e8e8e8',
                  fontSize: '0.95rem',
                  resize: 'vertical',
                }}
              />
            </div>
          </section>

          {/* Community Sharing */}
          <section style={{
            background: 'linear-gradient(135deg, rgba(147, 51, 234, 0.1), rgba(79, 70, 229, 0.1))',
            borderRadius: '16px',
            padding: '2rem',
            marginBottom: '2rem',
            border: '1px solid rgba(147, 51, 234, 0.3)',
          }}>
            <h3 style={{ fontSize: '1.3rem', marginBottom: '1.5rem', color: '#9333ea', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span>🌐</span> Community Sharing
            </h3>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.75rem',
                cursor: 'pointer',
                padding: '1.25rem',
                background: 'rgba(147, 51, 234, 0.1)',
                borderRadius: '12px',
                border: '1px solid rgba(147, 51, 234, 0.2)',
                transition: 'all 0.2s',
              }}>
                <input
                  type="checkbox"
                  checked={settings.autoShareEnabled ?? false}
                  onChange={(e) => updateSettings({ autoShareEnabled: e.target.checked })}
                  disabled={isUploading}
                  style={{ width: '1.2rem', height: '1.2rem', marginTop: '0.2rem', flexShrink: 0 }}
                />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '1rem', fontWeight: '500', marginBottom: '0.5rem' }}>
                    Auto-share generated cards to community gallery
                  </div>
                  <div style={{ fontSize: '0.85rem', opacity: 0.8, lineHeight: '1.5' }}>
                    When enabled, your generated cards are automatically uploaded to IPFS when you close Settings.
                    Cards are shared publicly and permanently with the community.
                  </div>
                </div>
              </label>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', fontWeight: '500' }}>
                Display Name (optional)
              </label>
              <input
                type="text"
                value={settings.displayName || ''}
                onChange={(e) => updateSettings({ displayName: e.target.value })}
                placeholder="Anonymous"
                maxLength={50}
                disabled={isUploading}
                style={{
                  width: '100%',
                  padding: '0.75rem 1rem',
                  background: 'rgba(0, 0, 0, 0.3)',
                  border: '1px solid rgba(147, 51, 234, 0.3)',
                  borderRadius: '8px',
                  color: '#e8e8e8',
                  fontSize: '0.95rem',
                }}
              />
              <p style={{ fontSize: '0.8rem', marginTop: '0.5rem', opacity: 0.7 }}>
                Your name will appear on shared galleries. Leave blank to share anonymously.
              </p>
            </div>

            {settings.autoShareEnabled && (
              <div style={{
                padding: '1rem 1.25rem',
                background: isUploading
                  ? 'rgba(147, 51, 234, 0.2)'
                  : 'rgba(147, 51, 234, 0.1)',
                border: '1px solid rgba(147, 51, 234, 0.3)',
                borderRadius: '8px',
                fontSize: '0.9rem',
              }}>
                {isUploading ? (
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                      <span style={{ fontSize: '1.2rem' }}>⏳</span>
                      <span style={{ fontWeight: '500' }}>{uploadProgress}</span>
                    </div>
                    <div style={{ fontSize: '0.8rem', opacity: 0.7 }}>
                      Do not close this tab or navigate away
                    </div>
                  </div>
                ) : unsharedCount > 0 ? (
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                      <span>✓</span>
                      <span style={{ fontWeight: '500' }}>
                        {unsharedCount} card{unsharedCount !== 1 ? 's' : ''} ready to share
                      </span>
                    </div>
                    <div style={{ fontSize: '0.8rem', opacity: 0.7 }}>
                      Will upload when you close Settings
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span>✓</span>
                    <span>All cards synced</span>
                    {settings.lastSharedTimestamp && (
                      <span style={{ opacity: 0.7, fontSize: '0.85rem' }}>
                        • Last shared: {new Date(settings.lastSharedTimestamp).toLocaleString()}
                      </span>
                    )}
                  </div>
                )}
              </div>
            )}
          </section>

          {/* Generated Cards Gallery */}
          <section>
            <div
              onClick={() => setShowGallery(!showGallery)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                cursor: 'pointer',
                padding: '0.75rem 1rem',
                background: 'rgba(147, 51, 234, 0.1)',
                border: '1px solid rgba(147, 51, 234, 0.3)',
                borderRadius: '8px',
                marginBottom: showGallery ? '1rem' : '1.5rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <h3 style={{ fontSize: '1.3rem', margin: 0, color: '#9333ea' }}>
                  Generated Cards Gallery
                </h3>
                <span style={{
                  padding: '0.25rem 0.6rem',
                  background: 'rgba(147, 51, 234, 0.3)',
                  borderRadius: '12px',
                  fontSize: '0.85rem',
                  fontWeight: 'bold',
                }}>
                  {galleryDeckFilter === 'all'
                    ? generatedCards.length
                    : `${generatedCards.filter(c => c.deckType === galleryDeckFilter).length}/${generatedCards.length}`}
                </span>
              </div>
              <span style={{ fontSize: '1.5rem', color: '#9333ea' }}>
                {showGallery ? '−' : '+'}
              </span>
            </div>

            {showGallery && (
              <div style={{
                padding: '1.5rem',
                background: 'rgba(0, 0, 0, 0.2)',
                borderRadius: '8px',
                marginBottom: '1.5rem',
              }}>
                <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', alignItems: 'center' }}>
                  <label style={{ fontSize: '0.9rem', opacity: 0.8 }}>Filter by deck:</label>
                  <select
                    value={galleryDeckFilter}
                    onChange={(e) => setGalleryDeckFilter(e.target.value)}
                    style={{
                      padding: '0.5rem 0.75rem',
                      background: 'rgba(0, 0, 0, 0.3)',
                      border: '1px solid rgba(255, 255, 255, 0.2)',
                      borderRadius: '6px',
                      color: '#e8e8e8',
                      fontSize: '0.9rem',
                    }}
                  >
                    <option value="all">All decks</option>
                    {deckData.deckTypes.map((deck) => (
                      <option key={deck.id} value={deck.id}>{deck.name}</option>
                    ))}
                  </select>
                </div>
                {generatedCards.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '2rem', opacity: 0.6 }}>
                    <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🎴</div>
                    <div style={{ fontSize: '1.1rem' }}>No cards generated yet</div>
                    <div style={{ fontSize: '0.9rem', marginTop: '0.5rem' }}>
                      Generate your first card to see it here
                    </div>
                  </div>
                ) : (
                  <>
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
                      gap: '1rem',
                      marginBottom: '1rem',
                    }}>
                      {(() => {
                        const filteredCards = galleryDeckFilter === 'all'
                          ? generatedCards
                          : generatedCards.filter(c => c.deckType === galleryDeckFilter);

                        if (filteredCards.length === 0) {
                          return (
                            <div style={{ gridColumn: '1 / -1', textAlign: 'center', opacity: 0.7, padding: '1rem' }}>
                              No cards in this deck filter yet.
                            </div>
                          );
                        }

                        const byCard: { [key: number]: typeof generatedCards } = {};
                        filteredCards.forEach(card => {
                          if (!byCard[card.cardNumber]) byCard[card.cardNumber] = [];
                          byCard[card.cardNumber].push(card);
                        });

                        return Object.keys(byCard)
                          .map(Number)
                          .sort((a, b) => a - b)
                          .map(cardNumber => {
                            const cards = byCard[cardNumber].sort((a, b) => b.timestamp - a.timestamp);
                            const latestCard = cards[0];
                            const tarotCard = deckData.cards[cardNumber];

                            return (
                              <div
                                key={cardNumber}
                                onClick={() => {
                                  setSelectedCard(tarotCard);
                                  setReturnToSettingsOnClose(true);
                                  handleSettingsClose();
                                }}
                                style={{
                                  position: 'relative',
                                  aspectRatio: '2/3',
                                  borderRadius: '8px',
                                  overflow: 'hidden',
                                  cursor: 'pointer',
                                  border: '2px solid rgba(147, 51, 234, 0.3)',
                                  transition: 'all 0.2s ease',
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.transform = 'scale(1.05)';
                                  e.currentTarget.style.borderColor = 'rgba(147, 51, 234, 0.6)';
                                  e.currentTarget.style.boxShadow = '0 8px 24px rgba(147, 51, 234, 0.4)';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.transform = 'scale(1)';
                                  e.currentTarget.style.borderColor = 'rgba(147, 51, 234, 0.3)';
                                  e.currentTarget.style.boxShadow = 'none';
                                }}
                              >
                                {latestCard.gifUrl ? (
                                  <img
                                    src={latestCard.gifUrl}
                                    alt={`Card ${cardNumber}`}
                                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                  />
                                ) : latestCard.frames?.[0] ? (
                                  <img
                                    src={latestCard.frames[0]}
                                    alt={`Card ${cardNumber}`}
                                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                  />
                                ) : null}

                                <div style={{
                                  position: 'absolute',
                                  top: '0.5rem',
                                  left: '0.5rem',
                                  padding: '0.25rem 0.5rem',
                                  background: 'rgba(0, 0, 0, 0.7)',
                                  borderRadius: '6px',
                                  fontSize: '0.85rem',
                                  fontWeight: 'bold',
                                  color: '#d4af37',
                                }}>
                                  {cardNumber}
                                </div>

                                {cards.length > 1 && (
                                  <div style={{
                                    position: 'absolute',
                                    top: '0.5rem',
                                    right: '0.5rem',
                                    padding: '0.25rem 0.5rem',
                                    background: 'rgba(147, 51, 234, 0.8)',
                                    borderRadius: '6px',
                                    fontSize: '0.75rem',
                                    fontWeight: 'bold',
                                  }}>
                                    ×{cards.length}
                                  </div>
                                )}

                                {latestCard.videoUrl && (
                                  <div style={{
                                    position: 'absolute',
                                    bottom: '0.5rem',
                                    right: '0.5rem',
                                    padding: '0.25rem 0.5rem',
                                    background: 'rgba(0, 0, 0, 0.7)',
                                    borderRadius: '6px',
                                    fontSize: '0.75rem',
                                    fontWeight: 'bold',
                                    color: '#d4af37',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.25rem',
                                  }}>
                                    🎥 Video
                                  </div>
                                )}
                              </div>
                            );
                          });
                      })()}
                    </div>

                    <div style={{
                      padding: '1rem',
                      background: 'rgba(147, 51, 234, 0.1)',
                      borderRadius: '8px',
                      fontSize: '0.9rem',
                      opacity: 0.8,
                    }}>
                      <div><strong>📊 Statistics:</strong></div>
                      <div style={{ marginTop: '0.5rem', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                        <div>
                          <div style={{ opacity: 0.7 }}>Total Generations:</div>
                          <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#9333ea' }}>
                            {generatedCards.length}
                          </div>
                        </div>
                        <div>
                          <div style={{ opacity: 0.7 }}>Unique Cards:</div>
                          <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#9333ea' }}>
                            {new Set(generatedCards.map(c => c.cardNumber)).size}
                          </div>
                        </div>
                        <div>
                          <div style={{ opacity: 0.7 }}>Current Deck:</div>
                          <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#9333ea' }}>
                            {generatedCards.filter(c => c.deckType === settings.selectedDeckType).length}
                          </div>
                        </div>
                      </div>
                      <div style={{ marginTop: '0.75rem', fontSize: '0.85rem', opacity: 0.6 }}>
                        💡 Tip: Click on any card to view all its generations. Navigate with left/right arrows.
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </section>

          {/* Community Gallery Browser */}
          <section>
            <div
              onClick={() => setShowCommunityGallery(!showCommunityGallery)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                cursor: 'pointer',
                padding: '0.75rem 1rem',
                background: 'rgba(147, 51, 234, 0.1)',
                border: '1px solid rgba(147, 51, 234, 0.3)',
                borderRadius: '8px',
                marginBottom: showCommunityGallery ? '1rem' : '1.5rem',
              }}
            >
              <h3 style={{ fontSize: '1.3rem', margin: 0, color: '#9333ea' }}>
                Community Gallery
              </h3>
              <span style={{ fontSize: '1.5rem', color: '#9333ea' }}>
                {showCommunityGallery ? '−' : '+'}
              </span>
            </div>

            {showCommunityGallery && (
              <div
                style={{
                  padding: '1rem',
                  background: 'rgba(0, 0, 0, 0.25)',
                  borderRadius: '8px',
                  maxHeight: '60vh',
                  overflow: 'auto',
                }}
              >
                <CommunityGallery embedded />
              </div>
            )}
          </section>

          {/* Export / Backup */}
          <section>
            <h3 style={{ fontSize: '1.3rem', marginBottom: '0.75rem', color: '#d4af37' }}>
              Export / Backup
            </h3>
            <p style={{ fontSize: '0.9rem', marginBottom: '0.75rem', opacity: 0.75 }}>
              Download all generated cards (images/videos) plus a manifest as a zip file you can keep or import elsewhere.
            </p>
            <button
              onClick={handleExportAll}
              disabled={exporting || generatedCards.length === 0}
              style={{
                padding: '0.9rem 1.5rem',
                background: exporting || generatedCards.length === 0 ? 'rgba(100, 100, 100, 0.5)' : 'linear-gradient(135deg, #d4af37 0%, #b98c28 100%)',
                border: 'none',
                borderRadius: '8px',
                color: '#ffffff',
                fontSize: '1rem',
                fontWeight: '600',
                cursor: exporting || generatedCards.length === 0 ? 'not-allowed' : 'pointer',
                boxShadow: '0 4px 15px rgba(212, 175, 55, 0.35)',
                opacity: exporting || generatedCards.length === 0 ? 0.6 : 1,
              }}
            >
              {exporting ? '⏳ Exporting...' : '⬇️ Export All Cards (Zip)'}
            </button>
            {exportStatus && (
              <div style={{ marginTop: '0.5rem', fontSize: '0.9rem', color: '#e8e8e8', opacity: 0.8 }}>
                {exportStatus}
              </div>
            )}
            {generatedCards.length === 0 && !exporting && (
              <div style={{ marginTop: '0.5rem', fontSize: '0.85rem', opacity: 0.7 }}>
                Generate a card first to enable export.
              </div>
            )}
          </section>

          {/* Controls & Help */}
          <section>
            <div
              onClick={() => setShowControls(!showControls)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                cursor: 'pointer',
                padding: '0.75rem 1rem',
                background: 'rgba(212, 175, 55, 0.1)',
                border: '1px solid rgba(212, 175, 55, 0.3)',
                borderRadius: '8px',
                marginBottom: showControls ? '1rem' : 0,
              }}
            >
              <h3 style={{ fontSize: '1.3rem', margin: 0, color: '#d4af37' }}>
                Controls & Help
              </h3>
              <span style={{ fontSize: '1.5rem', color: '#d4af37' }}>
                {showControls ? '−' : '+'}
              </span>
            </div>

            {showControls && (
              <div style={{
                padding: '1.5rem',
                background: 'rgba(0, 0, 0, 0.2)',
                borderRadius: '8px',
                marginBottom: '0.5rem',
              }}>
                <h4 style={{ fontSize: '1.1rem', marginBottom: '1rem', color: '#9333ea' }}>
                  Camera Controls
                </h4>
                <div style={{ fontSize: '0.9rem', lineHeight: '1.8', marginBottom: '1.5rem' }}>
                  <div><strong>Left-click + Drag:</strong> Rotate camera around the scene</div>
                  <div><strong>Right-click + Drag:</strong> Pan camera (move left/right/up/down)</div>
                  <div><strong>Scroll Wheel:</strong> Zoom in/out</div>
                  <div style={{ marginTop: '0.5rem', opacity: 0.7, fontSize: '0.85rem' }}>
                    Zoom range: 5 to 30 units | Vertical angle limited to prevent flipping
                  </div>
                </div>

                <h4 style={{ fontSize: '1.1rem', marginBottom: '1rem', color: '#9333ea' }}>
                  Card Interactions
                </h4>
                <div style={{ fontSize: '0.9rem', lineHeight: '1.8', marginBottom: '1.5rem' }}>
                  <div><strong>Hover:</strong> Card glows and scales up, shows name and keyword</div>
                  <div><strong>Click:</strong> Open card detail view</div>
                  <div><strong>Click + Drag:</strong> Grab and move card in 3D space</div>
                  <div><strong>Release while moving:</strong> Throw card with momentum</div>
                  <div style={{ marginTop: '0.5rem', opacity: 0.7, fontSize: '0.85rem' }}>
                    Note: Left-click controls both camera and cards - camera rotation works when not hovering over cards
                  </div>
                </div>

                <h4 style={{ fontSize: '1.1rem', marginBottom: '1rem', color: '#9333ea' }}>
                  Physics Behavior
                </h4>
                <div style={{ fontSize: '0.9rem', lineHeight: '1.8' }}>
                  <div><strong>Magnetic Repulsion:</strong> Cards push away from each other to avoid collisions</div>
                  <div><strong>Cursor Repulsion:</strong> Cards gently move away from your mouse cursor</div>
                  <div><strong>Center Attraction:</strong> Cards are pulled back toward center when they drift too far</div>
                  <div><strong>Random Drift:</strong> Each card follows unique wandering trajectories</div>
                  <div><strong>Boundary Forces:</strong> Soft walls keep cards visible within the scene</div>
                </div>
              </div>
            )}
          </section>

          {/* Test Generation */}
          <section>
            <h3 style={{ fontSize: '1.3rem', marginBottom: '1rem', color: '#d4af37' }}>
              Test Generation
            </h3>
            <p style={{ fontSize: '0.9rem', marginBottom: '1rem', opacity: 0.8 }}>
              Generate one card first to test your photo and prompt before generating all 22 cards.
            </p>
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end' }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: '0.5rem', opacity: 0.9 }}>
                  Test Card Number (0-21)
                </label>
                <input
                  type="number"
                  min="0"
                  max="21"
                  value={Number.isFinite(testCardNumber) ? testCardNumber : 0}
                  onChange={(e) => {
                    const next = e.target.value === '' ? 0 : parseInt(e.target.value, 10);
                    setTestCardNumber(Number.isFinite(next) ? next : 0);
                  }}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    background: 'rgba(0, 0, 0, 0.3)',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    borderRadius: '8px',
                    color: '#e8e8e8',
                    fontSize: '0.95rem',
                  }}
              />
            </div>
            <button
              onClick={() => generateSingleCard(testCardNumber)}
              disabled={isGenerating || !hasImageApiKey}
              style={{
                padding: '0.75rem 1.5rem',
                background: isGenerating || !hasImageApiKey ? 'rgba(100, 100, 100, 0.3)' : 'rgba(147, 51, 234, 0.3)',
                border: '1px solid rgba(147, 51, 234, 0.5)',
                borderRadius: '8px',
                color: '#e8e8e8',
                fontSize: '0.95rem',
                fontWeight: '500',
                cursor: isGenerating || !hasImageApiKey ? 'not-allowed' : 'pointer',
                whiteSpace: 'nowrap',
                opacity: isGenerating || !hasImageApiKey ? 0.5 : 1,
              }}
            >
              {isGenerating ? 'Generating...' : 'Generate 1 Card'}
            </button>
          </div>
          {!hasImageApiKey && (
            <p style={{ marginTop: '0.75rem', fontSize: '0.85rem', color: '#ffb347' }}>
              {missingApiKeyMessage}
            </p>
          )}
        </section>

          {/* Generate All */}
          <section>
            <div style={{
              padding: '1.5rem',
              background: 'rgba(147, 51, 234, 0.1)',
              border: '1px solid rgba(147, 51, 234, 0.3)',
              borderRadius: '12px',
            }}>
              <h3 style={{ fontSize: '1.2rem', marginBottom: '0.75rem' }}>
                Generate All 22 Cards
              </h3>
              <p style={{ fontSize: '0.9rem', marginBottom: '1.5rem', opacity: 0.8 }}>
              This will generate all 22 Major Arcana cards with your photo. Make sure to test one card first!
            </p>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <button
                onClick={() => generateAllCards()}
                disabled={isGenerating || !hasImageApiKey}
                style={{
                  flex: 1,
                  padding: '1rem 2rem',
                  background: isGenerating || !hasImageApiKey ? 'rgba(100, 100, 100, 0.5)' : 'linear-gradient(135deg, #9333ea 0%, #7c3aed 100%)',
                  border: 'none',
                  borderRadius: '8px',
                  color: '#ffffff',
                  fontSize: '1rem',
                  fontWeight: '600',
                  cursor: isGenerating || !hasImageApiKey ? 'not-allowed' : 'pointer',
                  boxShadow: '0 4px 15px rgba(147, 51, 234, 0.4)',
                  opacity: isGenerating || !hasImageApiKey ? 0.6 : 1,
                }}
              >
                {isGenerating ? '⏳ Generating...' : '🎴 Generate All Cards'}
              </button>
              <button
                  onClick={() => {
                    if (confirm('This will delete all generated cards. Are you sure?')) {
                      clearGeneratedCards();
                    }
                  }}
                  style={{
                    padding: '1rem 1.5rem',
                    background: 'rgba(255, 0, 0, 0.2)',
                    border: '1px solid rgba(255, 0, 0, 0.3)',
                    borderRadius: '8px',
                    color: '#e8e8e8',
                    fontSize: '0.95rem',
                    cursor: 'pointer',
                  }}
                >
                  🗑️ Clear Cache
                </button>
              </div>
              {!hasImageApiKey && (
                <p style={{ marginTop: '0.75rem', fontSize: '0.85rem', color: '#ffb347' }}>
                  {missingApiKeyMessage}
                </p>
              )}
            </div>
          </section>

          {/* Generate All Videos */}
          <section>
            <div style={{
              padding: '1.5rem',
              background: 'rgba(212, 175, 55, 0.08)',
              border: '1px solid rgba(212, 175, 55, 0.3)',
              borderRadius: '12px',
            }}>
              <h3 style={{ fontSize: '1.2rem', marginBottom: '0.75rem' }}>
                Generate Videos for Whole Deck
              </h3>
              <p style={{ fontSize: '0.9rem', marginBottom: '1.5rem', opacity: 0.8 }}>
                Uses the first generated frame of each card to create an 8s Veo video. Cards without images are skipped.
              </p>
              <div style={{ fontSize: '0.85rem', marginBottom: '1rem', opacity: 0.7 }}>
                Videos are throttled to about 2 requests per minute to avoid Gemini rate limits (daily cap is often ~10 videos).
              </div>
              <button
                onClick={() => generateAllVideos()}
                disabled={isGenerating || !settings.geminiApiKey}
                style={{
                  width: '100%',
                  padding: '1rem 2rem',
                  background: isGenerating || !settings.geminiApiKey ? 'rgba(100, 100, 100, 0.5)' : 'linear-gradient(135deg, #d4af37 0%, #b98c28 100%)',
                  border: 'none',
                  borderRadius: '8px',
                  color: '#ffffff',
                  fontSize: '1rem',
                  fontWeight: '600',
                  cursor: isGenerating || !settings.geminiApiKey ? 'not-allowed' : 'pointer',
                  boxShadow: '0 4px 15px rgba(212, 175, 55, 0.35)',
                  opacity: isGenerating || !settings.geminiApiKey ? 0.6 : 1,
                }}
              >
                {isGenerating ? '⏳ Generating videos...' : '🎥 Generate All Videos (Veo 3.1)'}
              </button>
              {!settings.geminiApiKey && (
                <div style={{ marginTop: '0.75rem', fontSize: '0.85rem', color: '#ffb347' }}>
                  Gemini API key required for video generation.
                </div>
              )}
            </div>
          </section>

          {/* Error Display */}
          {generationError && !dismissedError && (
            <div style={{
              padding: '1rem',
              background: 'rgba(255, 0, 0, 0.1)',
              border: '1px solid rgba(255, 0, 0, 0.3)',
              borderRadius: '8px',
              color: '#ff6b6b',
              position: 'relative',
            }}>
              <button
                aria-label="Dismiss error"
                onClick={() => setDismissedError(true)}
                style={{
                  position: 'absolute',
                  top: '0.5rem',
                  right: '0.5rem',
                  background: 'transparent',
                  border: 'none',
                  color: '#ff6b6b',
                  cursor: 'pointer',
                  fontSize: '1rem',
                }}
              >
                ✕
              </button>
              <div style={{ fontWeight: 700, marginBottom: '0.35rem' }}>Error</div>
              <div style={{ lineHeight: 1.5 }}>{generationError}</div>
              {isRateLimitError && (
                <div style={{ marginTop: '0.75rem', fontSize: '0.9rem', color: '#ffd1d1' }}>
                  <div style={{ marginBottom: '0.35rem' }}>
                    Gemini video quota was hit. Common limits: ~10 videos/day and 5 requests/minute (sometimes lower).
                  </div>
                  <ul style={{ margin: 0, paddingLeft: '1.2rem', lineHeight: 1.5 }}>
                    <li>We now throttle video requests to ~2 per minute to help avoid this.</li>
                    <li>Try again after some time or use a new API key with billing enabled.</li>
                    <li><a href="https://ai.dev/usage?tab=rate-limit" target="_blank" rel="noopener noreferrer" style={{ color: '#ffd1d1', textDecoration: 'underline' }}>Check current usage</a></li>
                  </ul>
                </div>
              )}
