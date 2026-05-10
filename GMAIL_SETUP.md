# Gmail Setup for Password Reset Emails

## Quick Setup (5 Minutes)

### Step 1: Enable 2-Factor Authentication

1. Go to https://myaccount.google.com/security
2. Scroll to "How you sign in to Google"
3. Click on "2-Step Verification"
4. Follow the prompts to enable it (you'll need your phone)

### Step 2: Create App Password

1. Go to https://myaccount.google.com/apppasswords
   - Or: Google Account → Security → 2-Step Verification → App passwords
2. You might need to sign in again
3. In "Select app" dropdown, choose **"Mail"**
4. In "Select device" dropdown, choose **"Other (Custom name)"**
5. Type: **"FrozenHub POS"**
6. Click **"Generate"**
7. **Copy the 16-character password** (looks like: `abcd efgh ijkl mnop`)
   - Remove the spaces: `abcdefghijklmnop`

### Step 3: Add to `.env` File

Open your `.env` file and update:

```env
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=abcdefghijklmnop
```

Replace:
- `your-email@gmail.com` with your actual Gmail address
- `abcdefghijklmnop` with your 16-character app password (no spaces)

### Step 4: Restart and Test

1. **Restart your dev server**:
   ```bash
   # Stop the server (Ctrl+C)
   pnpm dev
   ```

2. **Test the feature**:
   - Go to your app
   - Click "Forgot password?"
   - Enter ANY email address (not just yours!)
   - Check the inbox

✅ **It should work now!**

## Troubleshooting

### "Invalid login" error?
- Make sure 2FA is enabled
- Make sure you're using the App Password, not your regular Gmail password
- Remove any spaces from the app password

### Still not working?
- Check if "Less secure app access" is disabled (it should be)
- Make sure you copied the complete 16-character password
- Try generating a new app password

### Email goes to spam?
- This is normal for the first few emails
- Mark it as "Not Spam"
- Future emails should go to inbox

## Gmail Limits

- **Free Gmail**: ~500 emails/day
- **Google Workspace**: ~2,000 emails/day

Perfect for most applications!

## For Production (Vercel)

Add these to Vercel environment variables:
- `EMAIL_USER` = your Gmail address
- `EMAIL_PASSWORD` = your 16-character app password
- `APP_NAME` = FrozenHub POS
- `APP_URL` = https://frozenhub-pos.vercel.app

Then redeploy:
```bash
vercel --prod
```

## Security Notes

- ✅ App passwords are safer than your main password
- ✅ You can revoke them anytime
- ✅ They only work for the specific app
- ⚠️ Never share your app password
- ⚠️ Don't commit it to Git (it's in `.gitignore`)
