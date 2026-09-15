import { useEffect, useRef, useState, useCallback } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Image as ImageIcon, Keyboard, Zap, ZapOff, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { detectScannedType } from '@/lib/scanner-utils';
import { Camera } from '@capacitor/camera';
import { Capacitor } from '@capacitor/core';
import { BarcodeScanner, BarcodeFormat, LensFacing } from '@capacitor-mlkit/barcode-scanning';

interface CameraScannerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onScan: (scannedText: string, detectedType: 'pix' | 'barcode' | 'unknown') => void;
  title?: string;
  expectedType?: 'pix' | 'barcode' | 'auto';
}

// ─── Helper: ML Kit formats por modo ─────────────────────────────────────────
function getMlKitFormats(expectedType: 'pix' | 'barcode' | 'auto'): BarcodeFormat[] {
  if (expectedType === 'barcode') {
    return [
      BarcodeFormat.Code128,
      BarcodeFormat.Itf,
      BarcodeFormat.Ean13,
      BarcodeFormat.Ean8,
      BarcodeFormat.UpcA,
      BarcodeFormat.Code39,
      BarcodeFormat.Codabar,
    ];
  }
  if (expectedType === 'pix') {
    return [BarcodeFormat.QrCode];
  }
  // auto: tudo
  return [
    BarcodeFormat.QrCode,
    BarcodeFormat.Code128,
    BarcodeFormat.Itf,
    BarcodeFormat.Ean13,
    BarcodeFormat.Ean8,
    BarcodeFormat.UpcA,
    BarcodeFormat.Code39,
    BarcodeFormat.Codabar,
    BarcodeFormat.DataMatrix,
  ];
}

