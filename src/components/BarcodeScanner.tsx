'use client';

import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Scan, X, Camera } from 'lucide-react';

interface BarcodeScannerProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (barcode: string) => void;
  title?: string;
}

export function BarcodeScanner({ 
  isOpen, 
  onClose, 
  onScan, 
  title = "Escanear Código de Barras" 
}: BarcodeScannerProps) {
  const [scanner, setScanner] = useState<Html5Qrcode | null>(null);
  const [error, setError] = useState<string>('');
  const [scanning, setScanning] = useState(false);
  const scannerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && !scanner) {
      const qrScanner = new Html5Qrcode('barcode-scanner');
      setScanner(qrScanner);
    }

    return () => {
      if (scanner && scanning) {
        scanner.stop().catch(console.error);
      }
    };
  }, [isOpen]);

  useEffect(() => {
    if (scanner && isOpen && !scanning) {
      startScanning();
    }
  }, [scanner, isOpen]);

  const startScanning = async () => {
    if (!scanner) return;

    setError('');
    setScanning(true);

    try {
      await scanner.start(
        { facingMode: 'environment' }, // Usar cámara trasera en móviles
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
        },
        (decodedText) => {
          // Éxito al escanear
          onScan(decodedText);
          handleClose();
        },
        (errorMessage) => {
          // Error de escaneo (normalmente "QR code not found")
          // No mostramos estos errores menores
        }
      );
    } catch (err: any) {
      setError('Error al iniciar cámara: ' + err.message);
      setScanning(false);
    }
  };

  const handleClose = async () => {
    if (scanner && scanning) {
      try {
        await scanner.stop();
      } catch (e) {
        console.error('Error stopping scanner:', e);
      }
    }
    setScanning(false);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Scan className="h-5 w-5" />
            {title}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {error ? (
            <div className="p-4 bg-red-50 text-red-700 rounded-lg text-center">
              <p>{error}</p>
              <Button 
                variant="outline" 
                className="mt-2"
                onClick={startScanning}
              >
                <Camera className="h-4 w-4 mr-2" />
                Reintentar
              </Button>
            </div>
          ) : (
            <div 
              id="barcode-scanner" 
              ref={scannerRef}
              className="w-full aspect-square bg-black rounded-lg overflow-hidden relative"
            >
              {!scanning && (
                <div className="absolute inset-0 flex items-center justify-center text-white">
                  <span>Iniciando cámara...</span>
                </div>
              )}
            </div>
          )}
          
          <p className="text-sm text-gray-500 text-center">
            Apunta la cámara al código de barras del producto
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            <X className="h-4 w-4 mr-2" />
            Cancelar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}