/**
 * Generate animated GIF from multiple image frames
 * This is a simplified version - in production, you'd use a library like gif.js
 */

export async function generateGIF(imageUrls: string[], fps: number = 2): Promise<string> {
  try {
    // Load all images first
    const images = await Promise.all(
      imageUrls.map((url) => loadImage(url))
    );

    // Create canvas
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      throw new Error('Could not get canvas context');
    }

    // Set canvas size to match first image
    canvas.width = images[0].width;
    canvas.height = images[0].height;

    // For now, we'll return a data URL of the first frame
    // In a real implementation, you'd use gif.js or similar library
    // to encode multiple frames into an actual GIF

    // Simple placeholder: just draw first frame
    ctx.drawImage(images[0], 0, 0);
    const dataUrl = canvas.toDataURL('image/png');

    // TODO: Implement actual GIF encoding using gif.js
    // This would involve:
    // 1. Creating a GIF encoder instance
    // 2. Adding each frame with delay
    // 3. Rendering the final GIF
    // 4. Converting to data URL or blob

    console.warn('GIF generation not fully implemented yet. Returning first frame as static image.');

    return dataUrl;
  } catch (error) {
    console.error('GIF generation error:', error);
    throw error;
  }
}

/**
 * Load image from URL
 */
function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${url}`));
    img.src = url;
  });
}

/**
 * Create animated canvas (CSS animation approach)
 * This creates a canvas that cycles through frames
 */
export async function createAnimatedCanvas(
  imageUrls: string[],
  width: number,
  height: number,
  fps: number = 2
): Promise<HTMLCanvasElement> {
  const images = await Promise.all(
    imageUrls.map((url) => loadImage(url))
  );

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('Could not get canvas context');
  }

  canvas.width = width;
  canvas.height = height;

  let currentFrame = 0;
  const frameDelay = 1000 / fps;

  // Animation loop
  const animate = () => {
    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(images[currentFrame], 0, 0, width, height);
    currentFrame = (currentFrame + 1) % images.length;
  };

  // Start animation
  setInterval(animate, frameDelay);

  // Draw first frame immediately
  animate();

  return canvas;
}
