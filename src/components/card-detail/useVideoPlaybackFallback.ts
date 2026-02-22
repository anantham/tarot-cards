import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import { useEffect } from 'react';
import { debugLog } from '../../utils/logger';

type UseVideoPlaybackFallbackArgs = {
  videoRef: MutableRefObject<HTMLVideoElement | null>;
  videoUrl?: string;
  videoSrc?: string;
  videoObjectUrl?: string;
  setVideoObjectUrl: Dispatch<SetStateAction<string | undefined>>;
  setVideoSrc: Dispatch<SetStateAction<string | undefined>>;
  apiProvider: 'openrouter' | 'gemini';
  geminiApiKey?: string;
};

export function useVideoPlaybackFallback({
  videoRef,
  videoUrl,
  videoSrc,
  videoObjectUrl,
  setVideoObjectUrl,
  setVideoSrc,
  apiProvider,
  geminiApiKey,
}: UseVideoPlaybackFallbackArgs) {
  useEffect(() => {
    const videoEl = videoRef.current;
    if (!videoEl) return;

    const onError = () => {
      const err = videoEl.error;
      console.error('[Video] playback error', {
        code: err?.code,
        message: err?.message,
        videoUrl: videoSrc,
      });

      if (apiProvider === 'gemini' && geminiApiKey && videoSrc && videoSrc.startsWith('https://')) {
        fetch(videoSrc, {
          headers: {
            'x-goog-api-key': geminiApiKey,
          },
        })
          .then(async (resp) => {
            if (!resp.ok) throw new Error(`Fetch failed: ${resp.status}`);
            const blob = await resp.blob();
            if (videoObjectUrl) {
              URL.revokeObjectURL(videoObjectUrl);
            }
            const url = URL.createObjectURL(blob);
            setVideoObjectUrl(url);
            setVideoSrc(url);
          })
          .catch((fetchErr) => {
            console.error('[Video] fallback fetch error', fetchErr);
          });
      }
    };

    const onLoaded = () => {
      debugLog('[Video] loaded metadata', {
        duration: videoEl.duration,
        readyState: videoEl.readyState,
        videoUrl: videoSrc,
      });
    };

    videoEl.addEventListener('error', onError);
    videoEl.addEventListener('loadedmetadata', onLoaded);
    return () => {
      videoEl.removeEventListener('error', onError);
      videoEl.removeEventListener('loadedmetadata', onLoaded);
    };
  }, [videoRef, videoUrl, videoSrc, videoObjectUrl, setVideoObjectUrl, setVideoSrc, apiProvider, geminiApiKey]);
}
