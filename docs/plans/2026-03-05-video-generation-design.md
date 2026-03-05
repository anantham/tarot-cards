# Video Generation Design — Veo 3.1 Client-Side Polling

<!--
Last verified: 2026-03-05
Code hash: 4801537
Verified by: agent
-->

## Status

Implemented — `src/utils/videoGeneration.ts`

## Context

Cards are animated by generating an 8-second 9:16 video from the static card image using
Google's Veo 3.1 model via the Gemini API. The video adds motion to the tarot illustration
(flowing robes, flickering candles, moving smoke) without replacing the image.

Veo 3.1 is a long-running operation: the API accepts a generation request and returns an
operation name, which must be polled until the video is ready. Generation typically takes
30–90 seconds.

## Decision: Client-Side Polling

**Chosen:** Client polls the operation URL directly from the browser.

**Alternatives considered:**

| Option | Pros | Cons | Why rejected |
|--------|------|------|-------------|
| **Server-side job queue** | Survives page refresh; no browser resource use | Requires persistent server (Vercel functions time out at 10s) | Vercel serverless can't hold a 90s connection |
| **Webhook / push notification** | No polling overhead | Requires server that receives callbacks + browser reconnect | Extra infrastructure; overkill for single-user app |
| **Client polling (chosen)** | Simple; no server state; works on Vercel | Fails if browser closes; ties up user's connection | Acceptable: generation is foreground, user waits |

**Why client-side is acceptable here:** This is a single-user personal app. The user
initiates generation and waits in the same browser session. Losing progress on tab close
is acceptable — they see the error and retry. A job queue would add infrastructure
complexity with no user-visible benefit.

## Polling Strategy

```
pollIntervalMs  = 2000   // check every 2 seconds
maxPollAttempts = 60     // 60 × 2s = 2 minute hard timeout
maxRetries      = 2      // retry the full attempt on hard failure (5xx, network)
```

**Why 2 seconds?** Fast enough to detect completion without hammering the API quota.
Veo generation rarely completes in under 30s, so sub-second polling would waste requests.

**Why 2 minutes?** Veo 3.1 generation takes 30–90s in practice. 2 minutes gives a
comfortable margin. Beyond that, something is wrong (stuck operation, infrastructure
issue) and surfacing an error is better than waiting indefinitely.

**Why 2 retries?** Transient errors (network blip, 5xx) should be retried. More than
2 retries would eat too much time given the 90s generation window. Quota errors are
not retried — they surface immediately with a descriptive message.

## Quota Awareness

Veo 3.1 limits (as of 2026-03): daily cap ~10 videos per API key, RPM limit ~5.
The code detects 429 responses and quota-related error messages, and surfaces a
human-readable error explaining the limit and suggesting the user wait.

Rate limit errors are not retried because waiting the `pollIntervalMs` delay would
not help — the quota window resets on a minutes/daily basis.

## Response Shape Handling

The Veo API's response structure has changed across preview versions. `extractVideoUri`
checks 8 different paths in the operation response to find the video URL:

```
opData.response.generateVideoResponse.generatedSamples[0].video.uri
opData.response.generateVideoResponse.generatedSamples[0].videoUri
opData.response.generateVideoResponse.generatedSamples[0].video.downloadUri
opData.response.generatedVideos[0].video.uri
opData.response.generatedVideos[0].videoUri
opData.response.generatedVideos[0].video.downloadUri
opData.response.video.uri
opData.response.videoUri
```

This defensive approach absorbs API shape changes without breaking. When the API
stabilises, this can be collapsed to 1–2 paths.

## Reference Image

When a reference image (the card's generated illustration) is supplied, it is sent
as `bytesBase64Encoded` inline with the request. This guides Veo to animate the
specific image rather than generating a generic tarot video.

The reference image is passed as a data URL (`data:<mime>;base64,<data>`). The
`dataUrlToBytes` helper extracts mime type and base64 data for the API payload.

## Known Limitations

- **No resume on page close:** If the user closes the tab during generation, the
  operation continues server-side but the result is lost. The user must regenerate.
- **API types are `any`:** Gemini's Veo API doesn't have a published TypeScript SDK.
  Response shapes are typed as `any` with defensive extraction. When a typed client
  becomes available, this should be migrated.
- **Single video per call:** The API supports generating multiple samples; the code
  only uses the first (`generatedSamples[0]`). No need for alternatives at this time.

## Tech Debt

- **`any` types:** `opData: any`, `instances: any[]` — should be typed once the
  Gemini TypeScript SDK covers Veo endpoints.
- **Response path fan-out:** `extractVideoUri`'s 8-path search should be collapsed
  once the API shape stabilises.
