# Skillancer Documentation Static Assets

This directory contains static assets for the Skillancer documentation site.

## Required Assets

The following assets should be added to this directory:

### Logo

- `img/logo.svg` - Main logo for navbar (recommended: 32x32px or scalable SVG)
- `img/logo-dark.svg` - Logo variant for dark mode (optional)

### Favicon

- `img/favicon.ico` - Favicon for browser tabs (16x16, 32x32, 48x48)
- `img/favicon-32x32.png` - PNG favicon
- `img/apple-touch-icon.png` - iOS home screen icon (180x180px)

### Social Media

- `img/social-card.png` - Open Graph image for social sharing (1200x630px recommended)

### Diagrams

Place any architecture diagrams or images in `img/diagrams/`.

## Placeholder Logo

Until a proper logo is created, you can use a text-based placeholder in the navbar by configuring `docusaurus.config.js`:

```javascript
navbar: {
  title: 'Skillancer',
  // logo: {
  //   alt: 'Skillancer Logo',
  //   src: 'img/logo.svg',
  // },
}
```

## Generating Favicons

Use a tool like [RealFaviconGenerator](https://realfavicongenerator.net/) to generate all required favicon formats from a single source image.

## Image Optimization

Before adding images:

1. Compress PNGs with tools like TinyPNG
2. Use SVG for logos and icons when possible
3. Use WebP format for photos with PNG fallback
