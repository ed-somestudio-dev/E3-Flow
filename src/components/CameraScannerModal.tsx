import { useEffect, useRef, useState, useCallback } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Image as ImageIcon, Keyboard, Zap, ZapOff, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { detectScannedType } from '@/lib/scanner-utils';
import { Camera } from '@capacitor/camera';
import { Capacitor } from '@capacitor/core';

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
  const [isScanning, setIsScanning] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [torchAvailable, setTorchAvailable] = useState(false);
  const [torchOn, setTorchOn] = useState(false);

  // Animação da linha de scan (para modo boleto)
  const [scanLineX, setScanLineX] = useState(5);
  const scanAnimRef = useRef<number | null>(null);
  const scanDirRef = useRef<1 | -1>(1);

  const regionId = 'html5-qrcode-scanner-region';
  const isBarcode = expectedType === 'barcode';

  // Anima a linha de scan horizontal no modo boleto
  useEffect(() => {
    if (!isBarcode || !isScanning) {
      if (scanAnimRef.current) cancelAnimationFrame(scanAnimRef.current);
      return;
    }
    let running = true;
    const animate = () => {
      if (!running) return;
      setScanLineX(prev => {
        const next = prev + scanDirRef.current * 0.4;
        if (next >= 95) scanDirRef.current = -1;
        if (next <= 5)  scanDirRef.current = 1;
        return next;
      });
      scanAnimRef.current = requestAnimationFrame(animate);
    };
    scanAnimRef.current = requestAnimationFrame(animate);
    return () => {
      running = false;
      if (scanAnimRef.current) cancelAnimationFrame(scanAnimRef.current);
    };
  }, [isBarcode, isScanning]);

  const handleResult = useCallback(async (
    decodedText: string,
    scanner: Html5Qrcode | null,
  ) => {
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

    try { navigator.vibrate?.([100, 50, 100]); } catch {}

    const detected  = detectScannedType(decodedText);
    const finalType = expectedType !== 'auto' ? expectedType : detected;

    toast.success(
      finalType === 'pix'     ? 'QR Code PIX lido com sucesso!'     :
      finalType === 'barcode' ? 'Código de barras lido com sucesso!' :
                                'Código lido com sucesso!',
    );

    onScan(decodedText.trim(), finalType);
    onOpenChange(false);
  }, [expectedType, onScan, onOpenChange]);

  // Galeria: abre seletor de imagem
  const handleGallery = () => fileInputRef.current?.click();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    try {
      const tmp = new Html5Qrcode('gallery-reader', { verbose: false });
      const result = await tmp.scanFile(file, true);
      await tmp.clear();
      if (result) await handleResult(result, null);
    } catch {
      toast.error('Nenhum código encontrado na imagem. Tente outra foto ou use a câmera.');
    }
  };

  const toggleTorch = async () => {
    if (!scannerRef.current) return;
    try {
      const caps = scannerRef.current.getRunningTrackCapabilities() as any;
      if (caps?.torch !== undefined) {
        const next = !torchOn;
        await scannerRef.current.applyVideoConstraints({ advanced: [{ torch: next }] } as any);
        setTorchOn(next);
      } else {
        toast.info('Lanterna não disponível');
      }
    } catch {
      toast.info('Não foi possível alternar a lanterna');
    }
  };

  // ─── Inicializa / para scanner ─────────────────────────────────────────────
  useEffect(() => {
    let scanner: Html5Qrcode | null = null;
    let cancelled = false;

    if (!open) {
      // Fecha o scanner quando o modal fecha
      if (scannerRef.current?.isScanning) {
        scannerRef.current.stop().catch(() => {}).finally(() => {
          try { scannerRef.current?.clear(); } catch {}
          scannerRef.current = null;
        });
      }
      setIsScanning(false);
      return;
    }

    // ── Reset de estado ────────────────────────────────────────────────────────
    setCameraError(null);
    setIsScanning(false);
    setTorchOn(false);
    setTorchAvailable(false);
    hasScannedRef.current = false;
    setScanLineX(5);
    scanDirRef.current = 1;

    const formats = isBarcode
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

    // ── Função principal de inicialização ────────────────────────────────────
    const initScanner = async () => {
      // ── 1. Permissão nativa (APK Android/iOS) ────────────────────────────
      if (Capacitor.isNativePlatform()) {
        try {
          const status = await Camera.checkPermissions();
          if (status.camera === 'denied') {
            if (!cancelled) setCameraError(
              'Permissão de câmera negada. Acesse Configurações > Aplicativos > E3 Flow > Permissões e habilite a Câmera.',
            );
            return;
          }
          if (status.camera !== 'granted') {
            const result = await Camera.requestPermissions({ permissions: ['camera'] });
            if (result.camera !== 'granted') {
              if (!cancelled) setCameraError('Permissão de câmera negada.');
              return;
            }
          }
        } catch { /* ignora — prossegue */ }
      }

      // ── 2. Aguarda DOM estar pronto ───────────────────────────────────────
      await new Promise(r => setTimeout(r, 300));
      if (cancelled) return;

      // ── 3. Cria instância do scanner ──────────────────────────────────────
      try {
        scanner = new Html5Qrcode(regionId, { formatsToSupport: formats, verbose: false });
        scannerRef.current = scanner;
      } catch (e) {
        console.error('Html5Qrcode init error:', e);
        if (!cancelled) setCameraError('Erro ao inicializar câmera. Recarregue a página.');
        return;
      }

      // ── 4. Config de scan ─────────────────────────────────────────────────
      const scanConfig = {
        fps: 10,
        qrbox: (vw: number, vh: number) => {
          if (isBarcode) {
            return { width: Math.floor(vw * 0.92), height: Math.floor(vh * 0.50) };
          }
          const side = Math.floor(Math.min(vw, vh) * 0.72);
          return { width: side, height: side };
        },
      };

      const onSuccess = async (text: string) => { await handleResult(text, scanner); };
      const onError   = () => {};

      // ── 5. Constraints com retry progressivo ──────────────────────────────
      // APK nativo: alta resolução → fallback simples
      // PWA/browser: SEM width/height (causa OverconstrainedError em muitos Android)
      const constraintsList: MediaTrackConstraints[] = Capacitor.isNativePlatform()
        ? [
            { facingMode: 'environment', width: { ideal: 720 }, height: { ideal: 1280 } },
            { facingMode: 'environment' },
          ]
        : [
            { facingMode: 'environment' },
            { facingMode: { ideal: 'environment' } },
          ];

      let started = false;
      let lastError: any = null;

      for (const constraints of constraintsList) {
        if (cancelled || started) break;
        try {
          await scanner!.start(constraints, scanConfig, onSuccess, onError);
          started = true;
        } catch (err: any) {
          lastError = err;
          const name: string = err?.name ?? String(err);
          console.warn('Scanner start attempt failed:', name, constraints);

          // Erros fatais — não adianta tentar outras constraints
          if (name === 'NotAllowedError' || name === 'NotFoundError') break;

          // OverconstrainedError / NotReadableError / outros → tenta próximas constraints
          await new Promise(r => setTimeout(r, 200)); // pequena pausa antes do retry
        }
      }

      if (cancelled) return;

      if (started) {
        setIsScanning(true);
        try {
          const caps = scanner?.getRunningTrackCapabilities() as any;
          if (caps?.torch !== undefined) setTorchAvailable(true);
        } catch {}
        return;
      }

      // ── 6. Todos os attempts falharam ─────────────────────────────────────
      const errName: string = lastError?.name ?? '';
      if (errName === 'NotAllowedError') {
        setCameraError('Permissão de câmera negada. Toque no cadeado 🔒 na barra de endereços e habilite a Câmera.');
      } else if (errName === 'NotFoundError') {
        setCameraError('Nenhuma câmera encontrada neste dispositivo.');
      } else if (errName === 'NotReadableError') {
        setCameraError('A câmera está sendo usada por outro aplicativo. Feche-o e tente novamente.');
      } else {
        setCameraError(
          `Não foi possível abrir a câmera (${errName || 'erro desconhecido'}). Tente recarregar a página.`,
        );
      }
    };

    initScanner();

    return () => {
      cancelled = true;
      if (scanner?.isScanning) {
        scanner.stop().catch(() => {}).finally(() => {
          try { scanner?.clear(); } catch {}
        });
      }
    };
  }, [open, isBarcode, expectedType, handleResult]);

  if (!open) return null;

  const titleText = isBarcode
    ? 'Enquadre o código de barras dentro dos marcadores'
    : expectedType === 'pix'
    ? 'Enquadre o QR Code na moldura'
    : 'Enquadre o código na moldura';

  return (
    <div className="fixed inset-0 z-[9999] bg-black flex flex-col overflow-hidden">
      {/* Input oculto para galeria */}
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
      <div id="gallery-reader" className="hidden" />

      {/* ── Barra superior ── */}
      <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-4 pt-10 pb-3 bg-gradient-to-b from-black/80 to-transparent">
        <button
          onClick={() => onOpenChange(false)}
          className="flex items-center justify-center h-10 w-10 rounded-full bg-black/50 text-white"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>

        {torchAvailable && (
          <button
            onClick={toggleTorch}
            className={`flex items-center justify-center h-10 w-10 rounded-full ${torchOn ? 'bg-yellow-400/30 text-yellow-300' : 'bg-black/50 text-white'}`}
          >
            {torchOn ? <ZapOff className="h-5 w-5" /> : <Zap className="h-5 w-5" />}
          </button>
        )}
      </div>

      {/* ── Área de câmera ── */}
      <div className="relative flex-1 bg-black overflow-hidden">
        <div
          id={regionId}
          className="absolute inset-0 w-full h-full"
        />
        {/* Esconde a UI padrão do html5-qrcode via CSS */}
        <style>{`
          #${regionId} > div:not(:has(video)) { display: none !important; }
          #${regionId} video { width: 100% !important; height: 100% !important; object-fit: cover !important; }
        `}</style>

        {cameraError ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-8 text-center bg-black/90 z-10">
            <AlertCircle className="h-12 w-12 text-red-400" />
            <p className="text-white text-sm font-medium">{cameraError}</p>
            <Button size="sm" variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
          </div>

        ) : isBarcode ? (
          // ══════════════════════════════════════════════════
          //  MODO BOLETO — janela alta, linha animada horizontal
          // ══════════════════════════════════════════════════
          <div className="absolute inset-0 pointer-events-none z-10">
            <div
              className="absolute"
              style={{
                inset: 0,
                background: `linear-gradient(
                  to bottom,
                  rgba(0,0,0,0.6) 0%,
                  rgba(0,0,0,0.6) 25%,
                  transparent 25%,
                  transparent 75%,
                  rgba(0,0,0,0.6) 75%,
                  rgba(0,0,0,0.6) 100%
                )`,
              }}
            />
            <div className="absolute inset-y-0" style={{ left: 0, width: '4%', background: 'rgba(0,0,0,0.6)' }} />
            <div className="absolute inset-y-0" style={{ right: 0, width: '4%', background: 'rgba(0,0,0,0.6)' }} />

            <div className="absolute" style={{ left: '4%', right: '4%', top: '25%', bottom: '25%' }}>
              <div className="absolute top-0 left-0   w-7 h-7 border-t-[3px] border-l-[3px] border-yellow-400" />
              <div className="absolute top-0 right-0  w-7 h-7 border-t-[3px] border-r-[3px] border-yellow-400" />
              <div className="absolute bottom-0 left-0  w-7 h-7 border-b-[3px] border-l-[3px] border-yellow-400" />
              <div className="absolute bottom-0 right-0 w-7 h-7 border-b-[3px] border-r-[3px] border-yellow-400" />

              <div
                className="absolute top-0 bottom-0 w-[2px] bg-yellow-400"
                style={{
                  left: `${scanLineX}%`,
                  boxShadow: '0 0 10px 3px rgba(250,204,21,0.75)',
                  transition: 'left 16ms linear',
                }}
              />
            </div>

            <div className="absolute right-1 top-1/2 -translate-y-1/2 z-20" style={{ writingMode: 'vertical-rl' }}>
              <span
                className="text-white/90 text-[11px] font-semibold tracking-wide drop-shadow-md"
                style={{ transform: 'rotate(180deg)', display: 'block' }}
              >
                {titleText}
              </span>
            </div>
          </div>

        ) : (
          // ══════════════════════════════════════════════════
          //  MODO QR CODE / PIX — moldura quadrada com cantos
          // ══════════════════════════════════════════════════
          <div className="absolute inset-0 pointer-events-none z-10">
            <div className="absolute inset-0 bg-black/55" />
            <div
              className="absolute"
              style={{
                top: '50%', left: '50%',
                transform: 'translate(-50%, -55%)',
                width:  '72vmin',
                height: '72vmin',
                boxShadow: '0 0 0 9999px rgba(0,0,0,0.55)',
                background: 'transparent',
              }}
            >
              <div className="absolute top-0 left-0  w-8 h-8 border-l-[3px] border-t-[3px] border-white" />
              <div className="absolute top-0 right-0 w-8 h-8 border-r-[3px] border-t-[3px] border-white" />
              <div className="absolute bottom-0 left-0  w-8 h-8 border-l-[3px] border-b-[3px] border-white" />
              <div className="absolute bottom-0 right-0 w-8 h-8 border-r-[3px] border-b-[3px] border-white" />
            </div>
          </div>
        )}
      </div>

      {/* ── Barra inferior: instrução + galeria ── */}
      <div className="absolute bottom-0 left-0 right-0 z-20 flex flex-col items-center gap-4 pb-10 pt-5 px-6 bg-gradient-to-t from-black/85 to-transparent">
        {!isBarcode && (
          <p className="text-white text-sm font-semibold text-center drop-shadow-md">
            {titleText}
          </p>
        )}

        <button
          onClick={handleGallery}
          className="flex flex-col items-center gap-1.5 text-white opacity-90 active:opacity-60 transition-opacity"
        >
          <div className="h-12 w-12 rounded-full bg-white/20 backdrop-blur-sm border border-white/30 flex items-center justify-center">
            <ImageIcon className="h-6 w-6 text-white" />
          </div>
          <span className="text-[11px] text-white/80 font-medium">Galeria</span>
        </button>
      </div>

      {/* ── Botão lateral esquerdo (modo boleto) ── */}
      {isBarcode && (
        <div className="absolute left-0 top-1/2 -translate-y-1/2 z-20 flex flex-col gap-3 pl-3">
          <button
            onClick={() => onOpenChange(false)}
            className="flex flex-col items-center justify-center gap-2 h-[72px] w-[60px] rounded-2xl bg-blue-600/90 text-white text-center px-1 backdrop-blur-sm active:bg-blue-700 transition-colors"
          >
            <Keyboard className="h-5 w-5 shrink-0" />
            <span className="text-[10px] font-semibold leading-tight">Digitar código</span>
          </button>
        </div>
      )}
    </div>
  );
}
