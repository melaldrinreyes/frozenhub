# Email Setup Guide

The forgot password feature now includes email sending functionality using Resend.

## Option 1: Resend (Recommended)

### Why Resend?
- ✅ Free tier: 3,000 emails/month
- ✅ Simple API
- ✅ Great deliverability
- ✅ No credit card required for free tier
- ✅ Perfect for transactional emails

### Setup Steps:

1. **Sign up for Resend**
   - Go to https://resend.com
   - Click "Start Building"
   - Sign up with your email or GitHub

2. **Get your API Key**
   - After signing in, go to https://resend.com/api-keys
   - Click "Create API Key"
   - Give it a name (e.g., "FrozenHub POS Production")
   - Copy the API key (starts with `re_`)

3. **Verify your domain (Optional but recommended for production)**
   - Go to https://resend.com/domains
   - Click "Add Domain"
   - Follow the instructions to add DNS records
   - Once verified, you can send from `noreply@yourdomain.com`
   
   **Note:** For testing, you can use `onboarding@resend.dev` (default)

4. **Add to your local `.env` file**
   ```env
   RESEND_API_KEY=re_your_actual_api_key_here
   EMAIL_FROM=noreply@yourdomain.com
   APP_NAME=FrozenHub POS
   APP_URL=http://localhost:5173
   ```

5. **Add to Vercel Environment Variables**
   - Go to https://vercel.com/mykelskiee-gmailcoms-projects/frozenhub-pos/settings/environment-variables
   - Add these variables:
     - `RESEND_API_KEY` = `re_your_actual_api_key_here`
     - `EMAIL_FROM` = `noreply@yourdomain.com` (or `onboarding@resend.dev` for testing)
     - `APP_NAME` = `FrozenHub POS`
     - `APP_URL` = `https://frozenhub-pos.vercel.app`
   - Click "Save"

6. **Redeploy**
   ```bash
   vercel --prod
   ```

## Option 2: Gmail with Nodemailer (Alternative)

If you prefer to use Gmail instead:

### Setup Steps:

1. **Enable 2-Factor Authentication on your Gmail account**
   - Go to https://myaccount.google.com/security
   - Enable 2-Step Verification

2. **Create an App Password**
   - Go to https://myaccount.google.com/apppasswords
   - Select "Mail" and "Other (Custom name)"
   - Name it "FrozenHub POS"
   - Copy the 16-character password

3. **Install Nodemailer**
   ```bash
   pnpm add nodemailer @types/nodemailer
   ```

4. **Update `server/utils/email.ts`**
   - Comment out the Resend implementation
   - Uncomment the Nodemailer implementation at the bottom of the file

5. **Add to your `.env` file**
   ```env
   EMAIL_USER=your-email@gmail.com
   EMAIL_PASSWORD=your-16-char-app-password
   APP_NAME=FrozenHub POS
   APP_URL=http://localhost:5173
   ```

6. **Add to Vercel Environment Variables**
   - `EMAIL_USER` = your Gmail address
   - `EMAIL_PASSWORD` = your 16-character app password
   - `APP_NAME` = `FrozenHub POS`
   - `APP_URL` = `https://frozenhub-pos.vercel.app`

**Note:** Gmail has a daily sending limit of ~500 emails/day for free accounts.

## Testing Locally

1. Add your API key to `.env`
2. Restart your dev server: `pnpm dev`
3. Try the forgot password feature
4. Check your email inbox (and spam folder)

## Troubleshooting

### Email not received?
1. Check spam/junk folder
2. Verify API key is correct
3. Check server logs for errors
4. For Resend: Verify your domain is set up correctly
5. For Gmail: Ensure 2FA is enabled and app password is correct

### Still using console logs?
- If `RESEND_API_KEY` is not set, the system falls back to console logging
- In development, the token will also be returned in the API response
- Check your server terminal for the token

### Email sending fails in production?
- Verify environment variables are set in Vercel
- Check Vercel function logs for errors
- Ensure your Resend account is active
- Check your email sending quota

## Email Template Customization

The email template is in `server/utils/email.ts`. You can customize:
- Colors and styling
- Logo (add your company logo)
- Text content
- Footer information
- Support contact details

## Production Checklist

- [ ] Resend API key added to Vercel
- [ ] Domain verified in Resend (optional but recommended)
- [ ] `EMAIL_FROM` set to your domain email
- [ ] `APP_URL` set to your production URL
- [ ] `APP_NAME` set to your app name
- [ ] Test email sending in production
- [ ] Check spam score of emails (use mail-tester.com)
- [ ] Monitor email delivery rates in Resend dashboard

## Support

- Resend Documentation: https://resend.com/docs
- Resend Support: support@resend.com
- Nodemailer Documentation: https://nodemailer.com/
