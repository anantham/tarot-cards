# Tarot Card Style References

This folder contains style reference images organized by tarot card.

## Folder Structure

Each card has its own folder named: `card-{number}-{name}`

Examples:
- `card-00-fool/`
- `card-01-magician/`
- `card-21-world/`

## How to Add Style References

1. Create a folder for your card (e.g., `card-00-fool/`)
2. Add style reference images (PNG, JPG, WEBP)
3. Name them descriptively (e.g., `mystical-purple.jpg`, `vintage-golden.png`)

The app will automatically detect all images in each card's folder and let you browse through them.

## Supported Formats

- PNG
- JPG/JPEG
- WEBP
- GIF (first frame used)

## Example Structure

```
styles/
├── card-00-fool/
│   ├── mystical-purple.jpg
│   ├── vintage-art-nouveau.png
│   └── modern-minimalist.webp
├── card-01-magician/
│   ├── golden-ornate.jpg
│   └── dark-mystical.png
└── card-21-world/
    ├── celestial-blue.jpg
    └── earthy-green.png
```

## Usage

When generating a card:
1. Select the card number in settings
2. The style browser will show available styles for that card
3. Click through to preview different style options
4. Select your preferred style
5. It will be automatically added as a style reference with the appropriate instruction
