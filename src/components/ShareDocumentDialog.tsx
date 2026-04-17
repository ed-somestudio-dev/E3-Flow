import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { FileText, Image as ImageIcon, Share2, Loader2 } from 'lucide-react';
import { downloadBlob, shareBlob } from '@/lib/documents';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  filenameBase: string;
  generatePDF: () => Promise<Blob>;
  generatePNG: () => Promise<Blob>;
}

export function ShareDocumentDialog({ open, onOpenChange, title, filenameBase, generatePDF, generatePNG }: Props) {
  const [loading, setLoading] = useState<string | null>(null);

  const handle = async (kind: 'pdf' | 'png', mode: 'download' | 'share') => {
    setLoading(`${kind}-${mode}`);
    try {
      const blob = kind === 'pdf' ? await generatePDF() : await generatePNG();
      const filename = `${filenameBase}.${kind}`;
      if (mode === 'share') {
        const ok = await shareBlob(blob, filename, title);
        if (!ok) {
          downloadBlob(blob, filename);
          toast.info('Compartilhamento indisponível, arquivo baixado');
        }
      } else {
        downloadBlob(blob, filename);
        toast.success('Arquivo baixado');
      }
    } catch (e: any) {
      toast.error('Erro ao gerar: ' + (e?.message || 'desconhecido'));
    } finally {
      setLoading(null);
    }
  };

  const canShare = typeof navigator !== 'undefined' && (navigator as any).canShare;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">Escolha como deseja salvar ou compartilhar o documento.</p>
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