export function CameraScannerModal({
  open,
  onOpenChange,
  onScan,
  expectedType = 'auto',
}: CameraScannerModalProps) {
  const isNative = Capacitor.isNativePlatform();

  // ─── Estado ───────────────────────────────────────────────────────────────
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const hasScannedRef = useRef<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Rastreia a promise de cleanup para aguardar liberação da câmera antes de reiniciar
  const cleanupPromiseRef = useRef<Promise<void>>(Promise.resolve());
  const mlkitActiveRef = useRef<boolean>(false);
  const [isScanning, setIsScanning] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [torchAvailable, setTorchAvailable] = useState(false);
  const [torchOn, setTorchOn] = useState(false);

  // Sem estado de animação JS — linha animada por CSS puro (zero re-renders)
  const regionId = 'html5-qrcode-scanner-region';
  const isBarcode = expectedType === 'barcode';

  // ─── Handler de resultado (PWA) ───────────────────────────────────────────
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

  // ─── Galeria (PWA) ────────────────────────────────────────────────────────
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

  // ─── Lanterna (PWA) ───────────────────────────────────────────────────────
  const toggleTorch = async () => {
    if (isNative) {
      try {
        if (torchOn) {
          await BarcodeScanner.disableTorch();
        } else {
          await BarcodeScanner.enableTorch();
        }
        setTorchOn(t => !t);
      } catch {
        toast.info('Lanterna não disponível');
      }
      return;
    }
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

  // ─── ML Kit — scanner nativo ──────────────────────────────────────────────
  useEffect(() => {
    if (!isNative) return;

    if (!open) {
      // Para o scanner nativo se estiver ativo
      if (mlkitActiveRef.current) {
        mlkitActiveRef.current = false;
        BarcodeScanner.stopScan().catch(() => {});
        document.querySelector('body')?.classList.remove('barcode-scanner-active');
      }
      setIsScanning(false);
      setCameraError(null);
      hasScannedRef.current = false;
      return;
    }

    let cancelled = false;
    hasScannedRef.current = false;
    setCameraError(null);
    setIsScanning(false);
    setTorchOn(false);
    setTorchAvailable(true); // ML Kit sempre suporta lanterna

    const startNativeScanner = async () => {
      // 1. Permissão
      try {
        const status = await Camera.checkPermissions();
        if (status.camera === 'denied') {
          if (!cancelled) setCameraError('Permissão de câmera negada. Acesse Configurações > Aplicativos > E3 Flow > Permissões e habilite a Câmera.');
          return;
        }
        if (status.camera !== 'granted') {
          const result = await Camera.requestPermissions({ permissions: ['camera'] });
          if (result.camera !== 'granted') {
            if (!cancelled) setCameraError('Permissão de câmera negada.');
            return;
          }
        }
      } catch { /* ignora */ }

      if (cancelled) return;

      // 2. Verifica disponibilidade do ML Kit
      try {
        const { available } = await BarcodeScanner.isGoogleBarcodeScannerModuleAvailable();
        if (!available) {
          await BarcodeScanner.installGoogleBarcodeScannerModule();
          // Aguarda instalação
          await new Promise(r => setTimeout(r, 2000));
        }
      } catch { /* ignora — tenta mesmo assim */ }

      if (cancelled) return;

      // 3. Inicia scan nativo com listener
      try {
        mlkitActiveRef.current = true;
        document.querySelector('body')?.classList.add('barcode-scanner-active');

        const formats = getMlKitFormats(expectedType);

        await BarcodeScanner.startScan({ formats, lensFacing: LensFacing.Back });

        if (cancelled) {
          BarcodeScanner.stopScan().catch(() => {});
          document.querySelector('body')?.classList.remove('barcode-scanner-active');
          return;
        }

        setIsScanning(true);

        // Listener de resultados
        await BarcodeScanner.addListener('barcodeScanned', async (event) => {
          if (hasScannedRef.current || cancelled) return;
          hasScannedRef.current = true;

          const rawValue = event.barcode.rawValue ?? '';
          if (!rawValue) return;

          mlkitActiveRef.current = false;
          await BarcodeScanner.stopScan().catch(() => {});
          document.querySelector('body')?.classList.remove('barcode-scanner-active');

          try { navigator.vibrate?.([100, 50, 100]); } catch {}

          const detected  = detectScannedType(rawValue);
          const finalType = expectedType !== 'auto' ? expectedType : detected;

          toast.success(
            finalType === 'pix'     ? 'QR Code PIX lido com sucesso!'     :
            finalType === 'barcode' ? 'Código de barras lido com sucesso!' :
                                      'Código lido com sucesso!',
          );

          onScan(rawValue.trim(), finalType);
          onOpenChange(false);
        });
      } catch (err: any) {
        if (!cancelled) {
          document.querySelector('body')?.classList.remove('barcode-scanner-active');
          mlkitActiveRef.current = false;
          const msg = err?.message ?? '';
          if (msg.includes('permission') || msg.includes('denied')) {
            setCameraError('Permissão de câmera negada. Acesse Configurações > Aplicativos > E3 Flow > Permissões.');
          } else {
            setCameraError(`Não foi possível abrir a câmera: ${msg || 'erro desconhecido'}`);
          }
        }
      }
    };

    startNativeScanner();

    return () => {
      cancelled = true;
      if (mlkitActiveRef.current) {
        mlkitActiveRef.current = false;
        BarcodeScanner.stopScan().catch(() => {});
        BarcodeScanner.removeAllListeners().catch(() => {});
        document.querySelector('body')?.classList.remove('barcode-scanner-active');
      }
    };
  }, [open, isNative, expectedType, onScan, onOpenChange]);

  // ─── Html5Qrcode — scanner PWA ────────────────────────────────────────────
  useEffect(() => {
    if (isNative) return;

    let cancelled = false;
    // Ref local para o stream de BarcodeDetector (se usado)
    let bdStream: MediaStream | null = null;
    let bdAnimFrame: number | null = null;
    let h5scanner: Html5Qrcode | null = null;

    if (!open) {
      const s = scannerRef.current;
      scannerRef.current = null;
      setIsScanning(false);
      if (s) {
        cleanupPromiseRef.current = (s.isScanning ? s.stop().catch(() => {}) : Promise.resolve())
          .finally(() => {
            try { s.clear(); } catch {}
            try {
              const el = document.getElementById(regionId);
              if (el) el.innerHTML = '';
            } catch {}
          }) as Promise<void>;
      } else {
        cleanupPromiseRef.current = Promise.resolve();
      }
      return;
    }

    setCameraError(null);
    setIsScanning(false);
    setTorchOn(false);
    setTorchAvailable(false);
    hasScannedRef.current = false;

    const handleDetected = (rawValue: string) => {
      if (!rawValue || hasScannedRef.current) return;
      hasScannedRef.current = true;

      // Para o stream de BarcodeDetector
      if (bdAnimFrame) { cancelAnimationFrame(bdAnimFrame); bdAnimFrame = null; }
      if (bdStream) { bdStream.getTracks().forEach(t => t.stop()); bdStream = null; }

      try { navigator.vibrate?.([100, 50, 100]); } catch {}
      const detected  = detectScannedType(rawValue);
      const finalType = expectedType !== 'auto' ? expectedType : detected;
      toast.success(
        finalType === 'pix'     ? 'QR Code PIX lido com sucesso!'     :
        finalType === 'barcode' ? 'Código de barras lido com sucesso!' :
                                  'Código lido com sucesso!',
      );
      onScan(rawValue.trim(), finalType);
      onOpenChange(false);
    };

    // ── Tenta BarcodeDetector nativo (Chrome Android 83+, hardware-accelerated) ──
    const tryBarcodeDetector = async (): Promise<boolean> => {
      if (typeof (window as any).BarcodeDetector === 'undefined') return false;
      try {
        const supported: string[] = await (window as any).BarcodeDetector.getSupportedFormats();
        const need = isBarcode
          ? ['code_128', 'itf', 'ean_13', 'ean_8', 'upc_a', 'code_39', 'codabar']
          : expectedType === 'pix'
          ? ['qr_code']
          : ['qr_code', 'code_128', 'itf', 'ean_13', 'ean_8'];
        const formats = need.filter(f => supported.includes(f));
        if (formats.length === 0) return false;

        const constraintsList = isBarcode ? [
          { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
          { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
          { facingMode: 'environment' }
        ] : [
          { facingMode: 'environment' }
        ];

        let stream: MediaStream | null = null;
        for (const constraints of constraintsList) {
          try {
            stream = await navigator.mediaDevices.getUserMedia({ video: constraints });
            break;
          } catch (e) {
            // ignora e tenta o próximo
          }
        }
        if (!stream) return false;

        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return false; }
        bdStream = stream;

        // Encontra a <video> que já está no DOM (ou cria uma temporária)
        let video = document.getElementById('bd-video') as HTMLVideoElement | null;
        if (!video) {
          video = document.createElement('video');
          video.id = 'bd-video';
          video.setAttribute('playsinline', 'true');
          video.muted = true;
          video.autoplay = true;
          video.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;object-fit:cover;pointer-events:none;z-index:0';
          document.getElementById('bd-container')?.appendChild(video);
        }
        video.srcObject = stream;
        await video.play().catch(() => {});
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return false; }

        setIsScanning(true);

        const detector = new (window as any).BarcodeDetector({ formats });
        const scan = async () => {
          if (cancelled || hasScannedRef.current) return;
          try {
            const results = await detector.detect(video);
            if (results.length > 0) {
              handleDetected(results[0].rawValue);
              return;
            }
          } catch {}
          bdAnimFrame = requestAnimationFrame(scan);
        };
        bdAnimFrame = requestAnimationFrame(scan);
        return true;
      } catch {
        return false;
      }
    };

    // ── Fallback: Html5Qrcode ──────────────────────────────────────────────────
    const tryHtml5Qrcode = async () => {
      await cleanupPromiseRef.current;
      if (cancelled) return;
      await new Promise(r => setTimeout(r, 150));
      if (cancelled) return;

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

      const scanConfig: any = {
        fps: 15,
      };
      
      // Para barcode, NÃO define qrbox para utilizar 100% da área (ideal para horizontal)
      if (!isBarcode) {
        scanConfig.qrbox = (vw: number, vh: number) => {
          const side = Math.floor(Math.min(vw, vh) * 0.72);
          return { width: side, height: side };
        };
      }

      const onSuccess = async (text: string) => { handleDetected(text); };
      const onError   = () => {};
      const constraintsList: MediaTrackConstraints[] = [
        { facingMode: 'environment' },
        { facingMode: { ideal: 'environment' } },
      ];

      let started = false;
      let lastError: any = null;

      for (const constraints of constraintsList) {
        if (cancelled || started) break;
        try {
          if (h5scanner) { try { h5scanner.clear(); } catch {} }
          try {
            const el = document.getElementById(regionId);
            if (el) el.innerHTML = '';
          } catch {}
          h5scanner = new Html5Qrcode(regionId, { formatsToSupport: formats, verbose: false });
          scannerRef.current = h5scanner;
        } catch { break; }

        try {
          await h5scanner!.start(constraints, scanConfig, onSuccess, onError);
          started = true;
        } catch (err: any) {
          lastError = err;
          const name: string = err?.name ?? String(err);
          if (name === 'NotAllowedError' || name === 'NotFoundError') break;
          await new Promise(r => setTimeout(r, 200));
        }
      }

      if (cancelled) return;
      if (started) { setIsScanning(true); return; }

      const errName: string = lastError?.name ?? '';
      if (errName === 'NotAllowedError') {
        setCameraError('Permissão de câmera negada. Toque no cadeado 🔒 na barra de endereços e habilite a Câmera.');
      } else if (errName === 'NotFoundError') {
        setCameraError('Nenhuma câmera encontrada neste dispositivo.');
      } else if (errName === 'NotReadableError') {
        setCameraError('A câmera está sendo usada por outro aplicativo. Feche-o e tente novamente.');
      } else {
        setCameraError(`Não foi possível abrir a câmera (${errName || 'erro desconhecido'}). Tente recarregar a página.`);
      }
    };

    const init = async () => {
      const usedBD = await tryBarcodeDetector();
      if (!cancelled && !usedBD) await tryHtml5Qrcode();
    };
    init();

    return () => {
      cancelled = true;
      if (bdAnimFrame) cancelAnimationFrame(bdAnimFrame);
      if (bdStream) { bdStream.getTracks().forEach(t => t.stop()); bdStream = null; }
      if (h5scanner) {
        (h5scanner.isScanning ? h5scanner.stop().catch(() => {}) : Promise.resolve())
          .finally(() => {
            try { h5scanner?.clear(); } catch {}
            try {
              const el = document.getElementById(regionId);
              if (el) el.innerHTML = '';
            } catch {}
          });
      }
    };
  }, [open, isNative, isBarcode, expectedType, onScan, onOpenChange]);

  // ─── No modo nativo, a UI da câmera é gerenciada pelo ML Kit (Activity nativa) ─
  // Só mostramos a UI personalizada no PWA ou em caso de erro no nativo
  if (!open) return null;

  // Nativo com erro: mostra tela de erro
  if (isNative && cameraError) {
    return (
      <div className="fixed inset-0 z-[9999] bg-black flex flex-col items-center justify-center gap-4 p-8 text-center">
        <AlertCircle className="h-12 w-12 text-red-400" />
        <p className="text-white text-sm font-medium">{cameraError}</p>
        <Button size="sm" variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
      </div>
    );
  }

  // Nativo sem erro: ML Kit gerencia a câmera em Activity nativa,
  // retornamos null para não mostrar UI sobreposta
  if (isNative) return null;

  // ─── UI PWA ───────────────────────────────────────────────────────────────
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
        {/* Container do BarcodeDetector (video gerenciado por JS) */}
        <div id="bd-container" className="absolute inset-0 w-full h-full" style={{ pointerEvents: 'none' }} />

        {/* Container do Html5Qrcode (fallback) — wrapper com pointer-events:none que Html5Qrcode NÃO gerencia */}
        <div className="absolute inset-0 w-full h-full" style={{ pointerEvents: 'none' }}>
          <div id={regionId} className="w-full h-full" />
        </div>

        {/* CSS: suprime TODOS os elementos filhos do scanner — ! garante override de estilos inline do Html5Qrcode */}
        <style>{`
          #bd-container, #bd-container * { pointer-events: none !important; }
          #${regionId}, #${regionId} * { pointer-events: none !important; }
          #${regionId} > div { display: none !important; }
          #${regionId} > div:has(video) { display: block !important; }
          #${regionId} video { width: 100% !important; height: 100% !important; object-fit: cover !important; }
          @keyframes scanner-sweep {
            0%   { left: 4%; }
            50%  { left: 92%; }
            100% { left: 4%; }
          }
        `}</style>

        {cameraError ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-8 text-center bg-black/90 z-10">
            <AlertCircle className="h-12 w-12 text-red-400" />
            <p className="text-white text-sm font-medium">{cameraError}</p>
            <Button size="sm" variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
          </div>

        ) : isBarcode ? (
          // ══════════════════════════════════════════════════
          //  MODO BOLETO — janela alta, linha animada
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

              {/* Linha animada via CSS — zero re-renders React */}
              <div
                className="absolute top-0 bottom-0 w-[2px] bg-yellow-400"
                style={{
                  left: '4%',
                  boxShadow: '0 0 10px 3px rgba(250,204,21,0.75)',
                  animation: 'scanner-sweep 2s ease-in-out infinite',
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
