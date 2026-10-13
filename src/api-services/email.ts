import { getSubsidyOtpEmailTemplate } from '@/templates/subsidy-otp-email';
import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    type: 'OAuth2',
    user: process.env.SUBSIDY_GMAIL_ADDRESS,
    clientId: process.env.SUBSIDY_GMAIL_OAUTH_CLIENT_ID,
    clientSecret: process.env.SUBSIDY_GMAIL_OAUTH_CLIENT_SECRET,
    refreshToken: process.env.SUBSIDY_GMAIL_OAUTH_REFRESH_TOKEN,
  },
});

export async function sendOTP(email: string, code: string) {
  const splitCode = `${code.slice(0, 3)} ${code.slice(3, 6)}`;
  const mailOptions = {
    from: process.env.SUBSIDY_GMAIL_ADDRESS,
    to: email,
    subject: 'Verification Code for Ocean Network Subsidy',
    // text: `Your verification code is: ${splitCode}`,
    html: getSubsidyOtpEmailTemplate({ otp: splitCode }),
  };
  try {
    await transporter.sendMail(mailOptions);
  } catch (error) {
    console.error('Error sending email:', error);
    throw new Error('Failed to send OTP email');
  }
}
