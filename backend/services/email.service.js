const nodemailer = require('nodemailer');
const SibApiV3Sdk = require('@getbrevo/brevo');

async function sendVerificationEmail(email, username, token) {
  const verifyUrl = `${process.env.FRONTEND_URL}/verify/${token}`;
  const html = `
    <h2>¡Bienvenido a VTT, ${username}!</h2>
    <p>Haz clic en el siguiente enlace para verificar tu cuenta:</p>
    <a href="${verifyUrl}" style="background:#3b82f6;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block;margin:16px 0;">Verificar cuenta</a>
    <p>El enlace expira en 24 horas.</p>
  `;

  if (process.env.NODE_ENV === 'production') {
    const apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();
    apiInstance.authentications['apiKey'].apiKey = process.env.BREVO_API_KEY;

    await apiInstance.sendTransacEmail({
      sender: { email: 'noreply@vtt-tfg.com', name: 'VTT' },
      to: [{ email }],
      subject: '✅ Verifica tu cuenta en VTT',
      htmlContent: html
    });
  } else {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD
      }
    });
    await transporter.sendMail({
      from: `"VTT" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: '✅ Verifica tu cuenta en VTT',
      html
    });
  }
}

module.exports = { sendVerificationEmail };