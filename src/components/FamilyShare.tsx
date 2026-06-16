import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Trash2, MailPlus } from 'lucide-react';
import { toast } from 'sonner';

export function FamilyShare() {
  const { user, tenantUserId } = useAuth();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [member, setMember] = useState<{ id: string, email: string } | null>(null);
  const [ownerEmail, setOwnerEmail] = useState<string | null>(null);

  const isOwner = user?.id === tenantUserId;

  useEffect(() => {
    if (!user) return;

    const fetchMember = async () => {
      if (isOwner) {
        // Sou o dono, buscar quem eu convidei
        const { data } = await supabase
          .from('family_members')
          .select('*')
          .eq('owner_id', user.id)
          .maybeSingle();
        
        if (data) {
          setMember({ id: data.id, email: data.member_email });
        } else {
          setMember(null);
        }
      } else {
        // Sou o membro, buscar o email do dono
        const { data } = await supabase
          .from('family_members')
          .select('owner_id')
          .eq('member_email', user.email)
          .maybeSingle();
          
        if (data && data.owner_id) {
          // Precisamos do email do dono usando a tabela auth.users indiretamente se não tiver permissão
          // Como o RLS está bloqueado para auth.users, vamos apenas mostrar o ID ou uma mensagem genérica
          setOwnerEmail("Dono da Conta Primária");
        }
      }
    };

    fetchMember();
  }, [user, isOwner]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    if (email === user?.email) {
      toast.error('Você não pode convidar a si mesmo.');
      return;
    }
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('family_members')
        .insert({ owner_id: user!.id, member_email: email.trim() })
        .select()
        .single();
        
      if (error) {
        if (error.code === '23505') {
          toast.error('Este e-mail já foi convidado para outra conta.');
        } else {
          throw error;
        }
      } else if (data) {
        setMember({ id: data.id, email: data.member_email });
        toast.success('Parceiro convidado com sucesso!');
        setEmail('');
      }
    } catch (err: any) {
      toast.error(err.message || 'Erro ao convidar parceiro');
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async () => {
    if (!member) return;
    setLoading(true);
    try {
      const { error } = await supabase
        .from('family_members')
        .delete()
        .eq('id', member.id);
        
      if (error) throw error;
      setMember(null);
      toast.success('Parceiro removido.');
    } catch (err: any) {
      toast.error(err.message || 'Erro ao remover parceiro');
    } finally {
      setLoading(false);
    }
  };

  if (!isOwner) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Conta Compartilhada
          </CardTitle>
          <CardDescription>
            Você está acessando a conta de <strong>{ownerEmail}</strong>.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          Compartilhamento de Conta
        </CardTitle>
        <CardDescription>
          Convide um sócio ou cônjuge para acessar seus dados. Limite de 1 convite por assinatura.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {member ? (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3 border rounded-lg bg-muted/20 gap-3">
            <div>
              <p className="text-sm font-medium">Parceiro atual</p>
              <p className="text-sm text-muted-foreground">{member.email}</p>
            </div>
            <Button variant="destructive" size="sm" onClick={handleRemove} disabled={loading} className="w-full sm:w-auto">
              <Trash2 className="h-4 w-4 mr-2" />
              Remover
            </Button>
          </div>
        ) : (
          <form onSubmit={handleInvite} className="flex flex-col sm:flex-row gap-2">
            <Input 
              type="email" 
              placeholder="e-mail do parceiro" 
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              className="w-full sm:max-w-xs"
            />
            <Button type="submit" disabled={loading} className="w-full sm:w-auto">
              <MailPlus className="h-4 w-4 mr-2" />
              Convidar
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
