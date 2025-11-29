# Animation Phase Cycling Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add two-phase speed cycling (10s normal → 10s half-speed) and random velocity injections (10 cards every 60s) to prevent cards from settling into stationary distributions.

**Architecture:** Hybrid ref/state approach - useRef for continuous phase timing (zero re-renders), useState for discrete injection events (visual feedback). CardDeck manages timing in useFrame, Card components read from shared refs.

**Tech Stack:** React, Three.js, @react-three/fiber, TypeScript

---

## Task 1: Add Phase State Management to CardDeck

**Files:**
- Modify: `src/components/CardDeck.tsx:409-437` (CardDeck component function)

**Step 1: Add phase state refs after currentlyDraggingRef**

Location: After line 411 in CardDeck component

```typescript
const currentlyDraggingRef = useRef<number | null>(null);

// Phase cycling state (continuous, no re-renders)
const phaseStateRef = useRef({
  elapsedTime: 0,           // 0-20s cycle counter
  currentPhase: 'fast' as 'fast' | 'slow',
  velocityMultiplier: 1.0,  // Interpolates 1.0 ↔ 0.5
  transitionProgress: 1.0,  // 0-1 during fade
});

// Injection timing state
const injectionStateRef = useRef({
  timeSinceLastInjection: 0,  // 0-60s counter
});

// Injection visual feedback (discrete events, triggers re-renders)
const [injectedCardIndices, setInjectedCardIndices] = useState<Set<number>>(new Set());
```

**Step 2: Verify code compiles**

Run: `npm run build`
Expected: Build succeeds (no TypeScript errors)

**Step 3: Commit**

```bash
git add src/components/CardDeck.tsx
git commit -m "feat(animation): add phase cycling and injection state refs

- Add phaseStateRef for continuous timing (no re-renders)
- Add injectionStateRef for 60s timer
- Add injectedCardIndices state for visual feedback

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 2: Implement Phase Cycling Logic in CardDeck

**Files:**
- Modify: `src/components/CardDeck.tsx:409-483` (CardDeck component)

**Step 1: Add useFrame hook import**

Location: Line 2, verify `useFrame` is imported

```typescript
import { useFrame, useThree } from '@react-three/fiber';
```

**Step 2: Add phase cycling logic in useFrame hook**

Location: After line 465 (before the return statement in CardDeck component)

```typescript
// Phase cycling logic
useFrame((state, dt) => {
  const phaseRef = phaseStateRef.current;
  phaseRef.elapsedTime += dt;

  // 20-second cycle: 0-10s fast, 10-20s slow
  if (phaseRef.elapsedTime >= 20) {
    phaseRef.elapsedTime = 0;
  }

  const targetPhase = phaseRef.elapsedTime < 10 ? 'fast' : 'slow';
  const targetMultiplier = targetPhase === 'fast' ? 1.0 : 0.5;

  // Detect phase change
  if (phaseRef.currentPhase !== targetPhase) {
    phaseRef.currentPhase = targetPhase;
    phaseRef.transitionProgress = 0; // Start 1.5s fade
  }

  // Smooth interpolation (smoothstep easing)
  if (phaseRef.transitionProgress < 1.0) {
    phaseRef.transitionProgress = Math.min(1.0, phaseRef.transitionProgress + dt / 1.5);
    const t = phaseRef.transitionProgress;
    const smoothT = t * t * (3 - 2 * t); // smoothstep function
    phaseRef.velocityMultiplier = THREE.MathUtils.lerp(
      phaseRef.velocityMultiplier,
      targetMultiplier,
      smoothT
    );
  } else {
    phaseRef.velocityMultiplier = targetMultiplier;
  }
});
```

**Step 3: Verify code compiles**

Run: `npm run build`
Expected: Build succeeds

**Step 4: Test in browser**

Run: `npm run dev`
Action: Open browser console, add temporary logging to verify phase cycling
Expected: Console shows velocityMultiplier transitioning between 1.0 and 0.5

**Step 5: Commit**

```bash
git add src/components/CardDeck.tsx
git commit -m "feat(animation): implement phase cycling logic

- 20s cycle: 0-10s fast (1.0x), 10-20s slow (0.5x)
- Smooth 1.5s transitions using smoothstep easing
- Phase state tracked in refs (no re-renders)

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 3: Implement Velocity Injection System in CardDeck

**Files:**
- Modify: `src/components/CardDeck.tsx` (useFrame hook)

**Step 1: Add injection logic to existing useFrame hook**

Location: Inside the useFrame hook created in Task 2, after phase cycling logic

