declare module 'gif.js' {
  export interface GIFOptions {
    workers?: number;
    quality?: number;
    width?: number;
    height?: number;
    workerScript?: string;
    background?: string;
    transparent?: string | null;
    dither?: boolean | string;
    debug?: boolean;
    repeat?: number;
  }

  export interface FrameOptions {
    delay?: number;
    copy?: boolean;
    dispose?: number;
    transparent?: string | null;
  }

  export default class GIF {
    constructor(options: GIFOptions);

    addFrame(
      element: HTMLCanvasElement | CanvasRenderingContext2D | HTMLImageElement,
      options?: FrameOptions
    ): void;

    render(): void;
    abort(): void;

    on(event: 'finished', callback: (blob: Blob) => void): void;
    on(event: 'progress', callback: (progress: number) => void): void;
    on(event: 'error', callback: (error: Error) => void): void;
    on(event: 'start', callback: () => void): void;
    on(event: 'abort', callback: () => void): void;
  }
}
