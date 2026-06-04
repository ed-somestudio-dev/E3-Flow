// NOTA: chamadas diretas à API do Asaas pelo frontend estão DEPRECIADAS.
// Todas as operações devem passar pela Edge Function asaas-checkout.
// Este arquivo é mantido apenas para os tipos e utilitários (formatCurrency, mapAsaasStatus).
export const ASAAS_API_KEY = import.meta.env.VITE_ASAAS_API_KEY || '';
export const ASAAS_API_URL = import.meta.env.VITE_ASAAS_API_URL || 'https://api.asaas.com/v3';

export interface AsaasCustomer {
  id: string;
  name: string;
  email: string;
  cpfCnpj: string;
  phone?: string;
  mobilePhone?: string;
  postalCode?: string;
  address?: string;
  addressNumber?: string;
  complement?: string;
  province?: string;
  city?: string;
  state?: string;
}

export interface AsaasSubscription {
  id: string;
  customerId: string;
  planId: string;
  status: 'ACTIVE' | 'INACTIVE' | 'CANCELLED' | 'OVERDUE' | 'PENDING';
  billingCycle: 'MONTHLY' | 'YEARLY' | 'QUARTERLY';
  nextDueDate: string;
  value: number;
  startDate: string;
  endDate?: string;
  description?: string;
}

export interface AsaasPayment {
  id: string;
  customerId: string;
  subscriptionId?: string;
  status: 'PENDING' | 'CONFIRMED' | 'RECEIVED' | 'OVERDUE' | 'CANCELLED' | 'REFUNDED';
  dueDate: string;
  value: number;
  billingType: 'PIX' | 'CREDIT_CARD' | 'BOLETO';
  invoiceUrl?: string;
  pixQrCode?: string;
  pixQrCodeId?: string;
}

async function asaasRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  if (!ASAAS_API_KEY) {
    throw new Error('ASAAS_API_KEY não configurada');
  }

  const response = await fetch(ASAAS_API_URL + endpoint, {
    ...options,
    headers: Object.assign({
      'Content-Type': 'application/json',
      'access_token': ASAAS_API_KEY,
    }, options.headers),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[Asaas] Erro na API: ' + response.status, errorText);
    throw new Error('Erro Asaas (' + response.status + '): ' + errorText);
  }

  return response.json();
}

export async function createAsaasCustomer(data: {
  name: string;
  email: string;
  cpfCnpj: string;
  phone?: string;
  mobilePhone?: string;
}): Promise<AsaasCustomer> {
  console.log('[Asaas] Criando cliente:', data);
  return asaasRequest<AsaasCustomer>('/customers', Object.assign({ method: 'POST' }, { body: JSON.stringify(data) }));
}

export async function getAsaasCustomer(id: string): Promise<AsaasCustomer> {
  return asaasRequest<AsaasCustomer>('/customers/' + id);
}

export async function findAsaasCustomerByEmail(email: string): Promise<AsaasCustomer | null> {
  const result = await asaasRequest<{ results: AsaasCustomer[] }>('/customers?email=' + encodeURIComponent(email));
  return result.results?.[0] || null;
}

export async function createAsaasSubscription(data: {
  customerId: string;
  billingCycle: 'MONTHLY' | 'YEARLY' | 'QUARTERLY';
  value: number;
  nextDueDate: string;
  description?: string;
}): Promise<AsaasSubscription> {
  console.log('[Asaas] Criando assinatura:', data);
  return asaasRequest<AsaasSubscription>('/subscriptions', Object.assign({ method: 'POST' }, { body: JSON.stringify(data) }));
}

export async function getAsaasSubscription(id: string): Promise<AsaasSubscription> {
  return asaasRequest<AsaasSubscription>('/subscriptions/' + id);
}

export async function getPaymentBySubscription(subscriptionId: string): Promise<AsaasPayment | null> {
  const result = await asaasRequest<{ results: AsaasPayment[] }>('/payments?subscriptionId=' + subscriptionId + '&limit=1');
  return result.results?.[0] || null;
}

export async function cancelAsaasSubscription(id: string): Promise<AsaasSubscription> {
  return asaasRequest<AsaasSubscription>('/subscriptions/' + id + '?cancel=true', { method: 'DELETE' });
}

export function mapAsaasStatus(status: string): 'RECEIVED' | 'CONFIRMED' | 'INACTIVE' | 'OVERDUE' | 'CANCELLED' | 'PENDING' | 'TRIAL' {
  switch (status) {
    case 'ACTIVE': return 'RECEIVED';
    case 'RECEIVED': return 'RECEIVED';
    case 'CONFIRMED': return 'CONFIRMED';
    case 'INACTIVE': return 'INACTIVE';
    case 'OVERDUE': return 'OVERDUE';
    case 'CANCELLED': return 'CANCELLED';
    case 'PENDING': return 'PENDING';
    case 'TRIAL': return 'TRIAL';
    default: return 'INACTIVE';
  }
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

export function getAsaasCheckoutUrl(subscriptionId: string, isSandbox: boolean = false): string {
  return isSandbox
    ? `https://sandbox.asaas.com/checkout/${subscriptionId}`
    : `https://www.asaas.com/checkout/${subscriptionId}`;
}
