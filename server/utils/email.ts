import { Resend } from 'resend';
import nodemailer from 'nodemailer';

// Lazy initialize Resend to avoid build-time errors
let resendInstance: Resend | null = null;
const getResend = () => {
  if (!resendInstance && process.env.RESEND_API_KEY) {
    resendInstance = new Resend(process.env.RESEND_API_KEY);
  }
  return resendInstance;
};

interface SendPasswordResetEmailParams {
  to: string;
  token: string;
  userName: string;
}

// Gmail/SMTP Transporter
const createTransporter = () => {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
    return null;
  }

  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD, // Use App Password, not regular password
    },
  });
};

export async function sendPasswordResetEmail({
  to,
  token,
  userName,
}: SendPasswordResetEmailParams): Promise<{ success: boolean; error?: string }> {
  const appName = process.env.APP_NAME || 'FrozenHub POS';
  const appUrl = process.env.APP_URL || 'https://frozenhub-pos.vercel.app';

  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Password Reset</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 28px;">${appName}</h1>
        </div>
        
        <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #ddd; border-top: none;">
          <h2 style="color: #333; margin-top: 0;">Password Reset Request</h2>
          
          <p>Hi ${userName},</p>
          
          <p>We received a request to reset your password. Use the token below to reset your password:</p>
          
          <div style="background: white; border: 2px dashed #667eea; border-radius: 8px; padding: 20px; margin: 25px 0; text-align: center;">
            <p style="margin: 0 0 10px 0; color: #666; font-size: 14px;">Your Reset Token:</p>
            <p style="font-size: 32px; font-weight: bold; color: #667eea; letter-spacing: 4px; margin: 0; font-family: 'Courier New', monospace;">
              ${token}
            </p>
          </div>
          
          <p style="margin: 20px 0;">
            <strong>How to reset your password:</strong>
          </p>
          <ol style="padding-left: 20px;">
            <li>Go to the login page at <a href="${appUrl}" style="color: #667eea;">${appUrl}</a></li>
            <li>Click on "Forgot password?"</li>
            <li>Click on "Have a reset token?"</li>
            <li>Enter the token above</li>
            <li>Set your new password</li>
          </ol>
          
          <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; border-radius: 4px;">
            <p style="margin: 0; color: #856404;">
              <strong>⚠️ Security Notice:</strong><br>
              This token will expire in <strong>1 hour</strong>. If you didn't request this password reset, please ignore this email or contact support if you have concerns.
            </p>
          </div>
          
          <p style="color: #666; font-size: 14px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd;">
            If you have any questions, please contact our support team.<br>
            <br>
            Best regards,<br>
            The ${appName} Team
          </p>
        </div>
        
        <div style="text-align: center; margin-top: 20px; color: #999; font-size: 12px;">
          <p>This is an automated email. Please do not reply to this message.</p>
        </div>
      </body>
    </html>
  `;

  const textContent = `
Password Reset Request - ${appName}

Hi ${userName},

We received a request to reset your password. Use the token below to reset your password:

Your Reset Token: ${token}

How to reset your password:
1. Go to the login page at ${appUrl}
2. Click on "Forgot password?"
3. Click on "Have a reset token?"
4. Enter the token above
5. Set your new password

⚠️ Security Notice:
This token will expire in 1 hour. If you didn't request this password reset, please ignore this email or contact support if you have concerns.

If you have any questions, please contact our support team.

Best regards,
The ${appName} Team

---
This is an automated email. Please do not reply to this message.
  `.trim();

  // Try Gmail/SMTP first (if configured)
  const transporter = createTransporter();
  if (transporter) {
    try {
      console.log('📧 Sending email via Gmail/SMTP...');
      await transporter.sendMail({
        from: `"${appName}" <${process.env.EMAIL_USER}>`,
        to,
        subject: `Password Reset Request - ${appName}`,
        html: htmlContent,
        text: textContent,
      });

      console.log('✅ Password reset email sent successfully via Gmail');
      return { success: true };
    } catch (error) {
      console.error('❌ Gmail/SMTP email sending error:', error);
      // Fall through to try Resend
    }
  }

  // Try Resend as fallback
  const resend = getResend();
  if (resend) {
    try {
      console.log('📧 Sending email via Resend...');
      const fromEmail = process.env.EMAIL_FROM || 'onboarding@resend.dev';

      const { data, error } = await resend.emails.send({
        from: fromEmail,
        to: [to],
        subject: `Password Reset Request - ${appName}`,
        html: htmlContent,
        text: textContent,
      });

      if (error) {
        console.error('❌ Resend email sending error:', error);
        return { success: false, error: error.message };
      }

      console.log('✅ Password reset email sent successfully via Resend:', data);
      return { success: true };
    } catch (error) {
      console.error('❌ Unexpected Resend error:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  // No email service configured
  console.warn('⚠️  No email service configured. Email not sent.');
  console.log(`📧 Password reset token for ${to}: ${token}`);
  return { success: false, error: 'Email service not configured' };
}
