# Animation Phase Cycling & Velocity Injection Design

**Date:** 2025-11-29
**Status:** Design Approved
**Component:** CardDeck.tsx

---

## Problem Statement

Current card animation settles into stationary distributions due to force equilibrium. Cards have continuous orbital spin and repulsion forces, but damping (0.965) and balanced forces cause them to find stable positions, creating a static appearance despite the physics system.

**User Requirements:**
1. Two-phase cycle: 10s normal speed → 10s at 50% speed → repeat
2. Smooth transitions between phases (1-2 second fade)
3. Random velocity injections to 10 cards every 60 seconds
4. Visual feedback (glow) on injected cards

---

## Design Decisions

### Architecture: Hybrid Ref/State Approach

**Rationale:** Balance performance with React patterns
- **useRef for phase timing** - Zero re-renders for continuous 60fps animation
- **useState for injection events** - React-managed visual feedback for discrete events
- **Top-level management** - CardDeck component owns timing, passes state to cards

**Trade-offs:**
- ✅ Smooth phase transitions (no 78-card re-renders every 10s)
- ✅ Visible injection feedback (10 cards glow briefly)
- ✅ Debuggable in React DevTools (injection state)
- ⚠️ Phase state less visible (refs don't show in DevTools)

**Rejected Alternatives:**
1. **Full useState** - 156 re-renders (78 cards × 2) every 10s causes frame drops
2. **Pure refs** - No way to trigger injection glow without forcing updates

---

## Implementation Design

### 1. Data Structures

#### In CardDeck Component

**Refs (continuous state, no re-renders):**
```typescript
const phaseStateRef = useRef({
  elapsedTime: 0,           // 0-20s cycle counter
  currentPhase: 'fast' | 'slow',
  velocityMultiplier: 1.0,  // Interpolates 1.0 ↔ 0.5
  transitionProgress: 1.0,  // 0-1 during fade
});

const injectionStateRef = useRef({
  timeSinceLastInjection: 0,  // 0-60s counter
});
```

**State (discrete events, triggers re-renders):**
```typescript
const [injectedCardIndices, setInjectedCardIndices] = useState<Set<number>>(new Set());
```

**Props passed to Card:**
```typescript
<Card
  // ... existing props
  phaseStateRef={phaseStateRef}
  isInjected={injectedCardIndices.has(index)}
/>
```

---

### 2. Phase Cycling Logic

**Location:** CardDeck useFrame hook
**Frequency:** Every frame (~60fps)

```typescript
useFrame((state, dt) => {
  const ref = phaseStateRef.current;
  ref.elapsedTime += dt;

  // 20-second cycle: 0-10s fast, 10-20s slow
  if (ref.elapsedTime >= 20) {
    ref.elapsedTime = 0;
  }

  const targetPhase = ref.elapsedTime < 10 ? 'fast' : 'slow';
  const targetMultiplier = targetPhase === 'fast' ? 1.0 : 0.5;

  // Detect phase change
  if (ref.currentPhase !== targetPhase) {
    ref.currentPhase = targetPhase;
    ref.transitionProgress = 0; // Start 1.5s fade
  }

  // Smooth interpolation (smoothstep easing)
  if (ref.transitionProgress < 1.0) {
    ref.transitionProgress = Math.min(1.0, ref.transitionProgress + dt / 1.5);
    const t = ref.transitionProgress;
    const smoothT = t * t * (3 - 2 * t); // smoothstep function
    ref.velocityMultiplier = THREE.MathUtils.lerp(
      ref.velocityMultiplier,
      targetMultiplier,
      smoothT
    );
  } else {
    ref.velocityMultiplier = targetMultiplier;
  }
});
```

**Card-side usage:**
In Card component's velocity limiting:
```typescript
// Replace: const MAX_VELOCITY = 0.45;
const effectiveMaxVelocity = MAX_VELOCITY * phaseStateRef.current.velocityMultiplier;

if (physics.current.velocity.length() > effectiveMaxVelocity) {
  physics.current.velocity.normalize().multiplyScalar(effectiveMaxVelocity);
}
```

**Effect:**
- 0-10s: MAX_VELOCITY = 0.45 (normal)
- 10-11.5s: Smooth fade to 0.225 (half speed)
- 11.5-20s: MAX_VELOCITY = 0.225 (slow phase)
- 20-21.5s: Smooth fade back to 0.45
- Repeat infinitely

---

### 3. Velocity Injection System

**Location:** CardDeck useFrame hook
**Frequency:** Every 60 seconds

```typescript
useFrame((state, dt) => {
  // ... phase cycling logic above

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

**Visual Feedback (in Card component):**
```typescript
// Props: isInjected (boolean)

<meshStandardMaterial
  color={dragging ? '#7c3aed' : hovered ? '#9333ea' : '#1a1a2e'}
  emissive={
    dragging ? '#7c3aed' :
    hovered ? '#9333ea' :
    isInjected ? '#ff6b35' :  // Orange injection glow
    '#000000'
  }
  emissiveIntensity={
    dragging ? 0.8 :
    hovered ? 0.5 :
    isInjected ? 0.9 :  // Bright flash
    0
  }
  metalness={0.3}
  roughness={0.7}
/>
```

**Effect:**
- Every 60s, 10 random cards receive random velocity impulse (0.3-0.5 magnitude)
- Injected cards glow orange for 500ms
- Breaks up static formations, creates chaos bursts
- Impulses add to existing velocity (no sudden stops)

---

## Technical Constraints

### Performance Targets
- **No frame drops** during phase transitions (achieved via refs)
- **Minimal re-renders** on injections (10 cards × 500ms, every 60s)
- **60fps maintained** throughout all phases

### Physics Compatibility
- Works with existing forces: repulsion, attraction, orbital spin, drift
- Respects existing MAX_VELOCITY cap (now phase-modulated)
- Damping (0.965) still applies each frame
- Boundary forces still prevent cards escaping view

### Timing Precision
- Phase cycle: 20.0s ± 16ms (1 frame at 60fps)
- Injection interval: 60.0s ± 16ms
- Transition duration: 1.5s ± 16ms

---

## Edge Cases & Error Handling

### Edge Case: Injection During Slow Phase
**Scenario:** 60s timer fires during slow phase (10-20s window)
**Behavior:** Impulse applied normally, but velocity immediately capped at 0.225
**Result:** Visible kick, but slower scatter than in fast phase
**Mitigation:** Working as intended - creates phase-dependent injection dynamics

### Edge Case: Multiple Cards Selected Twice
**Scenario:** Random selection picks same index multiple times
**Solution:** Use `Set<number>` for deduplication
**Guarantee:** Exactly 10 unique cards injected

### Edge Case: Injection Glow Overlaps Hover/Drag
**Scenario:** User hovers/drags an injected card
**Behavior:** Drag/hover emissive overrides injection glow (ternary priority)
**Result:** User interaction takes visual precedence

### Edge Case: Very Long Frame Time (lag spike)
**Scenario:** `dt > 1.0` (browser tab backgrounded)
**Current behavior:** Physics teleports, timers skip ahead
**Mitigation:** Existing `Math.min(dt, 0.1)` cap in Card component limits damage
**Recommendation:** No additional fixes needed (rare case, recovers naturally)

---

## Testing Strategy

### Manual Verification
1. **Phase cycling:** Watch velocity multiplier interpolate in console (first 30 frames)
2. **Timing accuracy:** Log phase transitions, verify 10s intervals
3. **Injection events:** Log selected indices, verify 10 unique cards every 60s
4. **Visual feedback:** Confirm orange glow appears on correct cards
5. **Smooth transitions:** Verify no visual "pop" when switching phases

### Performance Metrics
- **Before/After FPS:** Measure in Chrome DevTools Performance panel
- **Re-render count:** React DevTools Profiler during injection events
- **Frame time budget:** Should stay under 16.67ms (60fps)

### Integration Tests
- Verify phase state doesn't break existing drag/hover interactions
- Confirm injection impulses respect boundary forces
- Test that damping still prevents runaway acceleration

---

## Success Criteria

1. ✅ Cards visibly speed up and slow down in 20-second cycles
2. ✅ Transitions are smooth (no abrupt changes)
3. ✅ Every 60s, 10 random cards scatter in random directions
4. ✅ Injected cards glow orange briefly
5. ✅ No frame drops or performance degradation
6. ✅ Existing interactions (drag, hover, click) still work perfectly

---

## Implementation Files

**Primary changes:**
- `src/components/CardDeck.tsx` - Add refs, state, useFrame logic
- `src/components/CardDeck.tsx` (Card component) - Accept new props, apply velocity multiplier

**No new files required** - purely additive changes to existing component.

---

## Future Enhancements (Out of Scope)

- UI controls to adjust phase duration (10s → configurable)
- Variable injection intervals (60s → user preference)
- Injection strength settings (0.3-0.5 → slider)
- Debug overlay showing phase state in real-time
- Sync phase cycling across multiple browser tabs (shared timer)
