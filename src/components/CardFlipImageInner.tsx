import { useEffect, useRef, useState, type MutableRefObject } from 'react';
import { motion } from 'framer-motion';

interface CardFlipImageInnerProps {
  src: string;
  alt: string;
  startAngle: number;
  startTilt: number;
  targetAngle: number;
  flipTrigger: number;
  loadedMediaRef: MutableRefObject<Set<string>>;
  onReady: (src: string) => void;
}

const HOLD_BEFORE_FLIP = 2; // seconds to display inverted state before rotating
const FLIP_DURATION = 3.5; // seconds for the animated flip

export function CardFlipImageInner({ src, alt, startAngle, startTilt, targetAngle, flipTrigger, loadedMediaRef, onReady }: CardFlipImageInnerProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const lastLoadedSrcRef = useRef<string | null>(null);
  const readyTimeoutRef = useRef<number | null>(null);
  const readyCalledRef = useRef(false);

  useEffect(() => {
    setIsLoaded(false);
    console.log('[CardDetail] image src changed, awaiting load', { src, flipTrigger });
  }, [src]);

  useEffect(() => {
    console.log('[CardDetail] image mount', { src, flipTrigger });
    if (loadedMediaRef.current.has(src)) {
      console.log('[CardDetail] image already marked loaded for src; skipping hold/flip', { src });
      setIsLoaded(true);
      if (!readyCalledRef.current) {
        readyCalledRef.current = true;
        onReady(src);
      }
    }
    return () => {
      console.log('[CardDetail] image unmount', { src, flipTrigger });
       if (readyTimeoutRef.current !== null) {
         window.clearTimeout(readyTimeoutRef.current);
         readyTimeoutRef.current = null;
       }
      readyCalledRef.current = false;
    };
    // flipTrigger intentionally omitted to log once per src mount/unmount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);

  const midAngle = targetAngle === 180 ? targetAngle + 30 : targetAngle / 2;

  return (
    <motion.div
      initial={{ rotate: startAngle, rotateX: startTilt, scale: 0.94, opacity: 0.5 }}
      animate={
        isLoaded
          ? {
              rotate: [startAngle, midAngle, targetAngle],
              rotateX: [startTilt, startTilt / 2, 0],
              scale: [0.94, 1.07, 1],
              opacity: [0.5, 0.85, 1],
            }
          : { rotate: startAngle, rotateX: startTilt, scale: 0.94, opacity: 0.5 }
      }
      transition={
        isLoaded
          ? { delay: HOLD_BEFORE_FLIP, duration: FLIP_DURATION, ease: [0.16, 1, 0.3, 1], times: [0, 0.55, 1] }
          : { duration: 0 }
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
          if (readyTimeoutRef.current !== null) {
            window.clearTimeout(readyTimeoutRef.current);
          }
          readyTimeoutRef.current = window.setTimeout(() => {
            if (!readyCalledRef.current) {
              readyCalledRef.current = true;
              console.log('[CardDetail] card ready after hold+flip', { src });
              onReady(src);
            }
          }, (HOLD_BEFORE_FLIP + FLIP_DURATION) * 1000);
        }}
        onClick={() => console.log('[CardDetail] image clicked', { src })}
        style={{ width: '100%', height: '100%', objectFit: 'cover', backfaceVisibility: 'hidden' }}
        loading="eager"
      />
    </motion.div>
  );
}
