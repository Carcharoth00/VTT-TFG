const nodemailer = require('nodemailer');
const Brevo = require('@getbrevo/brevo');

async function sendVerificationEmail(email, username, token) {
  const verifyUrl = `${process.env.FRONTEND_URL}/verify/${token}`;
  const html = `
    <h2>¡Bienvenido a VTT, ${username}!</h2>
    <p>Haz clic en el siguiente enlace para verificar tu cuenta:</p>
    <a href="${verifyUrl}" style="background:#3b82f6;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block;margin:16px 0;">Verificar cuenta</a>
    <p>El enlace expira en 24 horas.</p>
  `;

  if (process.env.NODE_ENV === 'production') {
    const defaultClient = Brevo.ApiClient.instance;
    defaultClient.authentications['api-key'].apiKey = process.env.BREVO_API_KEY;
    
    const apiInstance = new Brevo.TransactionalEmailsApi();
    const sendSmtpEmail = new Brevo.SendSmtpEmail();
    
    sendSmtpEmail.sender = { email: 'pmontesm@gamil.com', name: 'VTT' };
    sendSmtpEmail.to = [{ email }];
    sendSmtpEmail.subject = '✅ Verifica tu cuenta en VTT';
    sendSmtpEmail.htmlContent = html;
    
    await apiInstance.sendTransacEmail(sendSmtpEmail);
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