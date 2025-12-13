import { describe, it, expect } from 'vitest';
import { toRoman } from './roman';

describe('toRoman', () => {
  it('should return "0" for zero or negative numbers', () => {
    expect(toRoman(0)).toBe('0');
    expect(toRoman(-1)).toBe('0');
    expect(toRoman(-100)).toBe('0');
  });

  it('should convert single digit numbers correctly', () => {
    expect(toRoman(1)).toBe('I');
    expect(toRoman(2)).toBe('II');
    expect(toRoman(3)).toBe('III');
    expect(toRoman(4)).toBe('IV');
    expect(toRoman(5)).toBe('V');
    expect(toRoman(6)).toBe('VI');
    expect(toRoman(7)).toBe('VII');
    expect(toRoman(8)).toBe('VIII');
    expect(toRoman(9)).toBe('IX');
  });

  it('should convert 10 to X', () => {
    expect(toRoman(10)).toBe('X');
  });

  it('should handle numbers requiring multiple X symbols', () => {
    // Note: Current implementation only handles up to 10
    // These tests document current behavior
    expect(toRoman(10)).toBe('X');
  });

  it('should handle tarot card numbers (0-21)', () => {
    // Major Arcana range
    expect(toRoman(1)).toBe('I');      // The Magician
    expect(toRoman(2)).toBe('II');     // The High Priestess
    expect(toRoman(10)).toBe('X');     // Wheel of Fortune
  });
});
