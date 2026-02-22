import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { CardFlipImageInner } from '../components/CardFlipImageInner';
import React from 'react';

// Mock framer-motion to avoid animation complexity in tests
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, animate, transition, ...props }: any) => {
      // Expose animation state for testing via data attributes
      const animationBranch = 
        props['data-testid'] === 'flip-container' 
          ? JSON.stringify({ animate, transition })
          : undefined;
      return (
        <div {...props} data-animation-state={animationBranch}>
          {children}
        </div>
      );
    },
  },
}));

describe('CardFlipImageInner', () => {
  let loadedMediaRef: React.MutableRefObject<Set<string>>;
  let onReadyMock: (src: string) => void;

  beforeEach(() => {
    vi.useFakeTimers();
    loadedMediaRef = { current: new Set() };
    onReadyMock = vi.fn();
    // Suppress console.log during tests
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  const defaultProps = {
    src: 'test-image.jpg',
    alt: 'Test Card',
    startAngle: 180,
    startTilt: -14,
    targetAngle: 0,
    flipTrigger: 1,
  };

  it('should start in WAITING_FOR_LOAD state', () => {
    render(
      <CardFlipImageInner
        {...defaultProps}
        loadedMediaRef={loadedMediaRef}
        onReady={onReadyMock}
      />
    );

    // Image should be rendered
    const img = screen.getByRole('img');
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src', 'test-image.jpg');
    
    // onReady should not have been called yet
    expect(onReadyMock).not.toHaveBeenCalled();
  });

  it('should transition to ANIMATING state after image loads', async () => {
    render(
      <CardFlipImageInner
        {...defaultProps}
        loadedMediaRef={loadedMediaRef}
        onReady={onReadyMock}
      />
    );

    const img = screen.getByRole('img');
    
    // Simulate image load
    act(() => {
      img.dispatchEvent(new Event('load'));
    });

    // src should be added to loadedMediaRef after animation completes
    // Animation is HOLD_BEFORE_FLIP (1.4s) + FLIP_DURATION (2.5s) = 3.9s
    expect(loadedMediaRef.current.has('test-image.jpg')).toBe(false);
    
    // Fast-forward past animation
    await act(async () => {
      vi.advanceTimersByTime(4000); // 4 seconds
    });

    // Now onReady should have been called
    expect(onReadyMock).toHaveBeenCalledWith('test-image.jpg');
    expect(loadedMediaRef.current.has('test-image.jpg')).toBe(true);
  });

  it('should skip animation for already-revealed images', () => {
    // Pre-populate the loadedMediaRef
    loadedMediaRef.current.add('test-image.jpg');

    render(
      <CardFlipImageInner
        {...defaultProps}
        loadedMediaRef={loadedMediaRef}
        onReady={onReadyMock}
      />
    );

    // onReady should be called immediately (or very quickly)
    expect(onReadyMock).toHaveBeenCalledWith('test-image.jpg');
  });

  it('should not call onReady multiple times for same image', async () => {
    render(
      <CardFlipImageInner
        {...defaultProps}
        loadedMediaRef={loadedMediaRef}
        onReady={onReadyMock}
      />
    );

    const img = screen.getByRole('img');
    
    // Simulate multiple load events (browser quirk)
    act(() => {
      img.dispatchEvent(new Event('load'));
      img.dispatchEvent(new Event('load'));
      img.dispatchEvent(new Event('load'));
    });

    // Fast-forward past animation
    await act(async () => {
      vi.advanceTimersByTime(4000);
    });

    // onReady should only be called once
    expect(onReadyMock).toHaveBeenCalledTimes(1);
  });

  it('should reset state when src changes', async () => {
    const { rerender } = render(
      <CardFlipImageInner
        {...defaultProps}
        loadedMediaRef={loadedMediaRef}
        onReady={onReadyMock}
      />
    );

    const img = screen.getByRole('img');
    
    // Load first image
    act(() => {
      img.dispatchEvent(new Event('load'));
    });
    
    await act(async () => {
      vi.advanceTimersByTime(4000);
    });

    expect(onReadyMock).toHaveBeenCalledTimes(1);
    expect(loadedMediaRef.current.has('test-image.jpg')).toBe(true);

    // Change src
    rerender(
      <CardFlipImageInner
        {...defaultProps}
        src="new-image.jpg"
        flipTrigger={2}
        loadedMediaRef={loadedMediaRef}
        onReady={onReadyMock}
      />
    );

    // New image should not be in loadedMediaRef yet
    expect(loadedMediaRef.current.has('new-image.jpg')).toBe(false);

    // Simulate load for new image
    const newImg = screen.getByRole('img');
    act(() => {
      newImg.dispatchEvent(new Event('load'));
    });

    await act(async () => {
      vi.advanceTimersByTime(4000);
    });

    // Both images should now be ready
    expect(onReadyMock).toHaveBeenCalledTimes(2);
    expect(loadedMediaRef.current.has('new-image.jpg')).toBe(true);
  });

  it('should show static final pose for pre-revealed image on mount', () => {
    // This tests the bug we fixed: toggling between preview/detail
    // should show the card at final position, not re-animate
    
    loadedMediaRef.current.add('already-seen.jpg');

    render(
      <CardFlipImageInner
        {...defaultProps}
        src="already-seen.jpg"
        loadedMediaRef={loadedMediaRef}
        onReady={onReadyMock}
      />
    );

    // onReady called immediately
    expect(onReadyMock).toHaveBeenCalledWith('already-seen.jpg');
    
    // No timeout should be set (animation skipped)
    // Fast-forward and verify no additional calls
    act(() => {
      vi.advanceTimersByTime(10000);
    });

    expect(onReadyMock).toHaveBeenCalledTimes(1);
  });

  describe('timing constants', () => {
    it('should complete flip animation in ~3.9 seconds for inverted cards (1.4s hold + 2.5s flip)', async () => {
      render(
        <CardFlipImageInner
          {...defaultProps}
          startAngle={180} // Inverted card
          targetAngle={0}
          loadedMediaRef={loadedMediaRef}
          onReady={onReadyMock}
        />
      );

      const img = screen.getByRole('img');
      act(() => {
        img.dispatchEvent(new Event('load'));
      });

      // At 3.8s, should not be ready yet
      await act(async () => {
        vi.advanceTimersByTime(3800);
      });
      expect(onReadyMock).not.toHaveBeenCalled();

      // At 4.0s, should be ready
      await act(async () => {
        vi.advanceTimersByTime(200);
      });
      expect(onReadyMock).toHaveBeenCalled();
    });

    it('should reveal upright cards instantly (no flip, no gating)', () => {
      render(
        <CardFlipImageInner
          {...defaultProps}
          startAngle={-10} // Upright card (small initial tilt)
          targetAngle={0}
          loadedMediaRef={loadedMediaRef}
          onReady={onReadyMock}
        />
      );

      const img = screen.getByRole('img');
      act(() => {
        img.dispatchEvent(new Event('load'));
      });

      // Ready should be immediate on load
      expect(onReadyMock).toHaveBeenCalled();
    });
  });
});
