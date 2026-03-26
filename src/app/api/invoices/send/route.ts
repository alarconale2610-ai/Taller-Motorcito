import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { createClient } from '@/lib/supabase-server';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: Number(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  tls: { rejectUnauthorized: false }
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { 
      tempId,
      invoiceId,
      documentNumber, 
      customerEmail, 
      customerName,
      items, 
      total, 
      subtotal, 
      iva, 
      branchConfig,
      htmlContent: htmlContentFromBody
    } = body;

    if (!tempId) {
      return NextResponse.json({ error: 'Falta tempId' }, { status: 400 });
    }

    if (!customerEmail || !documentNumber) {
      return NextResponse.json({ error: 'Faltan datos requeridos' }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    let htmlContent: string;

    if (htmlContentFromBody && htmlContentFromBody.length > 100) {
      htmlContent = htmlContentFromBody;
    } else {
      const { data: htmlData, error: htmlError } = await supabase
        .from('invoice_html_temp')
        .select('html_content, invoice_id')
        .eq('id', tempId)
        .single();

      if (htmlError || !htmlData) {
        return NextResponse.json({ 
          error: 'HTML no encontrado o expirado. Regenere la factura.' 
        }, { status: 404 });
      }

      htmlContent = htmlData.html_content;
    }

    const info = await transporter.sendMail({
      from: `"${branchConfig?.company_name || 'Taller Motorcito'}" <${process.env.SMTP_USER}>`,
      to: customerEmail,
      subject: `Factura ${documentNumber} - ${branchConfig?.company_name || 'Taller Motorcito'}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 800px; margin: 0 auto; padding: 20px; }
            .header { background: #2563eb; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; }
            .invoice-box { background: white; border: 2px solid #000; padding: 20px; margin: 20px 0; }
            .footer { text-align: center; color: #666; font-size: 12px; margin-top: 20px; }
            @media print { .no-print { display: none; } }
          </style>
        </head>
        <body>
          <div class="header no-print">
            <h1>¡Gracias por su preferencia!</h1>
            <p>${branchConfig?.company_name || 'Taller Motorcito'}</p>
          </div>
          
          <div class="content no-print">
            <p>Estimado <strong>${customerName || 'Cliente'}</strong>,</p>
            <p>Su factura <strong>${documentNumber}</strong> está lista.</p>
            <p><strong>Total: $${total?.toFixed(2)}</strong></p>
          </div>

          <div class="invoice-box">
            ${htmlContent}
          </div>
          
          <div class="footer">
            <p>${branchConfig?.company_name || 'Taller Motorcito'}</p>
            <p>Documento autorizado mediante resolución del SRI</p>
          </div>
        </body>
        </html>
      `
    });

    await supabase.from('email_logs').insert({
      invoice_id: invoiceId,
      recipient: customerEmail,
      subject: `Factura ${documentNumber}`,
      message_id: info.messageId,
      sent_by: user.id,
      status: 'sent',
      sent_at: new Date().toISOString()
    });

    await supabase.from('invoice_html_temp').delete().eq('id', tempId);

    return NextResponse.json({ 
      success: true, 
      messageId: info.messageId,
      message: 'Factura enviada correctamente'
    });

  } catch (error: any) {
    return NextResponse.json({ 
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }, { status: 500 });
  }
}