```typescript
useFrame((state, dt) => {
  // ... (phase cycling logic from Task 2)

  // Velocity injection every 60 seconds
  const injRef = injectionStateRef.current;
  injRef.timeSinceLastInjection += dt;

  if (injRef.timeSinceLastInjection >= 60) {
    injRef.timeSinceLastInjection = 0;

    // Select 10 random cards (no duplicates)
    const totalCards = allPhysicsRef.current.length; // 78
    const selectedIndices = new Set<number>();
    while (selectedIndices.size < 10) {
      selectedIndices.add(Math.floor(Math.random() * totalCards));
    }

    // Apply strong random impulses
    selectedIndices.forEach(index => {
      const physics = allPhysicsRef.current[index];

      // Random direction + magnitude (0.3-0.5)
      const magnitude = 0.3 + Math.random() * 0.2;
      const direction = new THREE.Vector3(
        Math.random() - 0.5,
        Math.random() - 0.5,
        Math.random() - 0.5
      ).normalize();

      const impulse = direction.multiplyScalar(magnitude);
      physics.velocity.add(impulse); // Additive to existing velocity
    });

    // Trigger visual feedback (causes re-render of 10 cards)
    setInjectedCardIndices(selectedIndices);

    // Clear glow after 500ms
    setTimeout(() => setInjectedCardIndices(new Set()), 500);
  }
});
```

**Step 2: Verify code compiles**

Run: `npm run build`
Expected: Build succeeds

**Step 3: Test injection timing (manual)**

Note: To test quickly without waiting 60s, temporarily change line:
```typescript
if (injRef.timeSinceLastInjection >= 60) {
```
to:
```typescript
if (injRef.timeSinceLastInjection >= 5) { // TEST ONLY
```

Run: `npm run dev`
Action: Watch for cards to scatter every 5 seconds
Expected: 10 random cards receive velocity impulse every 5s

**Revert test change** before committing.

**Step 4: Commit**

