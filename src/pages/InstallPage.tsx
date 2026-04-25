import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Download, Smartphone, Apple, Monitor, CheckCircle2, Share2, Plus } from 'lucide-react';
import logoFluxoPro from '@/assets/Logo_FluxoPro.png';

// Tipo do evento `beforeinstallprompt` (não está no lib.dom padrão)
interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
  prompt(): Promise<void>;
}

function detectPlatform(): 'ios' | 'android' | 'desktop' | 'unknown' {
  if (typeof navigator === 'undefined') return 'unknown';
  const ua = navigator.userAgent.toLowerCase();
  if (/iphone|ipad|ipod/.test(ua)) return 'ios';
  if (/android/.test(ua)) return 'android';
  if (/windows|macintosh|linux/.test(ua)) return 'desktop';
  return 'unknown';
}

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    // iOS Safari
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export default function InstallPage() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState<boolean>(isStandalone());
  const [platform] = useState(detectPlatform());

  useEffect(() => {
    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferredPrompt(null);
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    if (choice.outcome === 'accepted') {
      setInstalled(true);
    }
    setDeferredPrompt(null);
  };

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-6">
      <div className="flex flex-col items-center text-center gap-3">
        <img src={logoFluxoPro} alt="FluxoPro" className="h-32 sm:h-40 object-contain" />
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Instalar o FluxoPro</h1>
        <p className="text-muted-foreground max-w-xl">
          Tenha o FluxoPro como um aplicativo na tela inicial do seu dispositivo, com acesso rápido,
          ícone próprio e funcionamento em tela cheia.
        </p>
      </div>

      {installed && (
        <Alert>
          <CheckCircle2 className="h-4 w-4" />
          <AlertTitle>App já instalado</AlertTitle>
          <AlertDescription>
            Você está acessando o FluxoPro como aplicativo instalado. Procure o ícone na tela inicial
            ou no menu de aplicativos do seu dispositivo.
          </AlertDescription>
        </Alert>
      )}

      {!installed && deferredPrompt && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download className="h-5 w-5" />
              Instalar agora
            </CardTitle>
            <CardDescription>
              Seu navegador suporta instalação em um clique.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button size="lg" onClick={handleInstall} className="w-full sm:w-auto">
              <Download className="h-4 w-4 mr-2" />
              Instalar FluxoPro
            </Button>
          </CardContent>
        </Card>
      )}

      {!installed && (
        <div className="grid gap-4 md:grid-cols-3">
          <Card className={platform === 'android' ? 'border-primary' : ''}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Smartphone className="h-5 w-5" />
                Android
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-2 text-muted-foreground">
              <p>1. Abra esta página no <strong>Chrome</strong>.</p>
              <p>2. Toque no menu <strong>⋮</strong> no topo.</p>
              <p>3. Escolha <strong>"Instalar app"</strong> ou <strong>"Adicionar à tela inicial"</strong>.</p>
            </CardContent>
          </Card>

          <Card className={platform === 'ios' ? 'border-primary' : ''}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Apple className="h-5 w-5" />
                iPhone / iPad
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-2 text-muted-foreground">
              <p>1. Abra esta página no <strong>Safari</strong>.</p>
              <p className="flex items-center gap-1 flex-wrap">
                2. Toque no botão <Share2 className="inline h-4 w-4" /> <strong>Compartilhar</strong>.
              </p>
              <p className="flex items-center gap-1 flex-wrap">
                3. Escolha <Plus className="inline h-4 w-4" /> <strong>"Adicionar à Tela de Início"</strong>.
              </p>
            </CardContent>
          </Card>

          <Card className={platform === 'desktop' ? 'border-primary' : ''}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Monitor className="h-5 w-5" />
                Desktop
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-2 text-muted-foreground">
              <p>1. Use <strong>Chrome</strong>, <strong>Edge</strong> ou <strong>Brave</strong>.</p>
              <p>2. Clique no ícone <Download className="inline h-4 w-4" /> na barra de endereço.</p>
              <p>3. Confirme em <strong>"Instalar"</strong>.</p>
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Vantagens de instalar</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="text-sm text-muted-foreground space-y-2 list-disc pl-5">
            <li>Ícone próprio na tela inicial e no menu de apps</li>
            <li>Abre em tela cheia, sem barra do navegador</li>
            <li>Acesso mais rápido às telas principais</li>
            <li>Funciona offline para consulta de dados já carregados</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}