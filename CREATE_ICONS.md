# Create PWA Icons

Your PWA needs icons in the `public` folder. Here's how to create them:

## Option 1: Use an Online Tool (Easiest)

1. **Go to**: https://realfavicongenerator.net/ or https://www.pwabuilder.com/imageGenerator
2. **Upload your logo** (any size, preferably square)
3. **Download the generated icons**
4. **Copy these files to `/public` folder**:
   - `icon-192.png` (192x192 pixels)
   - `icon-512.png` (512x512 pixels)

## Option 2: Use Your Logo

If you have a logo file:

1. Open it in an image editor (Photoshop, GIMP, Canva, etc.)
2. Resize to 192x192 pixels → Save as `icon-192.png`
3. Resize to 512x512 pixels → Save as `icon-512.png`
4. Place both files in the `/public` folder

## Option 3: Create a Simple Icon

Use this simple design:

**For now, I've created placeholder files. Replace them with:**

### Quick Design Ideas:
- Company initials "BPB" on colored background
- Snowflake icon (for frozen foods)
- Shopping cart icon
- Your company logo

### Icon Requirements:
- **Format**: PNG
- **Sizes**: 192x192 and 512x512 pixels
- **Background**: Solid color or transparent
- **Design**: Simple, recognizable at small sizes

## Temporary Solution

Until you create proper icons, the app will use the default browser icon. The PWA will still work, but won't look as professional when installed.

## After Creating Icons:

1. Place `icon-192.png` and `icon-512.png` in `/public` folder
2. Restart dev server: `pnpm dev`
3. Test the install prompt on mobile/desktop
