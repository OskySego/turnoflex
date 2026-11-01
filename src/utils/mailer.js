import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER, // Tu correo de Gmail
    pass: process.env.EMAIL_PASS  // Tu "Contraseña de Aplicación" de Google
  }
});

export const sendRecordatorio = async (emailDestino, nombreCliente, fecha, hora, profesional) => {
  const mailOptions = {
    from: `"Clínica TurnoFlex" <${process.env.EMAIL_USER}>`,
    to: emailDestino,
    subject: '⏰ Recordatorio de su turno para mañana',
    html: `
      <div style="font-family: Arial, sans-serif; padding: 20px; color: #333; max-width: 600px; margin: auto;">
        <h2 style="color: #0D1B3E;">¡Hola, ${nombreCliente}!</h2>
        <p>Le escribimos para recordarle que tiene un turno programado para el día de mañana.</p>
        
        <div style="background-color: #f8f9fa; padding: 15px; border-left: 4px solid #0d6efd; border-radius: 5px; margin: 20px 0;">
          <p style="margin: 5px 0;"><strong>👨‍⚕️ Profesional:</strong> ${profesional}</p>
          <p style="margin: 5px 0;"><strong>📅 Fecha:</strong> ${fecha}</p>
          <p style="margin: 5px 0;"><strong>⏰ Hora:</strong> ${hora} hs</p>
        </div>

        <p>Por favor, si no puede asistir, recuerde cancelar su turno comunicándose con la clínica.</p>
        <p>Saludos cordiales,<br><strong>El equipo de TurnoFlex</strong></p>
      </div>
    `
  };
  
  return transporter.sendMail(mailOptions);
};