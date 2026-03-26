import nodemailer from 'nodemailer';
import { Sale } from '@/types/database';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  tls: {
    rejectUnauthorized: false
  }
});

interface SendInvoiceEmailParams {
  to: string;
  invoiceData: Sale;  // ✅ Cambiado de InvoiceData a Sale
  pdfBuffer: Buffer;
  xmlContent?: string;
}

export async function sendInvoiceEmail({
  to,
  invoiceData,
  pdfBuffer,
  xmlContent
}: SendInvoiceEmailParams) {
  // ✅ Adaptar campos de Sale a lo que necesitas
  const documentNumber = invoiceData.document_number || '000-000-0000000';
  const [establishment, emissionPoint, sequential] = documentNumber.split('-');
  
  const subject = `Factura ${documentNumber} - Taller Motorcito`;
  const html = generateInvoiceEmailTemplate(invoiceData);

  const attachments: any[] = [
    {
      filename: `FACTURA-${sequential || '0000000'}.pdf`,
      content: pdfBuffer,
      contentType: 'application/pdf'
    }
  ];

  if (xmlContent) {
    attachments.push({
      filename: `FACTURA-${sequential || '0000000'}.xml`,
      content: xmlContent,
      contentType: 'application/xml'
    });
  }

  try {
    const info = await transporter.sendMail({
      from: `"Taller Motorcito" <${process.env.SMTP_USER}>`,
      to,
      subject,
      html,
      attachments
    });

    await logEmailSent(invoiceData.id, to, info.messageId);
    
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Error enviando email:', error);
    throw error;
  }
}

// ✅ Adaptar template a campos de Sale
function generateInvoiceEmailTemplate(data: Sale): string {
  const documentNumber = data.document_number || '000-000-0000000';
  const [establishment, emissionPoint, sequential] = documentNumber.split('-');
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #2563eb; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; }
        .footer { text-align: center; color: #6b7280; font-size: 12px; margin-top: 20px; }
        .button { background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin: 20px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>¡Gracias por su preferencia!</h1>
        </div>
        <div class="content">
          <p>Estimado <strong>${data.customer_name}</strong>,</p>
          <p>Adjuntamos la factura de su servicio:</p>
          <ul>
            <li><strong>Número:</strong> ${documentNumber}</li>
            <li><strong>Fecha:</strong> ${new Date(data.created_at).toLocaleDateString('es-EC')}</li>
            <li><strong>Total:</strong> $${data.total.toFixed(2)}</li>
          </ul>
          <p>Si tiene alguna pregunta sobre su servicio, no dude en contactarnos.</p>
          <a href="mailto:${process.env.SMTP_USER}" class="button">Contactar al Taller</a>
        </div>
        <div class="footer">
          <p>Taller Motorcito - Servicio técnico especializado</p>
          <p>Este correo se ha enviado automáticamente desde nuestro sistema.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

// ... todo el código anterior ...

async function logEmailSent(invoiceId: string, to: string, messageId: string) {
  const { createClient } = await import('@/lib/supabase-server');
  const supabase = await createClient();

  await supabase.from('invoice_emails').insert({
    invoice_id: invoiceId,
    sent_to: to,
    message_id: messageId,
    sent_at: new Date().toISOString(),
    status: 'sent'
  });
}