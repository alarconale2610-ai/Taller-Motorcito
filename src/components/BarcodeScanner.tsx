'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Scan, 
  X, 
  Camera, 
  Keyboard, 
  Smartphone,
  List,
  Trash2,
  Check,
  AlertCircle
} from 'lucide-react';
import { useHIDScanner } from '@/hooks/useHIDScanner';

interface ScannedItem {
  id: string;
  code: string;
  timestamp: Date;
  status: 'pending' | 'found' | 'not_found' | 'duplicate';
  productName?: string;
}

interface BarcodeScannerProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (barcode: string, mode: 'camera' | 'hid') => void;
  title?: string;
  continuous?: boolean;           // Modo continuo: no cerrar al escanear
  existingProducts?: Map<string, { name: string; stock: number }>; // Para validar duplicados
}

export function BarcodeScanner({
  isOpen,
  onClose,
  onScan,
  title = "Escanear Código de Barras",
  continuous = false,
  existingProducts = new Map(),
}: BarcodeScannerProps) {
  const [scanner, setScanner] = useState<Html5Qrcode | null>(null);
  const [error, setError] = useState<string>('');
  const [scanning, setScanning] = useState(false);
  const [mode, setMode] = useState<'camera' | 'hid'>('camera');
  const [cameras, setCameras] = useState<Array<{ id: string; label: string }>>([]);
  const [selectedCamera, setSelectedCamera] = useState<string>('');
  const [scannedItems, setScannedItems] = useState<ScannedItem[]>([]);
  const [hidEnabled, setHidEnabled] = useState(true);
  const scannerRef = useRef<HTMLDivElement>(null);

  // Modo HID: Escáner USB tipo teclado
  const handleHIDScan = useCallback((code: string) => {
    if (!continuous) {
      onScan(code, 'hid');
      handleClose();
      return;
    }

    // Modo continuo: agregar a lista
    const existing = existingProducts.get(code);
    const isDuplicate = scannedItems.some(item => item.code === code);
    
    const newItem: ScannedItem = {
      id: Math.random().toString(36).substr(2, 9),
      code,
      timestamp: new Date(),
      status: isDuplicate ? 'duplicate' : existing ? 'found' : 'not_found',
      productName: existing?.name,
    };

    setScannedItems(prev => [newItem, ...prev]);
    onScan(code, 'hid'); // Notificar al padre también
  }, [continuous, existingProducts, scannedItems, onScan]);

  useHIDScanner({
    onScan: handleHIDScan,
    enabled: isOpen && mode === 'hid' && hidEnabled,
    bufferTimeout: 80,
    minScanSpeed: 40,
  });

  // Cargar cámaras disponibles
  useEffect(() => {
    if (isOpen && mode === 'camera' && cameras.length === 0) {
      Html5Qrcode.getCameras()
        .then(devices => {
          if (devices && devices.length) {
            setCameras(devices.map(d => ({ id: d.id, label: d.label })));
            // Preferir cámara trasera (environment) o la primera
            const backCamera = devices.find(d => 
              d.label.toLowerCase().includes('back') || 
              d.label.toLowerCase().includes('trasera') ||
              d.label.toLowerCase().includes('environment')
            );
            setSelectedCamera(backCamera?.id || devices[0].id);
          } else {
            setError('No se encontraron cámaras disponibles');
          }
        })
        .catch(err => {
          setError('Error accediendo a cámaras: ' + err.message);
        });
    }
  }, [isOpen, mode, cameras.length]);

  // Inicializar escáner de cámara
  useEffect(() => {
    if (isOpen && mode === 'camera' && selectedCamera && !scanner) {
      const qrScanner = new Html5Qrcode('barcode-scanner', {
        verbose: false,
        formatsToSupport: [
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.UPC_E,
          Html5QrcodeSupportedFormats.CODABAR,
          Html5QrcodeSupportedFormats.QR_CODE,
        ],
      });
      setScanner(qrScanner);
    }

    return () => {
      if (scanner && scanning) {
        scanner.stop().catch(console.error);
      }
    };
  }, [isOpen, mode, selectedCamera, scanner, scanning]);

  // Iniciar escaneo de cámara
  useEffect(() => {
    if (scanner && isOpen && mode === 'camera' && !scanning && selectedCamera) {
      startScanning();
    }
  }, [scanner, isOpen, mode, scanning, selectedCamera]);

  const startScanning = async () => {
    if (!scanner || !selectedCamera) return;

    setError('');
    setScanning(true);

    try {
      await scanner.start(
        selectedCamera,
        {
          fps: 15,                    // Optimizado para velocidad vs batería
          qrbox: { width: 280, height: 200 }, // Rectangular para códigos 1D
          aspectRatio: 1.0,
          disableFlip: false,
        },
        (decodedText) => {
          handleCameraScan(decodedText);
        },
        (errorMessage) => {
          // Errores menores de no detección, ignorar silenciosamente
        }
      );
    } catch (err: any) {
      setError('Error al iniciar cámara: ' + err.message);
      setScanning(false);
    }
  };

  const handleCameraScan = (code: string) => {
    if (!continuous) {
      onScan(code, 'camera');
      handleClose();
      return;
    }

    // Modo continuo
    const existing = existingProducts.get(code);
    const isDuplicate = scannedItems.some(item => item.code === code);
    
    const newItem: ScannedItem = {
      id: Math.random().toString(36).substr(2, 9),
      code,
      timestamp: new Date(),
      status: isDuplicate ? 'duplicate' : existing ? 'found' : 'not_found',
      productName: existing?.name,
    };

    setScannedItems(prev => [newItem, ...prev]);
    onScan(code, 'camera');

    // Efecto visual/sonoro opcional aquí (beep)
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(50); // Vibración táctil 50ms
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
    setScannedItems([]);
    setMode('camera');
    setScanner(null);
    onClose();
  };

  const removeScannedItem = (id: string) => {
    setScannedItems(prev => prev.filter(item => item.id !== id));
  };

  const getStatusColor = (status: ScannedItem['status']) => {
    switch (status) {
      case 'found': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'not_found': return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'duplicate': return 'bg-blue-100 text-blue-700 border-blue-200';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getStatusIcon = (status: ScannedItem['status']) => {
    switch (status) {
      case 'found': return <Check className="h-3 w-3" />;
      case 'not_found': return <AlertCircle className="h-3 w-3" />;
      case 'duplicate': return <List className="h-3 w-3" />;
      default: return null;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Scan className="h-5 w-5" />
            {title}
          </DialogTitle>
        </DialogHeader>

        <Tabs value={mode} onValueChange={(v) => setMode(v as 'camera' | 'hid')} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="camera" className="flex items-center gap-2">
              <Smartphone className="h-4 w-4" />
              Cámara
              {mode === 'camera' && scanning && (
                <span className="ml-1 h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              )}
            </TabsTrigger>
            <TabsTrigger value="hid" className="flex items-center gap-2">
              <Keyboard className="h-4 w-4" />
              Escáner USB
              {mode === 'hid' && hidEnabled && (
                <span className="ml-1 h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="camera" className="mt-4 space-y-4">
            {error ? (
              <div className="p-4 bg-red-50 text-red-700 rounded-lg text-center">
                <p className="text-sm">{error}</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  onClick={startScanning}
                  disabled={!selectedCamera}
                >
                  <Camera className="h-4 w-4 mr-2" />
                  Reintentar
                </Button>
              </div>
            ) : (
              <>
                {cameras.length > 1 && (
                  <select
                    value={selectedCamera}
                    onChange={(e) => {
                      setSelectedCamera(e.target.value);
                      if (scanner && scanning) {
                        scanner.stop().then(() => {
                          setScanning(false);
                          setScanner(null);
                        });
                      }
                    }}
                    className="w-full p-2 text-sm border rounded-md border-slate-200"
                  >
                    {cameras.map(cam => (
                      <option key={cam.id} value={cam.id}>
                        {cam.label || `Cámara ${cam.id.slice(0, 8)}`}
                      </option>
                    ))}
                  </select>
                )}
                
                <div
                  id="barcode-scanner"
                  ref={scannerRef}
                  className="w-full aspect-[4/3] bg-black rounded-lg overflow-hidden relative"
                >
                  {!scanning && (
                    <div className="absolute inset-0 flex items-center justify-center text-white">
                      <span className="text-sm">Iniciando cámara...</span>
                    </div>
                  )}
                </div>

                <p className="text-xs text-gray-500 text-center">
                  Apunta al código de barras. Soporta: EAN-13, EAN-8, CODE-128, QR
                </p>
              </>
            )}
          </TabsContent>

          <TabsContent value="hid" className="mt-4 space-y-4">
            <div className="p-6 bg-slate-50 rounded-lg border border-slate-200 text-center space-y-3">
              <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto shadow-sm">
                <Keyboard className="h-8 w-8 text-slate-600" />
              </div>
              <div>
                <p className="font-medium text-gray-800">Modo Escáner USB</p>
                <p className="text-sm text-gray-500 mt-1">
                  Conecte la pistola escáner vía USB y apunte al código de barras
                </p>
              </div>
              
              <div className="flex items-center justify-center gap-2 mt-2">
                <span className="text-xs text-gray-500">Estado:</span>
                <Badge 
                  variant={hidEnabled ? "default" : "secondary"}
                  className={hidEnabled ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100" : ""}
                >
                  {hidEnabled ? 'Escuchando...' : 'Pausado'}
                </Badge>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setHidEnabled(!hidEnabled)}
              >
                {hidEnabled ? 'Pausar' : 'Reanudar'} detección
              </Button>
            </div>

            <div className="bg-blue-50 p-3 rounded-lg border border-blue-100">
              <p className="text-xs text-blue-700">
                <strong>Tip:</strong> El sistema detecta automáticamente cuando el escáner envía 
                caracteres rápidamente. No es necesario hacer clic en ningún campo.
              </p>
            </div>
          </TabsContent>
        </Tabs>

        {/* Lista de escaneos en modo continuo */}
        {continuous && scannedItems.length > 0 && (
          <div className="flex-1 min-h-0 mt-4">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-medium text-gray-700 flex items-center gap-2">
                <List className="h-4 w-4" />
                Escaneados ({scannedItems.length})
              </h4>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                onClick={() => setScannedItems([])}
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Limpiar
              </Button>
            </div>
            
            <ScrollArea className="h-48 rounded-md border">
              <div className="p-2 space-y-1">
                {scannedItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-2 bg-white rounded border group hover:border-slate-300 transition-colors"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Badge 
                        variant="outline" 
                        className={`text-xs shrink-0 ${getStatusColor(item.status)}`}
                      >
                        <span className="flex items-center gap-1">
                          {getStatusIcon(item.status)}
                          {item.status === 'found' ? 'Existe' : 
                           item.status === 'not_found' ? 'Nuevo' : 
                           item.status === 'duplicate' ? 'Dup' : '?'}
                        </span>
                      </Badge>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate font-mono">
                          {item.code}
                        </p>
                        {item.productName && (
                          <p className="text-xs text-gray-500 truncate">
                            {item.productName}
                          </p>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => removeScannedItem(item.id)}
                    >
                      <X className="h-3 w-3 text-gray-400" />
                    </Button>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}

        <DialogFooter className="gap-2 mt-4">
          <Button variant="outline" onClick={handleClose}>
            <X className="h-4 w-4 mr-2" />
            {continuous ? 'Finalizar' : 'Cancelar'}
          </Button>
          {continuous && scannedItems.length > 0 && (
            <Button 
              variant="default" 
              onClick={handleClose}
              className="bg-slate-800 hover:bg-slate-700"
            >
              <Check className="h-4 w-4 mr-2" />
              Confirmar {scannedItems.length} escaneos
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}