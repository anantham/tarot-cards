import GIF from 'gif.js';

/**
 * Generate animated GIF from multiple image frames using gif.js
 */
export async function generateGIF(
  imageUrls: string[],
  fps: number = 2,
  quality: number = 10,
  width?: number,
  height?: number
): Promise<string> {
  try {
    console.log(`Starting GIF generation with ${imageUrls.length} frames at ${fps} fps`);

    // Load all images first
    const images = await Promise.all(
      imageUrls.map((url) => loadImage(url))
    );

    // Determine dimensions
    const gifWidth = width || images[0].width;
    const gifHeight = height || images[0].height;

    // Calculate delay between frames in milliseconds
    const delay = Math.floor(1000 / fps);

    console.log(`GIF dimensions: ${gifWidth}x${gifHeight}, delay: ${delay}ms`);

    // Create GIF encoder
    const gif = new GIF({
      workers: 2,
      quality: quality, // 1-30, lower is better quality but slower
      width: gifWidth,
      height: gifHeight,
      workerScript: '/gif.worker.js', // We'll need to copy this to public
    });

    // Add each frame to the GIF
    for (let i = 0; i < images.length; i++) {
      // Create a canvas for this frame
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        throw new Error('Could not get canvas context');
      }

      canvas.width = gifWidth;
      canvas.height = gifHeight;

      // Draw image to canvas (resize if needed)
      ctx.drawImage(images[i], 0, 0, gifWidth, gifHeight);

      // Add frame to GIF
      gif.addFrame(canvas, { delay, copy: true });
      console.log(`Added frame ${i + 1}/${images.length}`);
    }

    // Render the GIF
    console.log('Rendering GIF...');

    return new Promise((resolve, reject) => {
      gif.on('finished', (blob: Blob) => {
        console.log('GIF rendering complete!', blob.size, 'bytes');

        // Convert blob to data URL
        const reader = new FileReader();
        reader.onloadend = () => {
          const dataUrl = reader.result as string;
          resolve(dataUrl);
        };
        reader.onerror = () => {
          reject(new Error('Failed to convert GIF blob to data URL'));
        };
        reader.readAsDataURL(blob);
      });

      gif.on('progress', (progress: number) => {
        console.log(`GIF encoding progress: ${Math.round(progress * 100)}%`);
      });

      gif.on('error', (error: Error) => {
        console.error('GIF encoding error:', error);
        reject(error);
      });

      gif.render();
    });
  } catch (error) {
    console.error('GIF generation error:', error);
    throw error;
  }
}

/**
 * Generate GIF without worker (slower but no external dependencies)
 * Fallback for when worker script is not available
 */
export async function generateGIFNoWorker(
  imageUrls: string[],
  fps: number = 2,
  quality: number = 10
): Promise<string> {
  try {
    console.log('Using no-worker GIF generation fallback');

    const images = await Promise.all(
      imageUrls.map((url) => loadImage(url))
    );

    const gifWidth = images[0].width;
    const gifHeight = images[0].height;
    const delay = Math.floor(1000 / fps);

    const gif = new GIF({
      workers: 1,
      quality: quality,
      width: gifWidth,
      height: gifHeight,
      // Use inline worker (slower but no external file needed)
      // @ts-ignore - gif.js types might not include this
      workerScript: undefined,
    });

    for (let i = 0; i < images.length; i++) {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        throw new Error('Could not get canvas context');
      }

      canvas.width = gifWidth;
      canvas.height = gifHeight;
      ctx.drawImage(images[i], 0, 0, gifWidth, gifHeight);

      gif.addFrame(canvas, { delay, copy: true });
    }

    return new Promise((resolve, reject) => {
      gif.on('finished', (blob: Blob) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error('Failed to convert blob'));
        reader.readAsDataURL(blob);
      });

      gif.on('error', reject);
      gif.render();
    });
  } catch (error) {
    console.error('No-worker GIF generation error:', error);
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
 * Alternative to GIF for in-browser animation
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

/**
 * Smart GIF generation with automatic fallback
 */
export async function generateGIFSmart(
  imageUrls: string[],
  fps: number = 2,
  quality: number = 10
): Promise<string> {
  // If only one frame, just return the image
  if (imageUrls.length === 1) {
    console.log('Only one frame, returning static image');
    return imageUrls[0];
  }

  try {
    // Try with worker first
    return await generateGIF(imageUrls, fps, quality);
  } catch (error) {
    console.warn('Worker-based GIF generation failed, trying no-worker fallback:', error);

    try {
      // Fallback to no-worker version
      return await generateGIFNoWorker(imageUrls, fps, quality);
    } catch (fallbackError) {
      console.error('Both GIF generation methods failed:', fallbackError);
      // Final fallback: return first frame as static image
      console.warn('Falling back to static first frame');
      return imageUrls[0];
    }
  }
}
