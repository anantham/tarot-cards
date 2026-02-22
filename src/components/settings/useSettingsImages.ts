import { useEffect, useState } from 'react';
import type { ReferenceImage, Settings } from '../../types';

type UseSettingsImagesArgs = {
  userPhoto: string;
  referenceImages: ReferenceImage[] | undefined;
  usePhotoSetting: boolean | undefined;
  updateSettings: (patch: Partial<Settings>) => void;
};

export function useSettingsImages({
  userPhoto,
  referenceImages: initialReferenceImages,
  usePhotoSetting,
  updateSettings,
}: UseSettingsImagesArgs) {
  const [photoPreview, setPhotoPreview] = useState(userPhoto);
  const [referenceImages, setReferenceImages] = useState<ReferenceImage[]>(initialReferenceImages || []);

  useEffect(() => {
    setPhotoPreview(userPhoto);
  }, [userPhoto]);

  useEffect(() => {
    setReferenceImages(initialReferenceImages || []);
  }, [initialReferenceImages]);

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      setPhotoPreview(result);
      updateSettings({ userPhoto: result, usePhoto: usePhotoSetting ?? true });
    };
    reader.readAsDataURL(file);
  };

  const handlePhotoRemove = () => {
    setPhotoPreview('');
    updateSettings({ userPhoto: '', usePhoto: false });
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

  const handleReferenceImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const newImage: ReferenceImage = {
          id: `img-${Date.now()}-${Math.random()}`,
          dataUrl: reader.result as string,
          instruction: 'Use facial features from this photo',
          type: 'face',
        };
        const updated = [...referenceImages, newImage];
        setReferenceImages(updated);
        updateSettings({ referenceImages: updated });
      };
      reader.readAsDataURL(file);
    });
  };

  const updateReferenceImage = (id: string, updates: Partial<ReferenceImage>) => {
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

  return {
    photoPreview,
    referenceImages,
    handlePhotoUpload,
    handlePhotoRemove,
    handleReferenceImageUpload,
    updateReferenceImage,
    removeReferenceImage,
    getInstructionForType,
  };
}
