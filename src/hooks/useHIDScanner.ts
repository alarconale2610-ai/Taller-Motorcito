'use client';

import { useEffect, useRef, useCallback } from 'react';

interface UseHIDScannerOptions {
  onScan: (barcode: string) => void;
  enabled?: boolean;
  bufferTimeout?: number;      // Tiempo para considerar código completo (ms)
  minScanSpeed?: number;       // Ms máximos entre teclas para detectar escáner
  ignoreInputs?: boolean;      // Ignorar si el foco está en input/textarea
  prefixKey?: string;          // Tecla prefijo configurable (ej: 'F12')
  suffixKey?: string;          // Por defecto 'Enter'
}

export function useHIDScanner({
  onScan,
  enabled = true,
  bufferTimeout = 100,
  minScanSpeed = 50,           // Escáneres envían a <20ms, humanos >100ms
  ignoreInputs = true,
  prefixKey,
  suffixKey = 'Enter',
}: UseHIDScannerOptions) {
  const bufferRef = useRef('');
  const lastKeyTimeRef = useRef(0);
  const timeoutRef = useRef<NodeJS.Timeout>();
  const isScanningRef = useRef(false);

  const isInputElement = useCallback((target: EventTarget | null): boolean => {
    if (!target || !(target instanceof HTMLElement)) return false;
    const tagName = target.tagName.toLowerCase();
    const editable = target.getAttribute('contenteditable') === 'true';
    return ['input', 'textarea', 'select'].includes(tagName) || editable;
  }, []);

  const processBuffer = useCallback(() => {
    const code = bufferRef.current.trim();
    if (code.length >= 3) {  // Códigos de barras válidos suelen ser 8-13 dígitos mínimo
      onScan(code);
    }
    bufferRef.current = '';
    isScanningRef.current = false;
  }, [onScan]);

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      const now = Date.now();
      const timeSinceLastKey = now - lastKeyTimeRef.current;
      const target = event.target;

      // Ignorar si está en un input de formulario (a menos que sea modo forzado)
      if (ignoreInputs && isInputElement(target) && !isScanningRef.current) {
        return;
      }

      // Detectar prefijo si está configurado
      if (prefixKey && event.key === prefixKey) {
        bufferRef.current = '';
        isScanningRef.current = true;
        event.preventDefault();
        return;
      }

      // Si venimos de un prefijo o la velocidad es de escáner
      if (isScanningRef.current || timeSinceLastKey < minScanSpeed) {
        isScanningRef.current = true;

        // Detectar sufijo (fin del código)
        if (event.key === suffixKey || event.key === 'Enter') {
          event.preventDefault();
          processBuffer();
          return;
        }

        // Acumular caracteres válidos (números, letras, símbolos de códigos)
        if (event.key.length === 1 && !event.ctrlKey && !event.altKey && !event.metaKey) {
          bufferRef.current += event.key;
          event.preventDefault();
        }

        // Resetear timeout
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }
        timeoutRef.current = setTimeout(() => {
          processBuffer();
        }, bufferTimeout);
      } else {
        // Tipeo humano detectado, resetear buffer
        bufferRef.current = '';
        isScanningRef.current = false;
      }

      lastKeyTimeRef.current = now;
    };

    // Usar capture phase para interceptar antes que otros handlers
    document.addEventListener('keydown', handleKeyDown, true);

    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [enabled, minScanSpeed, bufferTimeout, suffixKey, prefixKey, ignoreInputs, isInputElement, processBuffer]);

  // Método para forzar escaneo manual (útil para testing)
  const simulateScan = useCallback((code: string) => {
    onScan(code);
  }, [onScan]);

  return { simulateScan };
}