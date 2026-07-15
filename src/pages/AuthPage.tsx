import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Mail, Lock, Chrome, ArrowLeft, PieChart, QrCode, Package, Users, Eye, EyeOff, HelpCircle, Loader2, PlayCircle } from 'lucide-react';
import logoE3Flow from '@/assets/Logo_E3Flow_Final.png';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth-context';

export default function AuthPage() {
  const { signInAsGuest } = useAuth();
  const [mode, setMode] = useState<'login' | 'signup' | 'forgot'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const [supportOpen, setSupportOpen] = useState(false);
  const [supportEmail, setSupportEmail] = useState('');
  const [supportSubject, setSupportSubject] = useState('');
  const [supportMessage, setSupportMessage] = useState('');
  const [sendingSupport, setSendingSupport] = useState(false);
  const [videoOpen, setVideoOpen] = useState(false);

  const handleSupportSubmit = async () => {
    if (!supportEmail.trim() || !supportSubject.trim() || !supportMessage.trim()) {
      toast.error('Preencha seu e-mail, assunto e mensagem.');
      return;
    }

    setSendingSupport(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-support-email', {
        body: {
          visitorEmail: supportEmail,
          subject: supportSubject,
          message: supportMessage
        }
      });

      if (error) throw new Error(error.message || 'Erro ao comunicar com o servidor');
      if (data?.error) throw new Error(data.error);

      toast.success('Mensagem enviada com sucesso! Retornaremos o contato em breve.');
      setSupportEmail('');
      setSupportSubject('');
      setSupportMessage('');
      setSupportOpen(false);
    } catch (err: any) {
      console.error('[Support] Error sending message:', err);
      toast.error(err.message || 'Erro ao enviar mensagem.');
    } finally {
      setSendingSupport(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { Capacitor } = await import('@capacitor/core');
    const redirectUri = Capacitor.isNativePlatform()
      ? 'com.somestudio.e3flow://login-callback'
      : window.location.origin;

    try {
      if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: {
            emailRedirectTo: redirectUri,
            data: {
              full_name: name
            }
          }
        });
        if (error) throw error;

        // Dispara a conversão de Inscrição no Google Ads
        if (typeof window !== 'undefined' && (window as any).gtag) {
          (window as any).gtag('event', 'conversion', {
            'send_to': 'AW-18264257358/QBKcCOP0psgcEM7miYVE',
            'value': 1.0,
            'currency': 'BRL'
          });
        }

        toast.success('Conta criada! Verifique seu email para confirmar.');
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err: any) {
      console.error('Auth error detailed:', err);
      let msg = err.message || 'Erro na autenticação';
      if (msg.includes('origin')) msg += '. Verifique se o domínio está liberado no Supabase.';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      toast.success('Email de recuperação enviado! Verifique sua caixa de entrada.');
      setMode('login');
    } catch (err: any) {
      toast.error(err.message || 'Erro ao enviar email de recuperação');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    try {
      const { Capacitor } = await import('@capacitor/core');
      const isNative = Capacitor.isNativePlatform();
      const redirectUri = isNative
        ? 'com.somestudio.e3flow://login-callback'
        : window.location.origin;

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUri,
          skipBrowserRedirect: isNative,
        }
      });

      if (error) {
        toast.error(error.message || 'Erro ao entrar com Google');
        setLoading(false);
        return;
      }

      if (isNative && data?.url) {
        const { Browser } = await import('@capacitor/browser');
        Browser.addListener('browserFinished', () => {
          setLoading(false);
        });
        await Browser.open({ url: data.url });
      }
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao entrar com Google');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex w-full">
      {/* Lado Esquerdo - Apresentação (Oculto em telas menores) */}
      <div className="hidden lg:flex flex-col flex-1 bg-gradient-to-br from-primary/90 via-primary to-primary/80 text-primary-foreground p-12 justify-center relative overflow-hidden">
        {/* Efeito visual de fundo */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden opacity-10 pointer-events-none">
          <div className="absolute -top-[20%] -left-[10%] w-[50%] h-[50%] rounded-full bg-white blur-3xl"></div>
          <div className="absolute bottom-[10%] -right-[10%] w-[60%] h-[60%] rounded-full bg-white blur-3xl"></div>
        </div>

        <div className="relative z-10 max-w-lg">
          <div className="bg-white p-2 rounded-[2rem] shadow-xl inline-flex items-center justify-center mb-10 w-[200px] h-[200px] overflow-hidden">
            <img src={logoE3Flow} alt="E3 Flow" className="w-full h-full object-contain scale-110" />
          </div>

          <h1 className="text-4xl font-bold mb-4 tracking-tight">
            Dê asas ao seu controle financeiro com E3 Flow!
          </h1>
          <p className="text-primary-foreground/80 text-lg mb-12">
            A plataforma completa e inteligente para simplificar a gestão do seu negócio.
          </p>

          <div className="space-y-8">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-white/10 rounded-xl shrink-0">
                <PieChart className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">Dashboard Inteligente</h3>
                <p className="text-primary-foreground/70 text-sm mt-1">Acompanhe suas receitas, despesas e fluxo de caixa com gráficos interativos e em tempo real.</p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="p-3 bg-white/10 rounded-xl shrink-0">
                <QrCode className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">Cobranças via PIX</h3>
                <p className="text-primary-foreground/70 text-sm mt-1">Gere cobranças com QR Code PIX de forma rápida e segura para seus clientes.</p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="p-3 bg-white/10 rounded-xl shrink-0">
                <Package className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">Gestão de Produtos</h3>
                <p className="text-primary-foreground/70 text-sm mt-1">Controle de estoque impecável, com PDV integrado e histórico completo de vendas.</p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="p-3 bg-white/10 rounded-xl shrink-0">
                <Users className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">Compartilhamento de Conta</h3>
                <p className="text-primary-foreground/70 text-sm mt-1">Gerencie sua empresa ou finanças da família em conjunto com seu sócio ou cônjuge.</p>
              </div>
            </div>
          </div>

          <div className="mt-12 pt-6 border-t border-primary-foreground/10">
            <button onClick={() => setSupportOpen(true)} className="flex items-center gap-2 text-primary-foreground/80 hover:text-white transition-colors">
              <HelpCircle className="h-5 w-5" />
              <span className="font-medium">Precisa de ajuda ou está com problemas no acesso?</span>
            </button>
          </div>
        </div>
      </div>

      {/* Lado Direito - Formulário */}
      <div className="flex-1 flex flex-col justify-center items-center p-6 bg-background">
        <div className="w-full max-w-sm space-y-8">

          <div className="text-center space-y-2 lg:hidden">
            <div className="flex items-center justify-center">
              <img src={logoE3Flow} alt="E3 Flow" className="h-24 object-contain rounded-2xl" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight mt-4">Bem-vindo(a)</h1>
            <p className="text-muted-foreground text-sm">
              Dê asas ao seu controle financeiro com E3 Flow!
            </p>
          </div>

          <div className="text-center space-y-2 hidden lg:block">
            <h2 className="text-3xl font-bold tracking-tight">
              {mode === 'signup' ? 'Crie sua conta' :
                mode === 'forgot' ? 'Recuperação' : 'Acesse o sistema'}
            </h2>
            <p className="text-muted-foreground">
              {mode === 'signup' ? 'Preencha os dados para começar' :
                mode === 'forgot' ? 'Siga os passos para redefinir' : 'Bem-vindo(a) de volta!'}
            </p>
          </div>

          <div className="space-y-4 pt-4">
            {mode === 'forgot' ? (
              <form onSubmit={handleForgotPassword} className="space-y-5">
                <div className="space-y-2">
                  <Label>Email cadastrado</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input type="email" placeholder="seu@email.com" value={email} onChange={e => setEmail(e.target.value)} className="pl-9 h-11" required />
                  </div>
                </div>
                <Button type="submit" className="w-full h-11 text-base font-semibold" disabled={loading}>
                  {loading ? 'Enviando...' : 'Enviar link de recuperação'}
                </Button>
                <button type="button" onClick={() => setMode('login')} className="flex items-center justify-center w-full text-sm text-muted-foreground hover:text-primary transition-colors mt-2">
                  <ArrowLeft className="h-4 w-4 mr-1" />
                  Voltar para o login
                </button>
              </form>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setVideoOpen(true)}
                  className="inline-flex w-full items-center justify-center gap-2 text-sm font-medium text-primary bg-primary/10 hover:bg-primary/20 h-11 rounded-md transition-colors"
                >
                  <PlayCircle className="h-5 w-5" />
                  Assistir vídeo de Primeiros Passos
                </button>

                <Button variant="outline" className="w-full h-11 font-medium bg-card" onClick={handleGoogleLogin}>
                  <Chrome className="h-4 w-4 mr-2" />
                  Entrar com Google
                </Button>

                <Button variant="secondary" className="w-full h-11 font-medium" onClick={signInAsGuest}>
                  Entrar como Visitante (Offline)
                </Button>

                <div className="relative my-6">
                  <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-border" /></div>
                  <div className="relative flex justify-center text-xs uppercase"><span className="bg-background px-2 text-muted-foreground">ou com email</span></div>
                </div>

                <form onSubmit={handleEmailAuth} className="space-y-5">
                  {mode === 'signup' && (
                    <div className="space-y-2">
                      <Label>Nome Completo</Label>
                      <Input type="text" placeholder="Seu nome" value={name} onChange={e => setName(e.target.value)} className="h-11" required />
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input type="email" placeholder="seu@email.com" value={email} onChange={e => setEmail(e.target.value)} className="pl-9 h-11" required />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Senha</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        type={showPassword ? "text" : "password"}
                        placeholder="••••••••"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        className="pl-9 pr-10 h-11"
                        required
                        minLength={6}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                        tabIndex={-1}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <Button type="submit" className="w-full h-11 text-base font-semibold shadow-sm" disabled={loading}>
                    {loading ? 'Carregando...' : mode === 'signup' ? 'Criar Conta' : 'Entrar na Conta'}
                  </Button>
                </form>


                <div className="flex flex-col items-center gap-4 pt-4">
                  {mode === 'login' && (
                    <button onClick={() => setMode('forgot')} className="text-sm text-muted-foreground hover:text-primary transition-colors">
                      Esqueceu a senha?
                    </button>
                  )}
                  <p className="text-center text-sm text-muted-foreground">
                    {mode === 'signup' ? 'Já tem uma conta?' : 'Não tem uma conta?'}{' '}
                    <button onClick={() => setMode(mode === 'signup' ? 'login' : 'signup')} className="text-primary hover:underline font-semibold">
                      {mode === 'signup' ? 'Fazer login' : 'Cadastre-se grátis'}
                    </button>
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Modal de Suporte para Visitantes */}
      <Dialog open={supportOpen} onOpenChange={setSupportOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <HelpCircle className="h-5 w-5 text-primary" />
              Fale com o Suporte
            </DialogTitle>
            <DialogDescription>
              Está com problemas no acesso ou dúvidas sobre a plataforma? Deixe sua mensagem e retornaremos em breve.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Seu E-mail de Contato</Label>
              <Input
                type="email"
                value={supportEmail}
                onChange={e => setSupportEmail(e.target.value)}
                placeholder="seu.email@exemplo.com"
              />
            </div>
            <div className="space-y-2">
              <Label>Assunto</Label>
              <Input
                value={supportSubject}
                onChange={e => setSupportSubject(e.target.value)}
                placeholder="Ex: Problema com o login"
                maxLength={100}
              />
            </div>
            <div className="space-y-2">
              <Label>Mensagem</Label>
              <textarea
                className="flex min-h-[120px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                value={supportMessage}
                onChange={e => setSupportMessage(e.target.value)}
                placeholder="Descreva detalhadamente como podemos te ajudar..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleSupportSubmit} disabled={sendingSupport} className="w-full sm:w-auto">
              {sendingSupport ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              {sendingSupport ? 'Enviando...' : 'Enviar Mensagem'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Vídeo Primeiros Passos */}
      <Dialog open={videoOpen} onOpenChange={setVideoOpen}>
        <DialogContent className="sm:max-w-4xl p-0 overflow-hidden bg-black/95 border-none">
          <div className="relative w-full aspect-video">
            {videoOpen && (
              <iframe
                width="100%"
                height="100%"
                src="https://www.youtube.com/embed/a4zBsrx8oRg?autoplay=1"
                title="Primeiros Passos E3 Flow"
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="absolute inset-0 w-full h-full"
              ></iframe>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
