'use client';

export function PrintStyles() {
  return (
    <style jsx global>{`
      @media print {
        @page {
          size: 80mm auto;
          margin: 0;
        }
        
        body * {
          visibility: hidden;
        }
        
        .print-area,
        .print-area * {
          visibility: visible;
        }
        
        .print-area {
          position: absolute;
          left: 0;
          top: 0;
          width: 80mm;
          padding: 5mm;
          font-family: 'Courier New', monospace;
          font-size: 12px;
          line-height: 1.3;
        }
        
        .no-print {
          display: none !important;
        }
      }
      
      @media print and (min-width: 210mm) {
        @page {
          size: A4 portrait;
          margin: 10mm;
        }
        
        .print-area-factura {
          width: 190mm;
          font-family: Arial, sans-serif;
          font-size: 11px;
        }
      }
    `}</style>
  );
}