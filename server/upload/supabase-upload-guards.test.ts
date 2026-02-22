import { describe, expect, it } from 'vitest';
import { assertAllowedRemoteUrl, buildCardPathPrefix } from './supabase-upload-guards';
import { HttpError, parseAllowedHosts, parsePayload } from './supabase-upload-config';

describe('upload-supabase config/guards', () => {
  it('deduplicates allowlist hosts', () => {
    const hosts = parseAllowedHosts('A.com,a.com, b.com ', ['fallback.com']);
    expect(hosts).toEqual(['a.com', 'b.com']);
  });

  it('accepts allowed remote HTTPS URL', () => {
    expect(() => assertAllowedRemoteUrl('https://generativelanguage.googleapis.com/v1/video')).not.toThrow();
  });

  it('rejects non-https remote URL', () => {
    expect(() => assertAllowedRemoteUrl('http://generativelanguage.googleapis.com/v1/video')).toThrow(HttpError);
  });

  it('rejects localhost remote URL', () => {
    expect(() => assertAllowedRemoteUrl('https://localhost/video.mp4')).toThrow(HttpError);
  });

  it('builds sanitized path prefixes', () => {
    const prefix = buildCardPathPrefix(
      {
        cardNumber: 1,
        deckType: 'Custom Deck !',
        frames: ['data:image/png;base64,AA=='],
        deckId: 'Deck ID #1',
      },
      'req-123'
    );

    expect(prefix).toContain('deck-id-1');
    expect(prefix).toContain('custom-deck');
    expect(prefix).toContain('req-123');
  });

  it('parses valid payload', () => {
    const payload = parsePayload({
      cards: [
        {
          cardNumber: 1,
          deckType: 'traditional-rider-waite',
          frames: ['data:image/png;base64,AA=='],
        },
      ],
    });

    expect(payload.cards).toHaveLength(1);
  });

  it('rejects invalid payload', () => {
    expect(() =>
      parsePayload({
        cards: [
          {
            cardNumber: -1,
            deckType: 'traditional-rider-waite',
            frames: ['data:image/png;base64,AA=='],
          },
        ],
      })
    ).toThrow(HttpError);
  });
});
