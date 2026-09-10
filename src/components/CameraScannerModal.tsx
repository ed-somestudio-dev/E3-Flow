import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Camera, RefreshCw, X, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

interface CameraScannerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onScan: (scannedText: string, detectedType: 'pix' | 'barcode' | 'unknown') => void;
  title?: string;
  description?: string;
  expectedType?: 'pix' | 'barcode' | 'auto';
}

function detectScannedType(text: string): 'pix' | 'barcode' | 'unknown' {
  const clean = text.trim();
  
  // PIX payload (emvco 000201...) or contains pix domain / key pattern
  if (
    clean.startsWith('000201') ||
    clean.includes('br.gov.bcb.pix') ||
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(clean)
  ) {
    return 'pix';
  }

  // Boleto Barcode / Linha Digitável (digits only, usually 44, 47 or 48 chars)
  const digitsOnly = clean.replace(/[\s\.\-]/g, '');
  if (/^\d{11,48}$/.test(digitsOnly)) {
    return 'barcode';
  }

  return 'unknown';
}

export function CameraScannerModal({
  open,
  onOpenChange,
  onScan,
  title = 'Escanear pela Câmera',
  description = 'Aponte a câmera para o Código de Barras do boleto ou para o QR Code PIX',
  expectedType = 'auto',
}: CameraScannerModalProps) {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [isScanning, setIsScanning] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const regionId = 'html5-qrcode-scanner-region';

  useEffect(() => {
    let html5QrcodeScanner: Html5Qrcode | null = null;

    if (open) {
      setCameraError(null);
      setIsScanning(true);

      const formatsToSupport = [
        Html5QrcodeSupportedFormats.QR_CODE,
        Html5QrcodeSupportedFormats.CODE_128,
        Html5QrcodeSupportedFormats.CODE_39,
        Html5QrcodeSupportedFormats.EAN_13,
        Html5QrcodeSupportedFormats.EAN_8,
        Html5QrcodeSupportedFormats.ITF,
        Html5QrcodeSupportedFormats.UPC_A,
        Html5QrcodeSupportedFormats.UPC_E,
        Html5QrcodeSupportedFormats.DATA_MATRIX,
      ];

      // Delay initialization slightly to let DOM render the container
      const timeoutId = setTimeout(() => {
        try {
          html5QrcodeScanner = new Html5Qrcode(regionId, {
            formatsToSupport,
            verbose: false,
          });
          scannerRef.current = html5QrcodeScanner;

          html5QrcodeScanner
            .start(
              { facingMode },
              {
                fps: 10,
                qrbox: (viewfinderWidth, viewfinderHeight) => {
                  const minDim = Math.min(viewfinderWidth, viewfinderHeight);
                  // Dynamic scanner box
                  return {
                    width: Math.floor(minDim * 0.8),
                    height: Math.floor(minDim * (expectedType === 'barcode' ? 0.4 : 0.7)),
                  };
                },
              },
              (decodedText) => {
                if (decodedText) {
                  // Play tactile feedback if supported
                  if (typeof navigator !== 'undefined' && navigator.vibrate) {
                    navigator.vibrate([100, 50, 100]);
                  }

                  const detected = detectScannedType(decodedText);
                  const finalType = expectedType !== 'auto' ? expectedType : detected;

                  toast.success(
                    finalType === 'pix'
                      ? 'Chave/QR Code PIX lido com sucesso!'
                      : finalType === 'barcode'
                      ? 'Código de barras lido com sucesso!'
                      : 'Código lido com sucesso!'
                  );

                  onScan(decodedText.trim(), finalType);
                  onOpenChange(false);
                }
              },
              () => {
                // Scanning errors are frequent during scanning loop (no code found yet), ignore
              }
            )
            .catch((err) => {
              console.error('Error starting Html5Qrcode scanner:', err);
              setCameraError('Não foi possível acessar a câmera. Verifique as permissões do seu navegador/dispositivo.');
              setIsScanning(false);
            });
        } catch (e: any) {
          console.error('Scanner init error:', e);
          setCameraError('Erro ao inicializar câmera.');
          setIsScanning(false);
        }
      }, 300);

      return () => {
        clearTimeout(timeoutId);
        if (html5QrcodeScanner && html5QrcodeScanner.isScanning) {
          html5QrcodeScanner.stop().catch(() => {}).finally(() => {
            html5QrcodeScanner?.clear();
          });
        }
      };
    } else {
      if (scannerRef.current && scannerRef.current.isScanning) {
        scannerRef.current.stop().catch(() => {}).finally(() => {
          scannerRef.current?.clear();
          scannerRef.current = null;
        });
      }
      setIsScanning(false);
    }
  }, [open, facingMode]);

  const toggleCamera = () => {
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-md p-4 sm:p-6 flex flex-col gap-4 max-h-[95vh] max-h-[95dvh]"
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader className="space-y-1">
          <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
            <Camera className="h-5 w-5 text-primary" />
            {title}
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm">
            {description}
          </DialogDescription>
        </DialogHeader>

        <div className="relative w-full aspect-square bg-black rounded-lg overflow-hidden flex items-center justify-center border border-border">
          <div id={regionId} className="w-full h-full" />

          {cameraError && (
            <div className="absolute inset-0 bg-background/95 p-4 flex flex-col items-center justify-center text-center space-y-3 z-20">
              <AlertCircle className="h-10 w-10 text-destructive" />
              <p className="text-sm font-medium text-foreground">{cameraError}</p>
              <Button size="sm" variant="outline" onClick={() => setFacingMode((f) => f)}>
                Tentar Novamente
              </Button>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 pt-2 border-t border-border">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={toggleCamera}
            className="gap-1.5 text-xs"
            disabled={!isScanning || !!cameraError}
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Alternar Câmera
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="gap-1 text-xs"
          >
            <X className="h-3.5 w-3.5" />
            Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
