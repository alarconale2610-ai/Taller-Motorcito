'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { toast } from '@/hooks/use-toast';

interface USBDeviceInfo {
  vendorId: number;
  productId: number;
  productName: string;
  serialNumber: string;
}

interface PrintData {
  businessName: string;
  ruc?: string;
  address?: string;
  phone?: string;
  email?: string;
  documentType: string;
  documentNumber: string;
  date: string;
  cashier: string;
  customerName: string;
  customerPhone?: string;
  items: Array<{
    name: string;
    quantity: number;
    unitPrice: number;
    total: number;
  }>;
  subtotal: number;
  iva: number;
  ivaPercent: number;
  total: number;
  paymentMethod: string;
  cashReceived?: number;
  change?: number;
  header?: string;
  footer?: string;
}

// Comandos ESC/POS para impresoras térmicas
const ESC = 0x1B;
const GS = 0x1D;
const LF = 0x0A;

const COMMANDS = {
  INIT: new Uint8Array([ESC, 0x40]),
  ALIGN_CENTER: new Uint8Array([ESC, 0x61, 1]),
  ALIGN_LEFT: new Uint8Array([ESC, 0x61, 0]),
  ALIGN_RIGHT: new Uint8Array([ESC, 0x61, 2]),
  BOLD_ON: new Uint8Array([ESC, 0x45, 1]),
  BOLD_OFF: new Uint8Array([ESC, 0x45, 0]),
  DOUBLE_HEIGHT: new Uint8Array([ESC, 0x21, 16]),
  NORMAL_SIZE: new Uint8Array([ESC, 0x21, 0]),
  CUT_PARTIAL: new Uint8Array([GS, 0x56, 42]),
  CUT_FULL: new Uint8Array([GS, 0x56, 0]),
  FEED_LINES: (n: number) => new Uint8Array([ESC, 0x64, n]),
  LINE_FEED: new Uint8Array([LF]),
};

const COMMON_VENDOR_IDS = [
  0x04B8, 0x0525, 0x0DD4, 0x1DB2, 0x1FC9, 0x2A11, 0x2B7E, 0x2D58,
  0x2D8C, 0x2E1A, 0x2E5A, 0x2E89, 0x2E8A, 0x2E8B, 0x2E8C, 0x2E8D,
  0x2E8E, 0x2E8F, 0x2E90, 0x2E91, 0x2E92, 0x2E93, 0x2E94, 0x2E95,
  0x2E96, 0x2E97, 0x2E98, 0x2E99, 0x2E9A, 0x2E9B, 0x2E9C, 0x2E9D,
  0x2E9E, 0x2E9F, 0x2EA0, 0x2EA1, 0x2EA2, 0x2EA3, 0x2EA4, 0x2EA5,
  0x2EA6, 0x2EA7, 0x2EA8, 0x2EA9, 0x2EAA, 0x2EAB, 0x2EAC, 0x2EAD,
  0x2EAE, 0x2EAF, 0x2EB0, 0x2EB1, 0x2EB2, 0x2EB3, 0x2EB4, 0x2EB5,
  0x2EB6, 0x2EB7, 0x2EB8, 0x2EB9, 0x2EBA, 0x2EBB, 0x2EBC, 0x2EBD,
  0x2EBE, 0x2EBF, 0x2EC0, 0x2EC1, 0x2EC2, 0x2EC3, 0x2EC4, 0x2EC5,
  0x2EC6, 0x2EC7, 0x2EC8, 0x2EC9, 0x2ECA, 0x2ECB, 0x2ECC, 0x2ECD,
  0x2ECE, 0x2ECF, 0x2ED0, 0x2ED1, 0x2ED2, 0x2ED3, 0x2ED4, 0x2ED5,
  0x2ED6, 0x2ED7, 0x2ED8, 0x2ED9, 0x2EDA, 0x2EDB, 0x2EDC, 0x2EDD,
  0x2EDE, 0x2EDF, 0x2EE0, 0x2EE1, 0x2EE2, 0x2EE3, 0x2EE4, 0x2EE5,
  0x2EE6, 0x2EE7, 0x2EE8, 0x2EE9, 0x2EEA, 0x2EEB, 0x2EEC, 0x2EED,
  0x2EEE, 0x2EEF, 0x2EF0, 0x2EF1, 0x2EF2, 0x2EF3, 0x2EF4, 0x2EF5,
  0x2EF6, 0x2EF7, 0x2EF8, 0x2EF9, 0x2EFA, 0x2EFB, 0x2EFC, 0x2EFD,
  0x2EFE, 0x2EFF,
];

