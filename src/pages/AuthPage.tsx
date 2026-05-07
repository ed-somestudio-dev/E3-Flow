import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { lovable } from '@/integrations/lovable/index';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Mail, Lock, Chrome, ArrowLeft } from 'lucide-react';
import logoFluxoPro from '@/assets/Logo_FluxoPro.png';
import { toast } from 'sonner';

export default function AuthPage() {
  const [mode, setMode] = useState<'login' | 'signup' | 'forgot'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { Capacitor } = await import('@capacitor/core');
    const redirectUri = Capacitor.isNativePlatform() 
      ? 'com.somestudio.fluxopro://login-callback' 
      : window.location.origin;

    try {
      if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: { emailRedirectTo: redirectUri }
        });
        if (error) throw error;
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
      const redirectUri = Capacitor.isNativePlatform()
        ? 'com.somestudio.fluxopro://login-callback'
        : window.location.origin;

      const result = await lovable.auth.signInWithOAuth('google', {
        redirect_uri: redirectUri,
      });

      if (result.error) {
        toast.error(result.error.message || 'Erro ao entrar com Google');
        setLoading(false);
        return;
      }
      // Se redirected, o navegador vai para o Google. Se não, sessão já foi setada.
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao entrar com Google');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center">
            <img src={logoFluxoPro} alt="FluxoPro" className="h-48 object-contain" />
          </div>
          <p className="text-muted-foreground text-sm">
            {mode === 'signup' ? 'Crie sua conta para começar' : 
             mode === 'forgot' ? 'Recupere sua senha' : 'Entre na sua conta'}
          </p>
        </div>

        <div className="finance-card p-6 space-y-4">
          {mode === 'forgot' ? (
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <div>
                <Label>Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input type="email" placeholder="seu@email.com" value={email} onChange={e => setEmail(e.target.value)} className="pl-9" required />
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Enviando...' : 'Enviar link de recuperação'}
              </Button>
              <button onClick={() => setMode('login')} className="flex items-center justify-center w-full text-sm text-muted-foreground hover:text-primary transition-colors">
                <ArrowLeft className="h-4 w-4 mr-1" />
                Voltar para o login
              </button>
            </form>
          ) : (
            <>
              <Button variant="outline" className="w-full" onClick={handleGoogleLogin}>
                <Chrome className="h-4 w-4 mr-2" />
                Entrar com Google
              </Button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-border" /></div>
                <div className="relative flex justify-center text-xs uppercase"><span className="bg-card px-2 text-muted-foreground">ou</span></div>
              </div>

              <form onSubmit={handleEmailAuth} className="space-y-4">
                <div>
                  <Label>Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input type="email" placeholder="seu@email.com" value={email} onChange={e => setEmail(e.target.value)} className="pl-9" required />
                  </div>
                </div>
                <div>
                  <Label>Senha</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} className="pl-9" required minLength={6} />
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? 'Carregando...' : mode === 'signup' ? 'Criar Conta' : 'Entrar'}
                </Button>
              </form>

              <div className="flex flex-col items-center gap-2">
                <button onClick={() => setMode('forgot')} className="text-sm text-muted-foreground hover:text-primary transition-colors">
                  Esqueceu a senha?
                </button>
                <p className="text-center text-sm text-muted-foreground">
                  {mode === 'signup' ? 'Já tem uma conta?' : 'Não tem uma conta?'}{' '}
                  <button onClick={() => setMode(mode === 'signup' ? 'login' : 'signup')} className="text-primary hover:underline font-medium">
                    {mode === 'signup' ? 'Entrar' : 'Criar conta'}
                  </button>
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
