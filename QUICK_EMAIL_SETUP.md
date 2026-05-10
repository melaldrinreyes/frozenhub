# Quick Email Setup (5 Minutes)

## 🚀 Get Email Working in 5 Minutes

### Step 1: Sign up for Resend (2 minutes)
1. Go to https://resend.com
2. Click "Start Building"
3. Sign up (free, no credit card needed)

### Step 2: Get API Key (1 minute)
1. Go to https://resend.com/api-keys
2. Click "Create API Key"
3. Name it "FrozenHub POS"
4. Copy the key (starts with `re_`)

### Step 3: Add to Local Environment (1 minute)
Open `.env` file and add your API key:
```env
RESEND_API_KEY=re_your_actual_key_here
```

### Step 4: Test Locally (1 minute)
1. Restart dev server: `pnpm dev`
2. Try forgot password feature
3. Check your email!

### Step 5: Deploy to Production
1. Add to Vercel:
   - Go to https://vercel.com/mykelskiee-gmailcoms-projects/frozenhub-pos/settings/environment-variables
   - Add `RESEND_API_KEY` = your key
   - Add `EMAIL_FROM` = `onboarding@resend.dev`
   - Add `APP_NAME` = `FrozenHub POS`
   - Add `APP_URL` = `https://frozenhub-pos.vercel.app`

2. Redeploy:
   ```bash
   vercel --prod
   ```

## ✅ Done!

Your forgot password feature now sends real emails!

### Free Tier Limits
- 3,000 emails/month
- 100 emails/day
- Perfect for most applications

### Need More Details?
See `EMAIL_SETUP.md` for complete documentation.
