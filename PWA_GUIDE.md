# PWA (Progressive Web App) Guide

Your FrozenHub POS is now a Progressive Web App! 🎉

## What is a PWA?

A PWA is a web app that can be installed on devices and works like a native app with:
- ✅ Install on home screen (mobile & desktop)
- ✅ Offline support
- ✅ Faster loading with caching
- ✅ App-like fullscreen experience
- ✅ Push notifications (future feature)

## Features Enabled

### 1. **Installable**
Users can install your app on their device:
- **Mobile**: "Add to Home Screen" prompt
- **Desktop**: Install button in browser address bar

### 2. **Offline Support**
The app caches assets and works offline:
- Static files (JS, CSS, images) are cached
- API responses are cached for 5 minutes
- Fonts are cached for 1 year

### 3. **Auto-Update**
Service worker automatically updates when you deploy new versions

### 4. **Install Prompt**
Custom install prompt appears for users who haven't installed yet

## How to Test

### On Desktop (Chrome/Edge):
1. Open https://frozenhub-pos.vercel.app
2. Look for install icon (⊕) in address bar
3. Click it to install
4. App opens in its own window

### On Mobile (Android):
1. Open https://frozenhub-pos.vercel.app in Chrome
2. Tap the menu (⋮)
3. Tap "Install app" or "Add to Home Screen"
4. App appears on home screen

### On Mobile (iOS):
1. Open https://frozenhub-pos.vercel.app in Safari
2. Tap the Share button
3. Tap "Add to Home Screen"
4. App appears on home screen

## PWA Icons

You need to create app icons:

### Required Files (in `/public` folder):
- `icon-192.png` - 192x192 pixels
- `icon-512.png` - 512x512 pixels

### How to Create:
1. Use https://realfavicongenerator.net/
2. Upload your logo
3. Download generated icons
4. Place in `/public` folder

See `CREATE_ICONS.md` for detailed instructions.

## Caching Strategy

### Static Assets (JS, CSS, Images):
- **Strategy**: Cache First
- **Fallback**: Network if cache fails
- **Updates**: Automatic on new deployment

### API Calls (`/api/*`):
- **Strategy**: Network First
- **Fallback**: Cache if network fails (5 min cache)
- **Timeout**: 10 seconds

### Fonts (Google Fonts):
- **Strategy**: Cache First
- **Cache Duration**: 1 year
- **Updates**: Only when font changes

## Offline Behavior

### What Works Offline:
- ✅ View cached pages
- ✅ Browse previously loaded products
- ✅ View cached data
- ✅ UI remains functional

### What Doesn't Work Offline:
- ❌ Login/Signup (requires server)
- ❌ New data fetching
- ❌ Creating orders
- ❌ Real-time updates

## Customization

### Change Theme Color:
Edit `vite.config.ts`:
```typescript
theme_color: '#667eea', // Your brand color
```

### Change App Name:
Edit `vite.config.ts`:
```typescript
name: 'Your App Name',
short_name: 'Short Name',
```

### Adjust Cache Duration:
Edit `vite.config.ts` → `workbox.runtimeCaching`

## Testing PWA Features

### Check PWA Score:
1. Open Chrome DevTools (F12)
2. Go to "Lighthouse" tab
3. Select "Progressive Web App"
4. Click "Generate report"
5. Aim for 100% score

### Test Offline:
1. Open Chrome DevTools (F12)
2. Go to "Network" tab
3. Select "Offline" from dropdown
4. Reload page - should still work!

### View Service Worker:
1. Open Chrome DevTools (F12)
2. Go to "Application" tab
3. Click "Service Workers"
4. See status and cache

## Deployment

PWA features work automatically on Vercel:
```bash
vercel --prod
```

The service worker and manifest are generated during build.

## Browser Support

### Full Support:
- ✅ Chrome (Desktop & Mobile)
- ✅ Edge (Desktop & Mobile)
- ✅ Samsung Internet
- ✅ Opera

### Partial Support:
- ⚠️ Safari (iOS) - No install prompt, manual "Add to Home Screen"
- ⚠️ Firefox - Limited PWA features

### No Support:
- ❌ Internet Explorer

## Troubleshooting

### Install prompt doesn't appear?
- Clear browser cache
- Make sure you're on HTTPS (localhost or deployed)
- Check if already installed
- Try incognito/private mode

### Service worker not updating?
- Hard refresh (Ctrl+Shift+R)
- Clear site data in DevTools
- Unregister old service worker

### Icons not showing?
- Make sure `icon-192.png` and `icon-512.png` exist in `/public`
- Clear cache and reinstall
- Check browser console for errors

## Future Enhancements

Possible PWA features to add:
- 📲 Push notifications for orders
- 🔄 Background sync for offline orders
- 📊 Periodic background sync for data
- 🎯 Web Share API for sharing products
- 📸 Camera API for barcode scanning

## Resources

- [PWA Documentation](https://web.dev/progressive-web-apps/)
- [Vite PWA Plugin](https://vite-pwa-org.netlify.app/)
- [Workbox Documentation](https://developers.google.com/web/tools/workbox)
- [PWA Builder](https://www.pwabuilder.com/)