export function useWebUsbPrinter() {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [deviceInfo, setDeviceInfo] = useState<USBDeviceInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const deviceRef = useRef<any>(null);  // ✅ any en lugar de USBDevice
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const isSupported = typeof navigator !== 'undefined' && 'usb' in navigator;

  useEffect(() => {
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, []);

  const handleDisconnect = useCallback((event: any) => {  // ✅ any
    if (deviceRef.current && event.device.serialNumber === deviceRef.current.serialNumber) {
      setIsConnected(false);
      setDeviceInfo(null);
      deviceRef.current = null;
      
      toast({
        title: 'Impresora desconectada',
        description: 'La impresora se ha desconectado. Intentando reconectar...',
        variant: 'default',
      });

      reconnectTimeoutRef.current = setTimeout(() => {
        connect();
      }, 2000);
    }
  }, []);

  useEffect(() => {
    if (!isSupported) return;

    (navigator as any).usb.addEventListener('disconnect', handleDisconnect);  // ✅ any
    
    return () => {
      (navigator as any).usb.removeEventListener('disconnect', handleDisconnect);  // ✅ any
    };
  }, [isSupported, handleDisconnect]);

  const connect = useCallback(async (): Promise<boolean> => {
    if (!isSupported) {
      setError('Web USB no soportado en este navegador. Use Chrome o Edge.');
      return false;
    }

    try {
      setIsConnecting(true);
      setError(null);

      if (deviceRef.current && deviceRef.current.opened) {
        setIsConnected(true);
        return true;
      }

      const device = await (navigator as any).usb.requestDevice({  // ✅ any
        filters: COMMON_VENDOR_IDS.map(vid => ({ vendorId: vid }))
      });

      if (!device) {
        throw new Error('No se seleccionó ningún dispositivo');
      }

      await device.open();
      
      if (device.configuration === null) {
        await device.selectConfiguration(1);
      }

      const interfaceNumber = device.configuration?.interfaces[0]?.interfaceNumber || 0;
      
      try {
        await device.claimInterface(interfaceNumber);
      } catch (claimError) {
        console.log('Interfaz posiblemente ya reclamada:', claimError);
      }

      deviceRef.current = device;
      
      setDeviceInfo({
        vendorId: device.vendorId,
        productId: device.productId,
        productName: device.productName || 'Impresora USB',
        serialNumber: device.serialNumber || 'N/A',
      });
      
      setIsConnected(true);

      toast({
        title: 'Impresora conectada',
        description: `${device.productName} lista para imprimir`,
      });

      return true;

    } catch (err: any) {
      console.error('Error conectando impresora:', err);
      
      let errorMessage = 'Error al conectar la impresora';
      if (err.name === 'NotFoundError') {
        errorMessage = 'No se encontró ninguna impresora USB';
      } else if (err.name === 'SecurityError') {
        errorMessage = 'Permiso denegado. Asegúrese de usar HTTPS.';
      } else if (err.message?.includes('claimInterface')) {
        errorMessage = 'La impresora está en uso por otra aplicación';
      }
      
      setError(errorMessage);
      setIsConnected(false);
      
      toast({
        title: 'Error de conexión',
        description: errorMessage,
        variant: 'destructive',
      });
      
      return false;
    } finally {
      setIsConnecting(false);
    }
  }, [isSupported]);

  const disconnect = useCallback(async () => {
    if (deviceRef.current) {
      try {
        await deviceRef.current.close();
      } catch (err) {
        console.error('Error cerrando dispositivo:', err);
      }
      deviceRef.current = null;
    }
    setIsConnected(false);
    setDeviceInfo(null);
  }, []);

  const encodeText = (text: string): Uint8Array => {
    const encoder = new TextEncoder();
    return encoder.encode(text);
  };

  const sendCommand = async (data: Uint8Array): Promise<void> => {
    if (!deviceRef.current || !deviceRef.current.opened) {
      throw new Error('Impresora no conectada');
    }

    const endpoint = deviceRef.current.configuration?.interfaces[0]?.alternate.endpoints.find(
      (ep: any) => ep.direction === 'out'  // ✅ any
    );

    if (!endpoint) {
      throw new Error('No se encontró endpoint de salida');
    }

    await deviceRef.current.transferOut(endpoint.endpointNumber, data);
  };

  const printReceipt = useCallback(async (data: PrintData): Promise<boolean> => {
    if (!deviceRef.current || !deviceRef.current.opened) {
      toast({
        title: 'Impresora no conectada',
        description: 'Por favor conecte la impresora primero',
        variant: 'destructive',
      });
      return false;
    }

    try {
      await sendCommand(COMMANDS.INIT);
      await sendCommand(new Uint8Array([ESC, 0x74, 2]));
      
      await sendCommand(COMMANDS.ALIGN_CENTER);
      await sendCommand(COMMANDS.BOLD_ON);
      await sendCommand(COMMANDS.DOUBLE_HEIGHT);
      await sendCommand(encodeText(data.businessName.toUpperCase()));
      await sendCommand(COMMANDS.LINE_FEED);
      
      await sendCommand(COMMANDS.NORMAL_SIZE);
      await sendCommand(COMMANDS.BOLD_OFF);
      
      if (data.ruc) {
        await sendCommand(encodeText(`RUC: ${data.ruc}`));
        await sendCommand(COMMANDS.LINE_FEED);
      }
      
      if (data.address) {
        await sendCommand(encodeText(data.address));
        await sendCommand(COMMANDS.LINE_FEED);
      }
      
      if (data.phone) {
        await sendCommand(encodeText(`Tel: ${data.phone}`));
        await sendCommand(COMMANDS.LINE_FEED);
      }
      
      await sendCommand(COMMANDS.LINE_FEED);
      
      if (data.header) {
        await sendCommand(encodeText(data.header));
        await sendCommand(COMMANDS.LINE_FEED);
      }
      
      await sendCommand(COMMANDS.BOLD_ON);
      await sendCommand(encodeText('================================'));
      await sendCommand(COMMANDS.LINE_FEED);
      await sendCommand(encodeText(data.documentType.toUpperCase()));
      await sendCommand(COMMANDS.LINE_FEED);
      await sendCommand(encodeText(`Nro: ${data.documentNumber}`));
      await sendCommand(COMMANDS.LINE_FEED);
      await sendCommand(encodeText('================================'));
      await sendCommand(COMMANDS.BOLD_OFF);
      await sendCommand(COMMANDS.LINE_FEED);
      
      await sendCommand(COMMANDS.ALIGN_LEFT);
      await sendCommand(encodeText(`Fecha: ${data.date}`));
      await sendCommand(COMMANDS.LINE_FEED);
      await sendCommand(encodeText(`Cajero: ${data.cashier}`));
      await sendCommand(COMMANDS.LINE_FEED);
      await sendCommand(encodeText(`Cliente: ${data.customerName.toUpperCase()}`));
      if (data.customerPhone) {
        await sendCommand(COMMANDS.LINE_FEED);
        await sendCommand(encodeText(`Tel: ${data.customerPhone}`));
      }
      await sendCommand(COMMANDS.LINE_FEED);
      await sendCommand(encodeText('--------------------------------'));
      await sendCommand(COMMANDS.LINE_FEED);
      
      await sendCommand(COMMANDS.BOLD_ON);
      await sendCommand(encodeText('DESCRIPCION          CANT  TOTAL'));
      await sendCommand(COMMANDS.BOLD_OFF);
      await sendCommand(COMMANDS.LINE_FEED);
      await sendCommand(encodeText('--------------------------------'));
      await sendCommand(COMMANDS.LINE_FEED);
      
      for (const item of data.items) {
        const name = item.name.substring(0, 20).padEnd(20);
        const qty = item.quantity.toString().padStart(4);
        const total = item.total.toFixed(2).padStart(8);
        
        await sendCommand(encodeText(`${name}${qty}${total}`));
        await sendCommand(COMMANDS.LINE_FEED);
        
        const unitPrice = `(P.U.: ${item.unitPrice.toFixed(2)})`;
        await sendCommand(encodeText(' '.repeat(20) + unitPrice));
        await sendCommand(COMMANDS.LINE_FEED);
      }
      
      await sendCommand(encodeText('--------------------------------'));
      await sendCommand(COMMANDS.LINE_FEED);
      
      await sendCommand(COMMANDS.ALIGN_RIGHT);
      await sendCommand(encodeText(`Subtotal: $${data.subtotal.toFixed(2)}`));
      await sendCommand(COMMANDS.LINE_FEED);
      await sendCommand(encodeText(`IVA (${data.ivaPercent}%): $${data.iva.toFixed(2)}`));
      await sendCommand(COMMANDS.LINE_FEED);
      
      await sendCommand(COMMANDS.BOLD_ON);
      await sendCommand(COMMANDS.DOUBLE_HEIGHT);
      await sendCommand(encodeText(`TOTAL: $${data.total.toFixed(2)}`));
      await sendCommand(COMMANDS.NORMAL_SIZE);
      await sendCommand(COMMANDS.BOLD_OFF);
      await sendCommand(COMMANDS.LINE_FEED);
      
      await sendCommand(COMMANDS.ALIGN_CENTER);
      await sendCommand(encodeText(`[${data.paymentMethod.toUpperCase()}]`));
      await sendCommand(COMMANDS.LINE_FEED);
      
      if (data.cashReceived && data.change !== undefined) {
        await sendCommand(COMMANDS.ALIGN_RIGHT);
        await sendCommand(encodeText(`Recibido: $${data.cashReceived.toFixed(2)}`));
        await sendCommand(COMMANDS.LINE_FEED);
        await sendCommand(encodeText(`Cambio: $${data.change.toFixed(2)}`));
        await sendCommand(COMMANDS.LINE_FEED);
      }
      
      await sendCommand(COMMANDS.ALIGN_CENTER);
      await sendCommand(COMMANDS.LINE_FEED);
      
      if (data.footer) {
        const footerLines = data.footer.split('\n');
        for (const line of footerLines) {
          await sendCommand(encodeText(line));
          await sendCommand(COMMANDS.LINE_FEED);
        }
      }
      
      await sendCommand(encodeText('Gracias por su preferencia'));
      await sendCommand(COMMANDS.LINE_FEED);
      await sendCommand(encodeText('Documento generado electronicamente'));
      await sendCommand(COMMANDS.LINE_FEED);
      
      await sendCommand(COMMANDS.FEED_LINES(3));
      await sendCommand(COMMANDS.CUT_PARTIAL);
      
      toast({
        title: 'Ticket impreso',
        description: 'El ticket se ha enviado a la impresora correctamente',
      });
      
      return true;
      
    } catch (err: any) {
      console.error('Error imprimiendo:', err);
      
      toast({
        title: 'Error de impresión',
        description: err.message || 'No se pudo imprimir el ticket',
        variant: 'destructive',
      });
      
      if (err.message?.includes('disconnected') || err.message?.includes('transferOut')) {
        setIsConnected(false);
        deviceRef.current = null;
      }
      
      return false;
    }
  }, []);

  return {
    isSupported,
    isConnected,
    isConnecting,
    deviceInfo,
    error,
    connect,
    disconnect,
    printReceipt,
  };
}