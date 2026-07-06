import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Sparkles, CheckCircle2 } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';

export default function WelcomeSubscriptionPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    // Dispara a conversão do Google Ads
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', 'conversion', {
        'send_to': 'AW-18264257358/E3gsCPmt78McEM7miYVE',
        'value': 1.0,
        'currency': 'BRL',
        'transaction_id': '' // Pode usar transaction_id único se necessário no futuro
      });
      console.log('Google Ads Conversion Event fired');
    }
  }, []);

  return (
    <div className="max-w-2xl mx-auto py-12 px-4 text-center space-y-8 animate-in fade-in zoom-in duration-500">
      <div className="flex justify-center">
        <div className="h-24 w-24 rounded-full bg-success/20 flex items-center justify-center">
          <CheckCircle2 className="h-12 w-12 text-success" />
        </div>
      </div>
      
      <div className="space-y-4">
        <h1 className="text-4xl font-extrabold tracking-tight text-primary">Assinatura Confirmada!</h1>
        <p className="text-xl text-muted-foreground">
          Obrigado, {user?.user_metadata?.full_name || 'usuário'}! Seu pagamento foi processado com sucesso.
        </p>
      </div>

      <Card className="border-primary/20 bg-primary/5 shadow-lg max-w-lg mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center justify-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Bem-vindo ao E3 Flow Premium
          </CardTitle>
          <CardDescription>
            Sua conta agora tem acesso ilimitado a todos os recursos.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-3 text-sm font-medium text-left">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-success" />
              <span>Gestão financeira completa</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-success" />
              <span>Integração de Cobranças Pix automatizada</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-success" />
              <span>Relatórios detalhados</span>
            </div>
          </div>
          
          <Button 
            size="lg" 
            className="w-full font-bold text-md"
            onClick={() => navigate('/')}
          >
            Acessar Meu Painel
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
