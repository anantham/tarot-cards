# Tarot Cards - See Yourself in the 22 Arcana

An interactive tarot card generator inspired by **Lord of the Mysteries**, where you can see yourself depicted in all 22 Major Arcana positions—just like Emperor Roselle's legendary cards.

## 🎴 Concept

Inspired by the web novel *Lord of the Mysteries*, where Emperor Roselle created tarot cards depicting himself in each divine pathway (The Fool, Black Emperor, Red Priest, etc.), this project brings that concept to life.

### Your Personal Tarot Deck

Generate a complete set of 22 animated tarot cards featuring **you** as the protagonist in each archetypal role:

- **Default**: Pre-filled with Aditya's personal journey through 22 life roles and vocations
- **Customizable**: Upload your own photo to generate your personalized deck
- **Multiple Traditions**: Choose from Lord of the Mysteries pathways, traditional Rider-Waite, Egyptian, Celtic, or Shinto interpretations

### Card Features

Each card includes:

1. **AI-Generated Imagery**: Your photo composed into the tarot archetype
2. **Animated GIFs**: 4-6 frame animations like shiny Pokémon cards
3. **Personal Lore**: Custom narrative about what that archetype means in your life
4. **Multiple Interpretations**: Switch between cultural/spiritual traditions
5. **Customizable Prompts**: Full control over the AI generation style

## ✨ Experience

### 3D Shuffled Deck Visualization

Cards float in 3D space like a mystical deck in motion:

- **Dynamic Shuffling**: Wild, chaotic animations where you glimpse individual cards
- **Floating & Drifting**: Cards gently bob and rotate in 3D space
- **Hover Interactions**: Cards orient toward you and whisper keywords
- **Touch Controls**: Full 3D experience on mobile with gesture support

### Card Interaction Flow

1. **Shuffled deck** floating dramatically in 3D space
2. **Pick/click a card** to select it
3. **Card flips and expands** with smooth animations
4. **View full details**: Animated GIF, lore, keywords, meanings, abilities

## 🛠️ Technical Stack

- **Frontend**: React + TypeScript + Vite
- **3D Graphics**: Three.js + React Three Fiber + Drei
- **Animations**: Framer Motion
- **State Management**: Zustand with persistence
- **AI Generation**: OpenRouter API (Gemini Pro, GPT-4o Mini, etc.)
- **Image Processing**: Custom GIF generation from multiple frames

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- OpenRouter API key ([get one here](https://openrouter.ai/keys))

### Installation

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

The app will open at http://localhost:3000

### Configuration

1. Click the **Settings** button (⚙️) in the top right
2. Add your OpenRouter API key
3. Upload your photo
4. Choose your preferred deck type
5. Customize generation settings

## 📖 Using the Generator

### Test Before Generating All

1. Open **Settings** (⚙️ button in header)
2. Upload your photo
3. Choose a deck type (Lord of the Mysteries recommended!)
4. Adjust frames per card (4-6 recommended)
5. **Generate ONE card first** to test your photo and prompt
6. Refine as needed, then generate all 22

### Cost Estimation

The app shows estimated costs:
- ~$0.05 per image (varies by model)
- 4 frames × 22 cards = 88 images = ~$4.40 for full deck
- Test single card first: ~$0.20

## 🎭 Deck Types

### Lord of the Mysteries (Recommended)
22 Beyonder pathways from the novel, depicting divine sequences and cosmic powers

### Traditional Rider-Waite
Classic tarot symbolism with historical accuracy

### Egyptian Tarot
Ancient Egyptian deities and mythology

### Celtic Tarot
Celtic gods, goddesses, and druidic wisdom

### Japanese Shinto
Kami spirits and Japanese spiritual traditions

## 📝 Customization Guide

All card data is in `src/data/tarot-decks.json`:

```json
{
  "number": 0,
  "personalLore": "FILL THIS: Your story for this card...",
  "lordOfMysteries": {
    "pathway": "Fool Pathway",
    "prompt": "Your custom prompt for AI generation..."
  }
}
```

### Personalizing Your Deck

1. Open `src/data/tarot-decks.json`
2. Find each card's `personalLore` field (marked "FILL THIS:")
3. Write your personal story for that archetype
4. (Optional) Customize the `prompt` field to change visual style
5. Save and regenerate cards with your stories

## 🌟 Features

- ✅ Full 3D card deck visualization with touch controls
- ✅ 5 different cultural/spiritual tarot interpretations
- ✅ AI-powered image generation with your photo
- ✅ Animated GIF creation (shiny card effect)
- ✅ Persistent caching of generated cards
- ✅ Cost estimation before generation
- ✅ Test single card before generating all 22
- ✅ Fully customizable prompts and lore
- ✅ Responsive design for desktop and mobile

## 🎯 Roadmap

- [ ] Implement actual GIF encoding (currently using first frame)
- [ ] Add more AI model options
- [ ] Share individual cards on social media
- [ ] Export deck as PDF or image pack
- [ ] AR mode for viewing cards in physical space
- [ ] Minor Arcana support (56 additional cards)
- [ ] Community deck sharing

## 🏗️ Project Structure

```
tarot-cards/
├── src/
│   ├── components/        # React components
│   │   ├── CardDeck.tsx   # 3D floating card visualization
│   │   ├── CardDetail.tsx # Expanded card view
│   │   ├── Header.tsx     # App header
│   │   └── Settings.tsx   # Settings panel
│   ├── data/              # Card data
│   │   └── tarot-decks.json  # All 22 cards × 5 interpretations
│   ├── hooks/             # Custom React hooks
│   │   └── useCardGeneration.ts
│   ├── store/             # Zustand state management
│   │   └── useStore.ts
│   ├── types/             # TypeScript types
│   │   └── index.ts
│   ├── utils/             # Utilities
│   │   ├── imageGeneration.ts  # OpenRouter API integration
│   │   └── gifGenerator.ts     # GIF creation
│   ├── App.tsx            # Main app component
│   ├── main.tsx           # Entry point
│   └── index.css          # Global styles
├── public/                # Static assets
├── package.json
├── vite.config.ts
└── README.md
```

## 🤝 Contributing

This is a personal project, but suggestions are welcome! Open an issue or submit a pull request.

## 📜 License

ISC

---

_"I am both The Fool and The World—the journey and the destination."_

Inspired by **Lord of the Mysteries** by Cuttlefish That Loves Diving
Built with ❤️ by Aditya
