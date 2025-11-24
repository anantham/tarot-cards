const fs = require('fs');
const path = require('path');

// Narratives from obsidian-lore.ts
const narratives = {
  0: {
    summary: 'Potential, faith, beginnings, edge between trust and stupidity.',
    axis: 'Sacred Leap vs Stupid Risk',
    feel: 'Held breath at the edge; terror and wonder together.',
    stance: 'Alone with the world as witness; environment bigger than the figure.',
    scene: 'Mid-step off an impossible ledge, cliff bending toward their foot as if reality wants to catch them.',
    question: 'What are you willing to risk not understanding, if it means truly living?'
  },
  1: {
    summary: 'Mastery, intention, manifestation, channeling versus manipulation.',
    axis: 'Aligned Channel vs Manipulative Trickster',
    feel: 'Sharp, focused current from crown to fingertips, like holding a live wire on purpose.',
    stance: 'Between above and below, half priest, half performer; power flows through and draws eyes.',
    scene: 'One hand to sky, one to earth; tools half sacred, half stage props, miracle blurring with trick.',
    question: 'Are you serving something larger than yourself, or just bending appearances to your will?'
  },
  2: {
    summary: 'Spirituality, intuition, inner stillness, mystery of the unspoken.',
    axis: 'Quiet Knowing vs Withheld Truth',
    feel: 'Cool moonlight behind the eyes; soft weight in the chest saying you already know.',
    stance: 'Turned slightly away, seated at the threshold; guardian of a veil, not its owner.',
    scene: 'Between two pillars with a veiled backdrop of stars and deep water; a closed book rests on their lap.',
    question: 'What truth are you pretending you do not already feel in your bones?'
  },
  3: {
    summary: 'Decadence, nurturing, feminine abundance vs smothering excess.',
    axis: 'Overflowing Care vs Overgrown Indulgence',
    feel: 'Warmth spreading through belly and chest, like lying in the sun after a feast.',
    stance: 'Surrounded by others, plants, textures, sounds; everything wants to grow closer.',
    scene: 'Reclining on vines and cushions, fruits and flowers spilling over; a wilted bloom hints at unpruned abundance.',
    question: 'Where does true nourishment end and overindulgence begin in how you treat yourself and others?'
  },
  4: {
    summary: 'Leadership, authority, structure, tension between protection and control.',
    axis: 'Steady Foundation vs Rigid Domination',
    feel: 'Weight in the shoulders like armor—comforting and heavy.',
    stance: 'Elevated above others but facing them; responsible for them yet tempted to be above them.',
    scene: 'Stone throne carved into a mountainside; a glowing city below, stable but unmoving.',
    question: 'Where are you building solid ground—and where are you turning living beings into bricks?'
  },
  5: {
    summary: 'Tradition, conformity, teaching, lineage versus empty ritual.',
    axis: 'Living Tradition vs Hollow Dogma',
    feel: 'Grounded spine, hands in a familiar gesture; comfort in patterns with an itch to question.',
    stance: 'Between unseen source and gathered group, translating something old into something usable.',
    scene: 'Teacher on temple steps, students at varying distances; some awake, others glazed in motion without meaning.',
    question: 'Which of your "shoulds" are wise inheritance—and which are habits you are afraid to outgrow?'
  },
  6: {
    summary: 'Partnership, emotion, balance, sacred weight of choosing.',
    axis: 'Conscious Union vs Splitting Indecision',
    feel: 'Heart pulled in two directions; ache and sweetness braided.',
    stance: 'At least two beings with a third presence of fate or value hovering between.',
    scene: 'Two figures reach toward each other while a constellation above forms a third shape they must also embrace.',
    question: 'Who are you becoming by choosing this bond—or by refusing to choose?'
  },
  7: {
    summary: 'Prowess, determination, momentum, risk of being driven by drive.',
    axis: 'Focused Drive vs Runaway Momentum',
    feel: 'Leaning forward in the chest, adrenaline humming in the legs.',
    stance: 'Ahead of the crowd, pulled by forces that must be steered.',
    scene: 'Chariot pulled by two creatures veering apart, driver calm with loose but intentional reins; road ahead splits.',
    question: 'Are you steering your momentum—or letting speed decide where you end up?'
  },
  8: {
    summary: 'Control, fortitude, resilience, softness within strength.',
    axis: 'Gentle Power vs Repressed Rage',
    feel: 'Steady warm pressure in chest and hands; holding a trembling animal without squeezing.',
    stance: 'Close to something wild, choosing to soothe rather than dominate.',
    scene: 'Hand on the muzzle of a roaring beast; broken chains in grass, eyes softening.',
    question: 'What happens when you stop gripping so hard and trust you are strong enough to stay open?'
  },
  9: {
    summary: 'Solitude, wisdom, self-reflection, chosen aloneness vs fearful withdrawal.',
    axis: 'Illuminating Solitude vs Self-Protective Isolation',
    feel: 'Cool air around the body, small lantern warmth held close.',
    stance: 'Distant from the crowd but not against it; watcher on the hill.',
    scene: 'Lone figure on a high path, lantern over a drop; town lights below, path turns further inward.',
    question: 'Are you stepping away to see clearly—or hiding because the world is looking back?'
  },
  10: {
    summary: 'Luck, change, fate, cycles turning beyond personal will.',
    axis: 'Dancing with Change vs Clinging to Control',
    feel: 'Lurch in the stomach like a Ferris wheel tipping over the top.',
    stance: 'Entangled with forces larger than will—systems, timing, others.',
    scene: 'Great wheel turning in the sky with figures rising, falling, climbing back by choice.',
    question: 'Where are you mistaking a temporary position on the wheel for your identity?'
  },
  11: {
    summary: 'Fairness, truth, balance, cost of seeing all sides.',
    axis: 'Clear Seeing vs Cold Judgment',
    feel: 'Vertical line from crown to pelvis, breath held while scales settle.',
    stance: 'Between parties or timelines, responsible to something beyond preference.',
    scene: 'Sword and scales; a feather on one side, tangled threads on the other.',
    question: 'If every voice—including your shadow—testified, what verdict would you reach?'
  },
  12: {
    summary: 'Release, perspective, acceptance, power of choosing not to struggle.',
    axis: 'Surrendered Insight vs Stuck Martyrdom',
    feel: 'Unclenching after fighting too long, relief and vulnerability.',
    stance: 'Suspended between action and outcome; spectators misread the pause.',
    scene: 'Hanging upside down from a living tree, calm face with halo of realization; onlookers think defeat.',
    question: 'What might you see differently if you stopped trying to fix anything at all?'
  },
  13: {
    summary: 'Metamorphosis, transition, release, endings enabling new forms.',
    axis: 'Necessary Ending vs Refused Change',
    feel: 'Hollowing in the chest followed by cool spaciousness.',
    stance: 'Walking through a door that cannot be shut; leaving roles behind.',
    scene: 'Cloaked figure through a field where old structures crumble into soil; green shoots breaking through.',
    question: 'What are you keeping alive that has already finished its work?'
  },
  14: {
    summary: 'Balance, introspection, combining, patient mixing of opposites.',
    axis: 'Harmonious Blending vs Blurred Dilution',
    feel: 'Slow even breaths; warmth and coolness meeting in the center.',
    stance: 'Between extremes, mediating without erasing difference.',
    scene: 'Pouring liquid between cups, one foot on land and one on water, path winding toward dawn.',
    question: 'Where could gentler mixing serve you better than a hard either-or?'
  },
  15: {
    summary: 'Excess, temptation, attachment, stories that make the cage feel like home.',
    axis: 'Conscious Desire vs Unconscious Addiction',
    feel: 'Tight pull in gut and throat; craving that feels like need.',
    stance: 'Bound to something once comforting now demanding obedience.',
    scene: 'Horned figure above two chained beings; chains are loose enough to slip but heads stay bowed.',
    question: 'What are you calling "just how things are" that is actually a choice you keep making?'
  },
  16: {
    summary: 'Upheaval, chaos, dread, mercy in a failing structure.',
    axis: 'Necessary Collapse vs Avoided Meltdown',
    feel: 'Floor dropping out; panic then clarity.',
    stance: 'Many people and beliefs shaken; no one fully outside the blast.',
    scene: 'Lightning splits a tower; stones and old certainties tumble, revealing open sky.',
    question: 'What have you built on that cannot bear the weight you put on it?'
  },
  17: {
    summary: 'Hope, faith, gentle renewal, quiet healing after devastation.',
    axis: 'Tender Hope vs Fragile Escapism',
    feel: 'Soft cool exhale after a long cry; tiny lightness in the sternum.',
    stance: 'Alone with the night sky but not lonely; guided by something vast.',
    scene: 'Kneeling by water, pouring from two vessels, anchored by a single bright star.',
    question: 'What small act of faith are you ready to take now, even if unsure it is enough?'
  },
  18: {
    summary: 'Mystery, duality, darkness, uneasy beauty of not knowing.',
    axis: 'Deep Imagination vs Paralyzing Confusion',
    feel: 'Foggy heaviness in head and gut; intuitions and fears flicker.',
    stance: 'Between tame and wild, conscious and unconscious; pulled by tides unseen.',
    scene: 'Path between a wolf and a dog howling at a huge moon; road toward strange towers, water hides depths.',
    question: 'Which fears are intuitions twisted by old wounds—and which are real warnings to honor?'
  },
  19: {
    summary: 'Joy, happiness, clarity, vulnerability of being fully seen.',
    axis: 'Open Radiance vs Blinding Positivity',
    feel: 'Warmth in chest and face; shoulders drop as tension melts.',
    stance: 'Out in the open, visible; no curtains, no shadows.',
    scene: 'Child on a white horse beneath a huge sun, arms wide; wall crumbled to let light pour in.',
    question: 'Where could honest joy shine more—and where are you using positivity to avoid a harder truth?'
  },
  20: {
    summary: 'Decision, reflection, awakening, call to step out of old selves.',
    axis: 'Honest Reckoning vs Self-Crucifixion',
    feel: 'Shiver up the spine, like hearing your name from far and near at once.',
    stance: 'Among others who are also called; judged as part of a wider unfolding.',
    scene: 'Figures rise from open coffins as a horn sounds; terrified and relieved, seeing clearly.',
    question: 'If you answered the call to become who you secretly know you are, what life must you leave behind?'
  },
  21: {
    summary: 'Fulfillment, integration, completion, stillness at the end of a dance.',
    axis: 'Whole Integration vs Stagnant Arrival',
    feel: 'Wide, spacious ease; nothing urgent, ready to begin again.',
    stance: 'In harmony with many circles; not needing to be the center.',
    scene: 'Figure dances within a wreath, one foot about to step out; four elements watch as witnesses.',
    question: 'Now that you have arrived, what new journey are you willing to begin as a beginner again?'
  }
};

// Read the existing tarot-decks.json
const jsonPath = path.join(__dirname, '..', 'src', 'data', 'tarot-decks.json');
const tarotData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

// Add narrative to each card
tarotData.cards.forEach(card => {
  if (narratives[card.number]) {
    card.narrative = narratives[card.number];
  }
});

// Write back to file with proper formatting
fs.writeFileSync(jsonPath, JSON.stringify(tarotData, null, 2) + '\n');

console.log('✅ Added narratives to all 22 cards!');
console.log('✅ Updated:', jsonPath);
