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

const HOLD_BEFORE_FLIP = 1.4; // seconds to display inverted state before rotating
const FLIP_DURATION = 2.5; // seconds for the animated flip

export function CardFlipImageInner({ src, alt, startAngle, startTilt, targetAngle, flipTrigger, loadedMediaRef, onReady }: CardFlipImageInnerProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const lastLoadedSrcRef = useRef<string | null>(null);
  const readyTimeoutRef = useRef<number | null>(null);
  const readyCalledRef = useRef(false);
  const alreadyRevealedRef = useRef(loadedMediaRef.current.has(src));
  const renderCountRef = useRef(0);

  // Log every render
  renderCountRef.current++;
  console.log('[CardFlip] RENDER', {
    renderCount: renderCountRef.current,
    src: src.slice(-30),
    isLoaded,
    alreadyRevealedRef: alreadyRevealedRef.current,
    startAngle,
    targetAngle,
    flipTrigger,
  });

  // Reset state ONLY when src changes - NOT when flipTrigger changes!
  // flipTrigger is for re-triggering animation on the same src, but should not
  // interrupt an animation that's already in progress.
  useEffect(() => {
    const wasRevealed = alreadyRevealedRef.current;
    const isInRef = loadedMediaRef.current.has(src);
    alreadyRevealedRef.current = isInRef;
    readyCalledRef.current = false;
    
    console.log('[CardFlip] useEffect[src] fired', {
      src: src.slice(-30),
      wasRevealed,
      isInRef,
    });

    if (readyTimeoutRef.current !== null) {
      console.log('[CardFlip] clearing existing timeout');
      window.clearTimeout(readyTimeoutRef.current);
      readyTimeoutRef.current = null;
    }

    if (alreadyRevealedRef.current) {
      console.log('[CardFlip] SKIP: already revealed, showing final pose', { src: src.slice(-30) });
      setIsLoaded(true);
      if (!readyCalledRef.current) {
        readyCalledRef.current = true;
        onReady(src);
      }
      return;
    }
    console.log('[CardFlip] RESET: setting isLoaded=false, awaiting img onLoad', { src: src.slice(-30) });
    setIsLoaded(false);
  }, [src, onReady]); // Removed flipTrigger - it was causing animation interruption!

  useEffect(() => {
    console.log('[CardFlip] MOUNT', { src: src.slice(-30), flipTrigger });
    return () => {
      console.log('[CardFlip] UNMOUNT', { src: src.slice(-30), flipTrigger });
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
  
  // Check if this is a real flip (inverted → upright) or just a minor adjustment
  const needsFlipAnimation = Math.abs(startAngle - targetAngle) > 90;

  // Determine animation state for logging
  const animationBranch = alreadyRevealedRef.current
    ? 'STATIC_FINAL'
    : isLoaded
      ? needsFlipAnimation ? 'ANIMATING_FLIP' : 'ANIMATING_FADE'
      : 'WAITING_FOR_LOAD';
  
  console.log('[CardFlip] ANIMATION_DECISION', {
    branch: animationBranch,
    alreadyRevealedRef: alreadyRevealedRef.current,
    isLoaded,
    needsFlipAnimation,
    startAngle,
    midAngle,
    targetAngle,
  });

  return (
    <motion.div
      initial={{ rotate: startAngle, rotateX: startTilt, scale: 0.94, opacity: 0.5 }}
      animate={
        alreadyRevealedRef.current
          ? { rotate: targetAngle, rotateX: 0, scale: 1, opacity: 1 }
          : isLoaded
            ? needsFlipAnimation
              ? {
                  // Inverted card: full flip animation with keyframes
                  rotate: [startAngle, midAngle, targetAngle],
                  rotateX: [startTilt, startTilt / 2, 0],
                  scale: [0.94, 1.07, 1],
                  opacity: [0.5, 0.85, 1],
                }
              : {
                  // Upright card: simple fade-in, no flip
                  rotate: targetAngle,
                  rotateX: 0,
                  scale: 1,
                  opacity: 1,
                }
            : { rotate: startAngle, rotateX: startTilt, scale: 0.94, opacity: 0.5 }
      }
      transition={
        alreadyRevealedRef.current
          ? { duration: 0 }
          : isLoaded
            ? needsFlipAnimation
              ? { delay: HOLD_BEFORE_FLIP, duration: FLIP_DURATION, ease: [0.16, 1, 0.3, 1], times: [0, 0.55, 1] }
              : { duration: 0 } // Upright cards: instant pop (no gating, no motion)
            : { duration: 0 }
      }
      style={{ width: '100%', height: '100%' }}
    >
      <img
        src={src}
        alt={alt}
        onLoad={() => {
          console.log('[CardFlip] IMG_ONLOAD fired', {
            src: src.slice(-30),
            lastLoadedSrc: lastLoadedSrcRef.current?.slice(-30),
            alreadyRevealedRef: alreadyRevealedRef.current,
            startAngle,
            targetAngle,
          });

          if (lastLoadedSrcRef.current === src) {
            console.log('[CardFlip] IMG_ONLOAD IGNORED: same src already processed');
            return;
          }
          if (alreadyRevealedRef.current) {
            console.log('[CardFlip] IMG_ONLOAD IGNORED: alreadyRevealedRef is true');
            return;
          }

          lastLoadedSrcRef.current = src;
          
          // Check if this is a real flip (inverted → upright) or just a minor adjustment
          const needsFlipAnimation = Math.abs(startAngle - targetAngle) > 90;
          
          if (!needsFlipAnimation) {
            // Upright card - show immediately, no flip animation or gating
            console.log('[CardFlip] IMG_ONLOAD FAST PATH: upright card, instant reveal', {
              src: src.slice(-30),
              startAngle,
              targetAngle,
            });
            setIsLoaded(true);
            if (!readyCalledRef.current) {
              readyCalledRef.current = true;
              loadedMediaRef.current.add(src);
              alreadyRevealedRef.current = true;
              console.log('[CardFlip] READY (fast path): instant', { src: src.slice(-30) });
              onReady(src);
            }
            return;
          }
          
          // Inverted card - use full flip animation
          console.log('[CardFlip] IMG_ONLOAD SLOW PATH: inverted card, starting flip animation', {
            src: src.slice(-30),
            holdSeconds: HOLD_BEFORE_FLIP,
            flipSeconds: FLIP_DURATION,
            totalSeconds: HOLD_BEFORE_FLIP + FLIP_DURATION,
          });
          setIsLoaded(true);

          if (readyTimeoutRef.current !== null) {
            console.log('[CardFlip] clearing old ready timeout');
            window.clearTimeout(readyTimeoutRef.current);
          }

          const timeoutMs = (HOLD_BEFORE_FLIP + FLIP_DURATION) * 1000;
          console.log('[CardFlip] setting ready timeout', { timeoutMs });
          readyTimeoutRef.current = window.setTimeout(() => {
            console.log('[CardFlip] TIMEOUT fired', {
              src: src.slice(-30),
              readyCalledRef: readyCalledRef.current,
            });
            if (!readyCalledRef.current) {
              readyCalledRef.current = true;
              loadedMediaRef.current.add(src);
              alreadyRevealedRef.current = true;
              console.log('[CardFlip] READY: animation complete, added to loadedMediaRef', { src: src.slice(-30) });
              onReady(src);
            } else {
              console.log('[CardFlip] TIMEOUT skipped: readyCalledRef already true');
            }
          }, timeoutMs);
        }}
        onClick={() => console.log('[CardFlip] image clicked', { src: src.slice(-30) })}
        style={{ width: '100%', height: '100%', objectFit: 'cover', backfaceVisibility: 'hidden' }}
        loading="eager"
      />
    </motion.div>
  );
}
