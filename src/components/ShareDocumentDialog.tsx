import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { FileText, Image as ImageIcon, Share2, Loader2, Copy, Check, Send } from 'lucide-react';
import { downloadBlob, shareBlob } from '@/lib/documents';
import { Capacitor } from '@capacitor/core';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  filenameBase: string;
  generatePDF: () => Promise<Blob>;
  generatePNG: () => Promise<Blob>;
  /** Optional PIX BR Code (copia e cola) text. When provided, shows copy/share buttons. */
  pixCopyText?: Promise<string> | string;
}

export function ShareDocumentDialog({ open, onOpenChange, title, filenameBase, generatePDF, generatePNG, pixCopyText }: Props) {
  const [loading, setLoading] = useState<string | null>(null);
  const [pixCode, setPixCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) { setCopied(false); return; }
    if (pixCopyText === undefined) { setPixCode(null); return; }
    if (typeof pixCopyText === 'string') { setPixCode(pixCopyText); return; }
    setPixCode(null);
    pixCopyText.then(setPixCode).catch(() => setPixCode(null));
  }, [open, pixCopyText]);

  const handle = async (kind: 'pdf' | 'png', mode: 'download' | 'share') => {
    setLoading(`${kind}-${mode}`);
    try {
      const blob = kind === 'pdf' ? await generatePDF() : await generatePNG();
      const filename = `${filenameBase}.${kind}`;
      if (mode === 'share') {
        const ok = await shareBlob(blob, filename, title);
        if (!ok) {
          const saved = await downloadBlob(blob, filename);
          if (saved) {
            toast.info(Capacitor.isNativePlatform() ? 'Compartilhamento indisponível, arquivo salvo em Documentos' : 'Compartilhamento indisponível, arquivo baixado');
          } else {
            toast.error('Erro ao salvar o arquivo');
          }
        }
      } else {
        const saved = await downloadBlob(blob, filename);
        if (saved) {
          toast.success(Capacitor.isNativePlatform() ? 'Arquivo salvo na pasta Documentos' : 'Arquivo baixado com sucesso');
        } else {
          toast.error('Erro ao salvar o arquivo');
        }
      }
    } catch (e: any) {
      toast.error('Erro ao gerar: ' + (e?.message || 'desconhecido'));
    } finally {
      setLoading(null);
    }
  };

  const copyPix = async () => {
    if (!pixCode) return;
    try {
      await navigator.clipboard.writeText(pixCode);
      setCopied(true);
      toast.success('PIX copiado! Cole no app do seu banco.');
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast.error('Não foi possível copiar');
    }
  };

  const sharePix = async () => {
    if (!pixCode) return;
    
    if (Capacitor.isNativePlatform()) {
      try {
        const { Share } = await import('@capacitor/share');
        await Share.share({ title, text: pixCode, dialogTitle: 'Compartilhar PIX' });
        return;
      } catch { /* user cancelled or error */ }
    } else {
      const nav = navigator as any;
      if (nav.share) {
        try {
          await nav.share({ title, text: pixCode });
          return;
        } catch { /* user cancelled */ }
      }
    }
    await copyPix();
  };

  const canShare = Capacitor.isNativePlatform() || (typeof navigator !== 'undefined' && !!(navigator as any).canShare);
  const canShareText = Capacitor.isNativePlatform() || (typeof navigator !== 'undefined' && !!(navigator as any).share);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">Escolha como deseja salvar ou compartilhar o documento.</p>

          {pixCopyText !== undefined && (
            <div className="space-y-2 p-3 rounded-lg bg-muted/50 border border-border">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase text-muted-foreground">PIX Copia e Cola</span>
                {!pixCode && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
              </div>
              {pixCode && (
                <>
                  <div className="text-[10px] font-mono break-all bg-background p-2 rounded border max-h-24 overflow-y-auto select-all">
                    {pixCode}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Button size="sm" variant="outline" onClick={copyPix} disabled={!pixCode}>
                      {copied ? <Check className="h-4 w-4 mr-1" /> : <Copy className="h-4 w-4 mr-1" />}
                      {copied ? 'Copiado' : 'Copiar PIX'}
                    </Button>
                    <Button size="sm" onClick={sharePix} disabled={!pixCode}>
                      <Send className="h-4 w-4 mr-1" />
                      {canShareText ? 'Compartilhar' : 'Copiar'}
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Button variant="outline" onClick={() => handle('pdf', 'download')} disabled={!!loading} className="h-auto py-3 flex-col gap-1">
              {loading === 'pdf-download' ? <Loader2 className="h-5 w-5 animate-spin" /> : <FileText className="h-5 w-5" />}
              <span className="text-sm">Baixar PDF</span>
            </Button>
            <Button variant="outline" onClick={() => handle('png', 'download')} disabled={!!loading} className="h-auto py-3 flex-col gap-1">
              {loading === 'png-download' ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImageIcon className="h-5 w-5" />}
              <span className="text-sm">Baixar Imagem (PNG)</span>
            </Button>
            {canShare && (
              <>
                <Button onClick={() => handle('pdf', 'share')} disabled={!!loading} className="h-auto py-3 flex-col gap-1">
                  {loading === 'pdf-share' ? <Loader2 className="h-5 w-5 animate-spin" /> : <Share2 className="h-5 w-5" />}
                  <span className="text-sm">Compartilhar PDF</span>
                </Button>
                <Button onClick={() => handle('png', 'share')} disabled={!!loading} className="h-auto py-3 flex-col gap-1">
                  {loading === 'png-share' ? <Loader2 className="h-5 w-5 animate-spin" /> : <Share2 className="h-5 w-5" />}
                  <span className="text-sm">Compartilhar Imagem</span>
                </Button>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
