import { useEffect, useMemo, useState } from 'react';
import { useStore } from '../store/useStore';
import { useCardGeneration } from '../hooks/useCardGeneration';
import { useGallerySharing } from '../hooks/useGallerySharing';
import { getUnsharedCards } from '../utils/idb';
import { exportGeneratedCardsZip } from '../utils/exportGeneratedCardsZip';
import tarotData from '../data/tarot-decks.json';
import type { TarotDeckData } from '../types';
import { SettingsModalShell } from './settings/SettingsModalShell';
import { PhotoSettingsSection } from './settings/PhotoSettingsSection';
import { ReferenceImagesSection } from './settings/ReferenceImagesSection';
import { DeckTypeSection } from './settings/DeckTypeSection';
import { GenerationSettingsSection } from './settings/GenerationSettingsSection';
import { CommunitySharingSection } from './settings/CommunitySharingSection';
import { GeneratedCardsGallerySection } from './settings/GeneratedCardsGallerySection';
import { CommunityGalleryBrowserSection } from './settings/CommunityGalleryBrowserSection';
import { ExportBackupSection } from './settings/ExportBackupSection';
import { ControlsHelpSection } from './settings/ControlsHelpSection';
import { TestGenerationSection } from './settings/TestGenerationSection';
import { BulkGenerationSection } from './settings/BulkGenerationSection';
import { GenerationErrorBanner } from './settings/GenerationErrorBanner';
import { useSettingsImages } from './settings/useSettingsImages';

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
  const [showControls, setShowControls] = useState(false);
  const [showGallery, setShowGallery] = useState(false);
  const [galleryDeckFilter, setGalleryDeckFilter] = useState<string>('all');
  const [dismissedError, setDismissedError] = useState(false);
  const [showCommunityGallery, setShowCommunityGallery] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportStatus, setExportStatus] = useState<string>('');
  const [deckName, setDeckName] = useState(settings.deckName || settings.selectedDeckType || '');
  const [deckDescription, setDeckDescription] = useState(settings.deckDescription || '');

  const selectedDeck = settings.selectedDeckType;
  const communityDecks = useMemo(() => {
    const baseIds = new Set(deckData.deckTypes.map((d) => d.id));
    const map = new Map<string, { id: string; name: string; description: string }>();
    generatedCards
      .filter((c) => c.source === 'community' && c.deckType)
      .forEach((c) => {
        if (baseIds.has(c.deckType)) return;
        if (!map.has(c.deckType)) {
          map.set(c.deckType, {
            id: c.deckType,
            name: c.deckName || `Community: ${c.deckType}`,
            description: c.deckDescription || 'Imported from Community Gallery',
          });
        }
      });
    return Array.from(map.values());
  }, [generatedCards]);

  const combinedDecks = useMemo(
    () => [...deckData.deckTypes, ...communityDecks],
    [communityDecks]
  );

  useEffect(() => {
    const name = settings.deckNameMap?.[selectedDeck] ?? settings.deckName ?? selectedDeck ?? '';
    const desc = settings.deckDescriptionMap?.[selectedDeck] ?? settings.deckDescription ?? '';
    setDeckName(name);
    setDeckDescription(desc);
  }, [selectedDeck, settings.deckNameMap, settings.deckDescriptionMap, settings.deckName, settings.deckDescription]);

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
  const {
    photoPreview,
    referenceImages,
    handlePhotoUpload,
    handlePhotoRemove,
    handleReferenceImageUpload,
    updateReferenceImage,
    removeReferenceImage,
    getInstructionForType,
  } = useSettingsImages({
    userPhoto: settings.userPhoto,
    referenceImages: settings.referenceImages,
    usePhotoSetting: settings.usePhoto,
    updateSettings,
  });

  useEffect(() => {
    setDismissedError(false);
  }, [generationError]);

  useEffect(() => {
    getUnsharedCards().then((cards) => setUnsharedCount(cards.length));
  }, [generatedCards]);

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
    if (settings.autoShareEnabled && unsharedCount > 0 && !isUploading) {
      const success = await uploadSession(settings.displayName);
      if (success) {
        updateSettings({ lastSharedTimestamp: Date.now() });
      }
    }
    setShowSettings(false);
  };

  const handleExportAll = async () => {
    try {
      if (generatedCards.length === 0) {
        alert('No generated cards to export.');
        return;
      }
      setExporting(true);
      setExportStatus('Preparing zip export...');
      await exportGeneratedCardsZip(generatedCards, setExportStatus);
      setExportStatus('Export complete. Zip downloaded.');
    } catch (err) {
      console.error('Export error:', err);
      alert(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setExporting(false);
    }
  };

  const handleOpenCardFromGallery = (cardNumber: number) => {
    const tarotCard = deckData.cards[cardNumber];
    if (!tarotCard) return;
    setSelectedCard(tarotCard);
    setReturnToSettingsOnClose(true);
    void handleSettingsClose();
  };

  return (
    <SettingsModalShell onClose={handleSettingsClose}>
      <PhotoSettingsSection
        photoPreview={photoPreview}
        usePhoto={usePhoto}
        onPhotoUpload={handlePhotoUpload}
        onPhotoRemove={handlePhotoRemove}
        onUsePhotoChange={(enabled) => updateSettings({ usePhoto: enabled })}
      />

      {settings.apiProvider === 'gemini' && (
        <ReferenceImagesSection
          referenceImages={referenceImages}
          referencesEnabled={settings.usePhoto !== false}
          onUpload={handleReferenceImageUpload}
          onRemove={removeReferenceImage}
          onUpdate={updateReferenceImage}
          getInstructionForType={getInstructionForType}
        />
      )}

      <DeckTypeSection
        combinedDecks={combinedDecks}
        selectedDeckType={settings.selectedDeckType}
        onSelectDeck={(deckId) => updateSettings({ selectedDeckType: deckId })}
      />

      <GenerationSettingsSection
        settings={settings}
        showCardInfo={showCardInfo}
        navWithArrows={navWithArrows}
        updateSettings={updateSettings}
      />

      <CommunitySharingSection
        settings={settings}
        selectedDeck={selectedDeck}
        deckName={deckName}
        deckDescription={deckDescription}
        isUploading={isUploading}
        uploadProgress={uploadProgress}
        unsharedCount={unsharedCount}
        generatedCards={generatedCards}
        updateSettings={updateSettings}
        onDeckNameChange={setDeckName}
        onDeckDescriptionChange={setDeckDescription}
      />

      <GeneratedCardsGallerySection
        showGallery={showGallery}
        galleryDeckFilter={galleryDeckFilter}
        generatedCards={generatedCards}
        selectedDeckType={settings.selectedDeckType}
        deckTypes={deckData.deckTypes}
        cards={deckData.cards}
        onToggleGallery={() => setShowGallery(!showGallery)}
        onGalleryDeckFilterChange={setGalleryDeckFilter}
        onOpenCard={handleOpenCardFromGallery}
      />

      <CommunityGalleryBrowserSection
        showCommunityGallery={showCommunityGallery}
        onToggle={() => setShowCommunityGallery(!showCommunityGallery)}
      />

      <ExportBackupSection
        exporting={exporting}
        exportStatus={exportStatus}
        generatedCardsCount={generatedCards.length}
        onExportAll={handleExportAll}
      />

      <ControlsHelpSection
        showControls={showControls}
        onToggle={() => setShowControls(!showControls)}
      />

      <TestGenerationSection
        testCardNumber={testCardNumber}
        isGenerating={isGenerating}
        hasImageApiKey={hasImageApiKey}
        missingApiKeyMessage={missingApiKeyMessage}
        onTestCardNumberChange={setTestCardNumber}
        onGenerateSingleCard={() => void generateSingleCard(testCardNumber)}
      />

      <BulkGenerationSection
        isGenerating={isGenerating}
        hasImageApiKey={hasImageApiKey}
        hasGeminiApiKey={Boolean(settings.geminiApiKey)}
        missingApiKeyMessage={missingApiKeyMessage}
        onGenerateAllCards={() => void generateAllCards()}
        onClearCache={() => {
          if (window.confirm('This will delete all generated cards. Are you sure?')) {
            clearGeneratedCards();
          }
        }}
        onGenerateAllVideos={() => void generateAllVideos()}
      />

      <GenerationErrorBanner
        generationError={generationError}
        dismissedError={dismissedError}
        isRateLimitError={isRateLimitError}
        onDismiss={() => setDismissedError(true)}
      />
    </SettingsModalShell>
  );
}
