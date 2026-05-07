import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { lovable } from '@/integrations/lovable/index';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Mail, Lock, Chrome } from 'lucide-react';
import logoFluxoPro from '@/assets/Logo_FluxoPro.png';
import { toast } from 'sonner';

export default function AuthPage() {
  const [isSignUp, setIsSignUp] = useState(false);
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
      if (isSignUp) {
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
      toast.error(err.message || 'Erro na autenticação');
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
            {isSignUp ? 'Crie sua conta para começar' : 'Entre na sua conta'}
          </p>
        </div>

        <div className="finance-card p-6 space-y-4">
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
              {loading ? 'Carregando...' : isSignUp ? 'Criar Conta' : 'Entrar'}
            </Button>
          </form>

          <p className="text-center text-sm text-muted-foreground">
            {isSignUp ? 'Já tem uma conta?' : 'Não tem uma conta?'}{' '}
            <button onClick={() => setIsSignUp(!isSignUp)} className="text-primary hover:underline font-medium">
              {isSignUp ? 'Entrar' : 'Criar conta'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
