import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';

interface CardFlipImageInnerProps {
  src: string;
  alt: string;
  startAngle: number;
  startTilt: number;
  flipTrigger: number;
  loadedMediaRef: React.MutableRefObject<Set<string>>;
}

const HOLD_BEFORE_FLIP = 4; // seconds to display inverted state before rotating

export function CardFlipImageInner({ src, alt, startAngle, startTilt, flipTrigger, loadedMediaRef }: CardFlipImageInnerProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const lastLoadedSrcRef = useRef<string | null>(null);

  useEffect(() => {
    setIsLoaded(false);
    console.log('[CardDetail] image src changed, awaiting load', { src, flipTrigger });
  }, [src]);

  useEffect(() => {
    console.log('[CardDetail] image mount', { src, flipTrigger });
    if (loadedMediaRef.current.has(src)) {
      console.log('[CardDetail] image already marked loaded for src; skipping hold/flip', { src });
      setIsLoaded(true);
    }
    return () => {
      console.log('[CardDetail] image unmount', { src, flipTrigger });
    };
    // flipTrigger intentionally omitted to log once per src mount/unmount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);

  return (
    <motion.div
      initial={{ rotate: startAngle, rotateX: startTilt, scale: 0.94, opacity: 0.5 }}
      animate={
        isLoaded
          ? {
              rotate: [startAngle, startAngle / 3, 0],
              rotateX: [startTilt, startTilt / 2, 0],
              scale: [0.94, 1.07, 1],
              opacity: [0.5, 0.85, 1],
            }
          : { rotate: startAngle, rotateX: startTilt, scale: 0.94, opacity: 0.5 }
      }
      transition={
        isLoaded
          ? { duration: 3.2, ease: [0.16, 1, 0.3, 1], times: [0, 0.55, 1] }
          : { delay: HOLD_BEFORE_FLIP, duration: 3.2, ease: [0.16, 1, 0.3, 1], times: [0, 0.55, 1] }
      }
      style={{ width: '100%', height: '100%' }}
    >
      <img
        src={src}
        alt={alt}
        onLoad={() => {
          if (lastLoadedSrcRef.current === src || loadedMediaRef.current.has(src)) {
            console.log('[CardDetail] image load ignored (same src already loaded)', { src });
            return;
          }
          lastLoadedSrcRef.current = src;
          loadedMediaRef.current.add(src);
          console.log('[CardDetail] image loaded, holding inverted before flip', { src, holdSeconds: HOLD_BEFORE_FLIP });
          setIsLoaded(true);
        }}
        onClick={() => console.log('[CardDetail] image clicked', { src })}
        style={{ width: '100%', height: '100%', objectFit: 'cover', backfaceVisibility: 'hidden' }}
        loading="eager"
      />
    </motion.div>
  );
}