```bash
git add src/components/CardDeck.tsx
git commit -m "feat(animation): implement velocity injection system

- Every 60s, inject velocity impulse to 10 random cards
- Random direction + magnitude (0.3-0.5)
- Triggers injection glow state for 500ms
- Breaks up stationary distributions

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 4: Pass Phase State to Card Components

**Files:**
- Modify: `src/components/CardDeck.tsx:17-25` (CardProps interface)
- Modify: `src/components/CardDeck.tsx:469-479` (Card rendering)

**Step 1: Add props to CardProps interface**

Location: Lines 17-25

```typescript
interface CardProps {
  card: TarotCard;
  initialPosition: [number, number, number];
  initialRotation: [number, number, number];
  index: number;
  physics: React.MutableRefObject<CardPhysics>;
  allPhysics: React.MutableRefObject<CardPhysics[]>;
  currentlyDraggingRef: React.MutableRefObject<number | null>;
  phaseStateRef: React.MutableRefObject<{
    elapsedTime: number;
    currentPhase: 'fast' | 'slow';
    velocityMultiplier: number;
    transitionProgress: number;
  }>;
  isInjected: boolean;
}
```

**Step 2: Pass new props to Card components**

Location: Lines 469-479 in CardDeck component

```typescript
{cards.map((card, index) => (
  <Card
    key={card.number}
    card={card}
    initialPosition={cardData[index].position}
    initialRotation={cardData[index].rotation}
    index={index}
    physics={physicsRefs.current[index]}
    allPhysics={allPhysicsRef}
    currentlyDraggingRef={currentlyDraggingRef}
    phaseStateRef={phaseStateRef}
    isInjected={injectedCardIndices.has(index)}
  />
))}
```

**Step 3: Update Card function signature**

Location: Line 27

```typescript
function Card({ card, initialPosition, initialRotation, index, physics, allPhysics, currentlyDraggingRef, phaseStateRef, isInjected }: CardProps) {
```

**Step 4: Verify code compiles**

Run: `npm run build`
Expected: Build succeeds

**Step 5: Commit**

```bash
git add src/components/CardDeck.tsx
git commit -m "feat(animation): pass phase state to Card components

- Add phaseStateRef and isInjected to CardProps
- Pass props from CardDeck to all Card instances
- No behavior change yet (props not used)

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 5: Apply Velocity Multiplier in Card Component

**Files:**
- Modify: `src/components/CardDeck.tsx:270-273` (Card velocity limiting)

**Step 1: Replace hardcoded MAX_VELOCITY with phase-modulated value**

Location: Lines 270-273 in Card component's useFrame hook

Replace:
```typescript
// Limit velocity
if (physics.current.velocity.length() > MAX_VELOCITY) {
  physics.current.velocity.normalize().multiplyScalar(MAX_VELOCITY);
}
```

With:
```typescript
// Limit velocity (phase-modulated)
const effectiveMaxVelocity = MAX_VELOCITY * phaseStateRef.current.velocityMultiplier;
if (physics.current.velocity.length() > effectiveMaxVelocity) {
  physics.current.velocity.normalize().multiplyScalar(effectiveMaxVelocity);
}
```

**Step 2: Verify code compiles**

Run: `npm run build`
Expected: Build succeeds

**Step 3: Test phase cycling effect**

Run: `npm run dev`
Action: Watch cards slow down after 10s, speed up after 20s
Expected: Visible change in card movement speed every 10s

**Step 4: Commit**

```bash
git add src/components/CardDeck.tsx
git commit -m "feat(animation): apply phase-modulated velocity limit

- Cards now respect velocityMultiplier from phaseStateRef
- Effective max velocity: 0.45 (fast) → 0.225 (slow)
- Creates breathing rhythm in animation

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 6: Add Injection Visual Feedback

**Files:**
- Modify: `src/components/CardDeck.tsx:357-363` (Card meshStandardMaterial)

**Step 1: Update emissive color logic**

Location: Lines 357-363 in Card component

Replace:
```typescript
<meshStandardMaterial
  color={dragging ? '#7c3aed' : hovered ? '#9333ea' : '#1a1a2e'}
  emissive={dragging ? '#7c3aed' : hovered ? '#9333ea' : '#000000'}
  emissiveIntensity={dragging ? 0.8 : hovered ? 0.5 : 0}
  metalness={0.3}
  roughness={0.7}
/>
```

With:
```typescript
<meshStandardMaterial
  color={dragging ? '#7c3aed' : hovered ? '#9333ea' : '#1a1a2e'}
  emissive={
    dragging ? '#7c3aed' :
    hovered ? '#9333ea' :
    isInjected ? '#ff6b35' :
    '#000000'
  }
  emissiveIntensity={
    dragging ? 0.8 :
    hovered ? 0.5 :
    isInjected ? 0.9 :
    0
  }
  metalness={0.3}
  roughness={0.7}
/>
```

**Step 2: Verify code compiles**

Run: `npm run build`
Expected: Build succeeds

**Step 3: Test injection glow (manual)**

Temporarily reduce injection interval to 5s (as in Task 3 Step 3)

Run: `npm run dev`
Action: Watch for orange glow on 10 random cards every 5s
Expected: Cards briefly glow orange (#ff6b35) for 500ms

**Revert test change** before committing.

**Step 4: Commit**

```bash
git add src/components/CardDeck.tsx
git commit -m "feat(animation): add visual feedback for velocity injections

- Injected cards glow orange (#ff6b35) for 500ms
- High emissive intensity (0.9) makes injection visible
- Drag/hover states take priority over injection glow

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 7: Remove Diagnostic Logging

**Files:**
- Modify: `src/components/CardDeck.tsx:35-44,143-149,283-289` (Card component)

**Step 1: Remove diagnostic console.log statements**

Remove or comment out:
- Lines 35-44: Initial state logging for card 0
- Lines 143-149: Frame count logging
- Lines 283-289: Physics state logging

Also remove:
- Line 36: `const frameCountRef = useRef(0);`

**Step 2: Verify code compiles**

Run: `npm run build`
Expected: Build succeeds

**Step 3: Test clean console**

Run: `npm run dev`
Action: Open browser console
Expected: No diagnostic logging from CardDeck

**Step 4: Commit**

```bash
git add src/components/CardDeck.tsx
git commit -m "cleanup: remove diagnostic logging from Card component

- Remove frame count tracking
- Remove initial state logging
- Remove physics state logging
- Clean console output

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 8: Manual Testing & Validation

**Files:**
- No file changes

**Step 1: Full animation cycle test**

Run: `npm run dev`

**Test checklist:**
- [ ] Cards visibly slow down after 10 seconds
- [ ] Transition is smooth (no abrupt change)
- [ ] Cards speed up again after 20 seconds
- [ ] Cycle repeats continuously
- [ ] Every 60 seconds, 10 random cards scatter
- [ ] Injected cards glow orange briefly
- [ ] Existing interactions still work (drag, hover, click)

**Step 2: Performance verification**

- [ ] Open Chrome DevTools > Performance
- [ ] Record 30 seconds of animation
- [ ] Verify frame rate stays at ~60fps
- [ ] Check for frame drops during phase transitions
- [ ] Verify no excessive re-renders

**Step 3: Edge case testing**

- [ ] Drag a card during slow phase (should work normally)
- [ ] Inject happens during slow phase (cards scatter but capped at 0.225)
- [ ] Hover injected card (hover glow overrides injection glow)

**Step 4: Document test results**

Create: `docs/testing/2025-11-29-animation-phase-testing.md`

```markdown
# Animation Phase Cycling - Test Results

**Date:** 2025-11-29
**Tester:** [Your name]

## Functional Tests

- [x/] Phase cycling (10s fast → 10s slow)
- [x/] Smooth transitions
- [x/] Velocity injections every 60s
- [x/] Orange glow on injected cards
- [x/] Existing interactions preserved

## Performance Tests

- FPS: [average fps]
- Frame drops during transitions: [yes/no]
- Re-render count during injection: [count]

## Edge Cases

- Drag during slow phase: [pass/fail]
- Injection during slow phase: [pass/fail]
- Hover + injection overlap: [pass/fail]

## Issues Found

[List any bugs or unexpected behavior]
```

---

## Task 9: Update Documentation

**Files:**
- Modify: `README.md` (if exists, add feature description)
- Create: `docs/features/animation-phase-cycling.md`

**Step 1: Create feature documentation**

Create: `docs/features/animation-phase-cycling.md`

```markdown
# Animation Phase Cycling

## Overview

Cards alternate between fast and slow movement phases to prevent settling into stationary distributions.

## Behavior

### Phase Cycling
- **Fast Phase (0-10s):** Normal speed (max velocity 0.45)
- **Transition (10-11.5s):** Smooth fade to half speed
- **Slow Phase (11.5-20s):** Half speed (max velocity 0.225)
- **Transition (20-21.5s):** Smooth fade back to full speed
- Cycle repeats infinitely

### Velocity Injections
- Every 60 seconds, 10 random cards receive velocity impulse
- Impulse magnitude: 0.3-0.5 in random direction
- Cards glow orange (#ff6b35) for 500ms
- Breaks up static formations

## Implementation Details

### Architecture
- **Refs for timing:** Zero re-renders during phase cycling
- **State for injections:** Brief re-render for visual feedback
- **Hybrid approach:** Balances performance with UX

### Constants
```typescript
PHASE_DURATION = 10s (per phase)
TRANSITION_DURATION = 1.5s
INJECTION_INTERVAL = 60s
INJECTION_COUNT = 10 cards
INJECTION_MAGNITUDE = 0.3-0.5
GLOW_DURATION = 500ms
```

### Files Modified
- `src/components/CardDeck.tsx` - Phase/injection logic, state management
- `docs/plans/2025-11-29-animation-phase-cycling-design.md` - Design doc
- `docs/plans/2025-11-29-animation-phase-cycling-plan.md` - Implementation plan

## Performance

- **No frame drops** during phase transitions (ref-based)
- **Minimal re-renders** on injections (10 cards × 500ms, every 60s)
- **60fps maintained** throughout all phases
```

**Step 2: Commit documentation**

```bash
git add docs/features/animation-phase-cycling.md
git commit -m "docs: add animation phase cycling feature documentation

- Describe phase cycling behavior
- Document velocity injection system
- Include implementation details and constants
- Performance characteristics

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 10: Final Build & Verification

**Files:**
- No file changes

**Step 1: Clean build**

```bash
rm -rf node_modules/.vite
npm run build
```

Expected: Build succeeds with no errors or warnings

**Step 2: Production test**

```bash
npm run preview
```

Action: Test full animation cycle in production build
Expected: Same behavior as dev mode

**Step 3: Git status check**

```bash
git status
```

Expected: Clean working directory (all changes committed)

**Step 4: Final commit (if needed)**

If any uncommitted changes:
```bash
git add .
git commit -m "chore: final cleanup for animation phase cycling

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Success Criteria

- [x] Cards visibly speed up and slow down in 20-second cycles
- [x] Transitions are smooth (no abrupt changes)
- [x] Every 60s, 10 random cards scatter in random directions
- [x] Injected cards glow orange briefly
- [x] No frame drops or performance degradation
- [x] Existing interactions (drag, hover, click) still work perfectly
- [x] All code committed with descriptive messages
- [x] Documentation updated

---

## Rollback Plan

If issues arise, rollback sequence:

```bash
# Find commit before animation changes
git log --oneline | grep "animation"

# Rollback to commit before first animation change
git revert <commit-hash> --no-commit
git commit -m "revert: rollback animation phase cycling

Reason: [describe issue]

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Notes

- **Testing injection interval:** Temporarily change 60s to 5s for faster testing, but ALWAYS revert before committing
- **Performance monitoring:** Use Chrome DevTools Performance tab to verify 60fps
- **Edge cases:** Test during both fast and slow phases
- **Visual feedback:** Injection glow should be brief but noticeable
