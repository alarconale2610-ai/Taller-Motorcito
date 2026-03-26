import puppeteer from 'puppeteer';
import { renderToString } from 'react-dom/server';
import { FacturaSRI } from '@/components/documents/FacturaSRI';
import { createElement } from 'react';

export async function generateInvoicePDF(invoiceData: any): Promise<Buffer> {
  // Adaptar los datos al formato que espera FacturaSRI
  const props = {
    order: invoiceData.order || invoiceData,
    customer: invoiceData.customer || null,
    vehicle: invoiceData.vehicle || undefined,
    items: invoiceData.items || [],
    branchConfig: invoiceData.branchConfig || null,
    documentNumber: invoiceData.documentNumber || '001-001-000000001',
    ivaPercent: invoiceData.ivaPercent || 12,
    accessKey: invoiceData.accessKey || undefined,
  };

  const html = renderToString(
    createElement(FacturaSRI, props)
  );

  const browser = await puppeteer.launch({
     headless: true,  // ✅ Cambiado de 'new' a true
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  
  await page.setContent(`
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          @page { size: A4; margin: 0; }
          body { margin: 0; font-family: Arial, sans-serif; }
        </style>
      </head>
      <body>${html}</body>
    </html>
  `);

  await page.waitForNetworkIdle();
  
  const pdfBuffer = await page.pdf({
    format: 'A4',
    printBackground: true,
    margin: { top: '10mm', right: '10mm', bottom: '10mm', left: '10mm' }
  });

  await browser.close();
  
  return Buffer.from(pdfBuffer);
}