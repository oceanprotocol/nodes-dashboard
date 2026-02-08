import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    type: 'OAuth2',
    user: process.env.GRANT_GMAIL_ADDRESS,
    clientId: process.env.GRANT_GMAIL_OAUTH_CLIENT_ID,
    clientSecret: process.env.GRANT_GMAIL_OAUTH_CLIENT_SECRET,
    refreshToken: process.env.GRANT_GMAIL_OAUTH_REFRESH_TOKEN,
  },
});

export async function sendOTP(email: string, code: string) {
  const splitCode = `${code.slice(0, 3)} ${code.slice(3, 6)}`;
  const mailOptions = {
    from: process.env.GRANT_GMAIL_ADDRESS,
    to: email,
    subject: 'Verification Code for Ocean Network Grant',
    text: `Your verification code is: ${splitCode}`,
    html: `<p>Your verification code is: <strong>${splitCode}</strong></p>`,
  };
  try {
    await transporter.sendMail(mailOptions);
    console.log(`OTP sent to ${email}`);
  } catch (error) {
    console.error('Error sending email:', error);
    throw new Error('Failed to send OTP email');
  }
}
