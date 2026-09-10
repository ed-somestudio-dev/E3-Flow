import { useEffect, useRef, useState, useCallback } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Image as ImageIcon, Keyboard, Zap, ZapOff, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { detectScannedType } from '@/lib/scanner-utils';

interface CameraScannerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onScan: (scannedText: string, detectedType: 'pix' | 'barcode' | 'unknown') => void;
  title?: string;
  expectedType?: 'pix' | 'barcode' | 'auto';
}

export function CameraScannerModal({
  open,
  onOpenChange,
  onScan,
  expectedType = 'auto',
}: CameraScannerModalProps) {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const hasScannedRef = useRef<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [facingMode] = useState<'environment'>('environment');
  const [isScanning, setIsScanning] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [torchAvailable, setTorchAvailable] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [scanLineY, setScanLineY] = useState(20); // % para animação da linha
  const scanAnimRef = useRef<number | null>(null);
  const scanDirRef = useRef<1 | -1>(1);
  const regionId = 'html5-qrcode-scanner-region';

  const isBarcode = expectedType === 'barcode';

  // Anima a linha de scan para modo boleto
  useEffect(() => {
    if (!isBarcode || !isScanning) return;
    const animate = () => {
      setScanLineY(prev => {
        const next = prev + scanDirRef.current * 0.5;
        if (next >= 80) scanDirRef.current = -1;
        if (next <= 20) scanDirRef.current = 1;
        return next;
      });
      scanAnimRef.current = requestAnimationFrame(animate);
    };
    scanAnimRef.current = requestAnimationFrame(animate);
    return () => {
      if (scanAnimRef.current) cancelAnimationFrame(scanAnimRef.current);
    };
  }, [isBarcode, isScanning]);

  const handleResult = useCallback(async (decodedText: string, scanner: Html5Qrcode | null) => {
    if (!decodedText || hasScannedRef.current) return;
    hasScannedRef.current = true;

    try {
      if (scanner && scanner.isScanning) {
        await scanner.stop();
        scanner.clear();
      }
    } catch (err) {
      console.warn('Scanner stop warning:', err);
    }

    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try { navigator.vibrate([100, 50, 100]); } catch {}
    }

    const detected = detectScannedType(decodedText);
    const finalType = expectedType !== 'auto' ? expectedType : detected;

    toast.success(
      finalType === 'pix' ? 'QR Code PIX lido com sucesso!' :
      finalType === 'barcode' ? 'Código de barras lido com sucesso!' :
      'Código lido com sucesso!'
    );

    onScan(decodedText.trim(), finalType);
    onOpenChange(false);
  }, [expectedType, onScan, onOpenChange]);

  // Abre imagem da galeria e procura código nela
  const handleGallery = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    try {
      const tempScanner = new Html5Qrcode('gallery-reader', { verbose: false });
      const result = await tempScanner.scanFile(file, true);
      await tempScanner.clear();
      if (result) {
        await handleResult(result, null);
      }
    } catch {
      toast.error('Nenhum código encontrado na imagem. Tente outra foto ou use a câmera.');
    }
  };

  const toggleTorch = async () => {
    if (!scannerRef.current) return;
    try {
      const caps = scannerRef.current.getRunningTrackCapabilities();
      if ((caps as any)?.torch !== undefined) {
        const next = !torchOn;
        await scannerRef.current.applyVideoConstraints({
          advanced: [{ torch: next }] as any,
        });
        setTorchOn(next);
      } else {
        toast.info('Lanterna não disponível');
      }
    } catch {
      toast.info('Não foi possível alternar a lanterna');
    }
  };

  useEffect(() => {
    let html5QrcodeScanner: Html5Qrcode | null = null;
    let isCancelled = false;

    if (open) {
      setCameraError(null);
      setIsScanning(false);
      setTorchOn(false);
      setTorchAvailable(false);
      hasScannedRef.current = false;

      const formatsToSupport = isBarcode
        ? [
            Html5QrcodeSupportedFormats.CODE_128,
            Html5QrcodeSupportedFormats.ITF,
            Html5QrcodeSupportedFormats.EAN_13,
            Html5QrcodeSupportedFormats.EAN_8,
            Html5QrcodeSupportedFormats.UPC_A,
            Html5QrcodeSupportedFormats.CODE_39,
          ]
        : expectedType === 'pix'
        ? [Html5QrcodeSupportedFormats.QR_CODE]
        : [
            Html5QrcodeSupportedFormats.QR_CODE,
            Html5QrcodeSupportedFormats.CODE_128,
            Html5QrcodeSupportedFormats.ITF,
            Html5QrcodeSupportedFormats.EAN_13,
            Html5QrcodeSupportedFormats.EAN_8,
            Html5QrcodeSupportedFormats.UPC_A,
            Html5QrcodeSupportedFormats.DATA_MATRIX,
          ];

      const timeoutId = setTimeout(() => {
        if (isCancelled) return;
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
                fps: 15,
                qrbox: (vw, vh) => {
                  if (isBarcode) {
                    return {
                      width: Math.floor(vw * 0.88),
                      height: Math.floor(vh * 0.22),
                    };
                  }
                  const side = Math.floor(Math.min(vw, vh) * 0.72);
                  return { width: side, height: side };
                },
                videoConstraints: {
                  facingMode: 'environment',
                  width: { ideal: 1280 },
                  height: { ideal: 720 },
                } as any,
              },
              async (decodedText) => {
                await handleResult(decodedText, html5QrcodeScanner);
              },
              () => {}
            )
            .then(() => {
              if (!isCancelled) {
                setIsScanning(true);
                try {
                  const caps = html5QrcodeScanner?.getRunningTrackCapabilities();
                  if ((caps as any)?.torch !== undefined) setTorchAvailable(true);
                } catch {}
              }
            })
            .catch((err) => {
              console.error('Scanner start error:', err);
              setCameraError('Não foi possível acessar a câmera. Verifique as permissões.');
            });
        } catch (e) {
          console.error('Scanner init error:', e);
          setCameraError('Erro ao inicializar câmera.');
        }
      }, 250);

      return () => {
        isCancelled = true;
        clearTimeout(timeoutId);
        if (html5QrcodeScanner && html5QrcodeScanner.isScanning) {
          html5QrcodeScanner.stop().catch(() => {}).finally(() => {
            try { html5QrcodeScanner?.clear(); } catch {}
          });
        }
      };
    } else {
      if (scannerRef.current && scannerRef.current.isScanning) {
        scannerRef.current.stop().catch(() => {}).finally(() => {
          try { scannerRef.current?.clear(); } catch {}
          scannerRef.current = null;
        });
      }
      setIsScanning(false);
    }
  }, [open, facingMode, isBarcode, expectedType, handleResult]);

  if (!open) return null;

  const titleText = isBarcode
    ? 'Enquadre o código de barras dentro dos marcadores'
    : expectedType === 'pix'
    ? 'Enquadre o QR Code na moldura'
    : 'Enquadre o código na moldura';

  return (
    <div className="fixed inset-0 z-[9999] bg-black flex flex-col overflow-hidden">
      {/* Input oculto para galeria */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />
      {/* Div oculto para leitura de arquivo de galeria */}
      <div id="gallery-reader" className="hidden" />

      {/* Barra superior */}
      <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-4 pt-safe-or-4 pb-3 bg-gradient-to-b from-black/80 to-transparent">
        <button
          onClick={() => onOpenChange(false)}
          className="flex items-center justify-center h-10 w-10 rounded-full bg-black/40 text-white"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>

        {torchAvailable && (
          <button
            onClick={toggleTorch}
            className={`flex items-center justify-center h-10 w-10 rounded-full ${torchOn ? 'bg-yellow-400/30 text-yellow-300' : 'bg-black/40 text-white'}`}
          >
            {torchOn ? <ZapOff className="h-5 w-5" /> : <Zap className="h-5 w-5" />}
          </button>
        )}
      </div>

      {/* Área de câmera — ocupa toda a tela */}
      <div className="relative flex-1 flex items-center justify-center bg-black overflow-hidden">
        <div id={regionId} className="absolute inset-0 w-full h-full [&>video]:w-full [&>video]:h-full [&>video]:object-cover [&_div]:hidden" />

        {cameraError ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-8 text-center bg-black/90 z-10">
            <AlertCircle className="h-12 w-12 text-red-400" />
            <p className="text-white text-sm font-medium">{cameraError}</p>
            <Button size="sm" variant="outline" onClick={() => onOpenChange(false)}>
              Fechar
            </Button>
          </div>
        ) : isBarcode ? (
          /* === MODO BOLETO: linha vertical + cantos horizontais === */
          <div className="absolute inset-0 pointer-events-none z-10">
            {/* Overlay escuro nas bordas */}
            <div className="absolute inset-0 bg-black/55" />
            {/* Janela de leitura — faixa horizontal central */}
            <div
              className="absolute left-[6%] right-[6%]"
              style={{
                top: '39%',
                height: '22%',
                boxShadow: '0 0 0 9999px rgba(0,0,0,0.55)',
                background: 'transparent',
              }}
            >
              {/* Cantos da janela */}
              <div className="absolute top-0 left-0 w-6 h-6 border-t-2 border-l-2 border-yellow-400" />
              <div className="absolute top-0 right-0 w-6 h-6 border-t-2 border-r-2 border-yellow-400" />
              <div className="absolute bottom-0 left-0 w-6 h-6 border-b-2 border-l-2 border-yellow-400" />
              <div className="absolute bottom-0 right-0 w-6 h-6 border-b-2 border-r-2 border-yellow-400" />

              {/* Linha de scan vertical animada */}
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-yellow-400 shadow-[0_0_8px_2px_rgba(250,204,21,0.7)]"
                style={{ left: `${scanLineY}%`, transition: 'left 16ms linear' }}
              />
            </div>
          </div>
        ) : (
          /* === MODO QR CODE / PIX: moldura quadrada com cantos === */
          <div className="absolute inset-0 pointer-events-none z-10">
            <div className="absolute inset-0 bg-black/55" />
            <div
              className="absolute"
              style={{
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                width: '72vmin',
                height: '72vmin',
                boxShadow: '0 0 0 9999px rgba(0,0,0,0.55)',
                background: 'transparent',
              }}
            >
              {/* Cantos QR */}
              <div className="absolute top-0 left-0 w-8 h-8 border-t-3 border-l-3 border-white rounded-tl-sm" style={{ borderWidth: 3 }} />
              <div className="absolute top-0 right-0 w-8 h-8 border-t-3 border-r-3 border-white rounded-tr-sm" style={{ borderWidth: 3 }} />
              <div className="absolute bottom-0 left-0 w-8 h-8 border-b-3 border-l-3 border-white rounded-bl-sm" style={{ borderWidth: 3 }} />
              <div className="absolute bottom-0 right-0 w-8 h-8 border-b-3 border-r-3 border-white rounded-br-sm" style={{ borderWidth: 3 }} />
            </div>
          </div>
        )}
      </div>

      {/* Instrução e botões inferiores */}
      <div className="absolute bottom-0 left-0 right-0 z-20 flex flex-col items-center pb-safe-or-8 pt-4 px-4 bg-gradient-to-t from-black/85 to-transparent gap-5">
        {/* Texto de instrução — lateral direita no modo boleto como no BB */}
        {isBarcode ? (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex flex-col items-center">
            <p
              className="text-white text-xs font-semibold tracking-wide"
              style={{ writingMode: 'vertical-rl', textOrientation: 'mixed', transform: 'rotate(180deg)' }}
            >
              {titleText}
            </p>
          </div>
        ) : (
          <p className="text-white text-sm font-semibold text-center px-4 drop-shadow-md">
            {titleText}
          </p>
        )}

        {/* Botão de galeria (ícone de foto) */}
        <button
          onClick={handleGallery}
          className="flex flex-col items-center gap-1.5 text-white opacity-90 active:opacity-60"
        >
          <div className="h-12 w-12 rounded-full bg-white/20 backdrop-blur-sm border border-white/30 flex items-center justify-center">
            <ImageIcon className="h-6 w-6 text-white" />
          </div>
          <span className="text-[11px] text-white/80 font-medium">Galeria</span>
        </button>
      </div>

      {/* Botões laterais estilo BB (para boleto: Digitar código e Abrir PDF) */}
      {isBarcode && (
        <div className="absolute left-4 top-1/2 -translate-y-1/2 z-20 flex flex-col gap-3">
          <button
            onClick={() => onOpenChange(false)}
            className="flex flex-col items-center justify-center gap-1.5 h-20 w-16 rounded-2xl bg-blue-600/90 text-white text-center px-1 backdrop-blur-sm active:bg-blue-700"
          >
            <Keyboard className="h-5 w-5 shrink-0" />
            <span className="text-[10px] font-semibold leading-tight">Digitar código</span>
          </button>
        </div>
      )}
    </div>
  );
}
