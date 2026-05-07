## Objetivo
Unificar no Painel o card "Alertas de Atraso" e o "Banner de Lembretes" (vencidas + próximas) em um único card, controlado pela mesma preferência de Lembretes em Configurações, mantendo links diretos para Contas a Pagar e a Receber.

## Mudanças

### 1. Novo card unificado no Painel (`src/pages/DashboardPage.tsx`)
- Substituir o bloco "Alertas de Atraso" existente por um único card "Alertas e Lembretes" que mostra duas seções:
  - **Vencidas** (estilo destrutivo) — pagar e receber em atraso, com link para `/payables` e `/receivables`.
  - **Vencendo em até N dias** (estilo de aviso) — usa `reminderDaysBefore` de `user_settings`, mesmos links.
- Cada item lista descrição, valor, data e tag (Vencida/Vence em X dias). Limite visual com scroll quando passar de ~6 itens.
- Renderizar somente se `settings.remindersEnabled` for `true` e existir pelo menos uma conta vencida ou próxima.
- Reaproveitar a lógica de cálculo já presente no `BillsReminderBanner` (datas, `differenceInCalendarDays`, filtros de status).

### 2. Remover o banner global duplicado
- Remover o uso de `<BillsReminderBanner />` do layout (`src/components/AppLayout.tsx`) para não duplicar a informação. O componente em si pode ser mantido no repositório, mas não será mais montado.

### 3. Configuração (sem mudanças de schema)
- Continuar usando os campos já existentes em `user_settings`:
  - `reminders_enabled` (liga/desliga a janela)
  - `reminder_days_before` (janela de antecedência)
- A página de Configurações já expõe esses controles — apenas atualizar o texto auxiliar para deixar claro que o ajuste afeta a janela do Painel.

## Detalhes técnicos
- Usar `usePixSettings()` no `DashboardPage` para ler `settings.remindersEnabled` e `settings.reminderDaysBefore`.
- Manter `consolidatePayables` para evitar duplicar parcelas de fatura.
- Cores via tokens semânticos (`destructive`, `warning`, `success`) — sem cores hardcoded.
- Acessibilidade: `role="region"` com `aria-label="Alertas e lembretes"`, links com texto descritivo.

## Fora do escopo
- Não alterar schema do banco.
- Não mexer nos cards "Contas a Pagar/Receber Pendentes" (eles continuam separados, listando todas as pendentes — diferente do bloco de alertas que foca em vencidas + próximas).