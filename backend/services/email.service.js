const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD
  }
});

async function sendVerificationEmail(email, username, token) {
  const verifyUrl = `${process.env.FRONTEND_URL}/verify/${token}`;
  
  await transporter.sendMail({
    from: `"VTT" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: '✅ Verifica tu cuenta en VTT',
    html: `
      <h2>¡Bienvenido a VTT, ${username}!</h2>
      <p>Haz clic en el siguiente enlace para verificar tu cuenta:</p>
      <a href="${verifyUrl}" style="
        background: #3b82f6;
        color: white;
        padding: 12px 24px;
        border-radius: 6px;
        text-decoration: none;
        display: inline-block;
        margin: 16px 0;
      ">Verificar cuenta</a>
      <p>Si no creaste esta cuenta, ignora este email.</p>
      <p>El enlace expira en 24 horas.</p>
    `
  });
}

module.exports = { sendVerificationEmail };