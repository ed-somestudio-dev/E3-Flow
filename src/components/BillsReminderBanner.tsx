import { useMemo, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Bell, X, AlertTriangle } from 'lucide-react';
import { useFinance } from '@/lib/finance-context';
import { usePixSettings } from '@/lib/pix-settings-context';
import { Button } from '@/components/ui/button';
import { format, differenceInCalendarDays } from 'date-fns';

/**
 * Banner in-app que avisa sobre contas a pagar/receber próximas do vencimento
 * ou já vencidas. Usa as preferências de lembrete em user_settings.
 * Pode ser dispensado por sessão (sessionStorage).
 */
export function BillsReminderBanner() {
  const { data } = useFinance();
  const { settings, loaded } = usePixSettings();
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem('reminder-dismissed') === '1') setDismissed(true);
  }, []);

  const summary = useMemo(() => {
    if (!loaded || !settings.remindersEnabled) return null;
    const today = format(new Date(), 'yyyy-MM-dd');
    const lead = settings.reminderDaysBefore ?? 3;

    const activePayables = (data.payables || []).filter(p => p.status !== 'paid');
    const activeReceivables = (data.receivables || []).filter(r => r.status !== 'received');

    const overduePay = activePayables.filter(p => p.dueDate < today);
    const overdueRec = activeReceivables.filter(r => r.dueDate < today);

    const upcomingPay = activePayables.filter(p => {
      if (p.dueDate < today) return false;
      const d = differenceInCalendarDays(new Date(p.dueDate + 'T12:00:00'), new Date());
      return d >= 0 && d <= lead;
    });
    const upcomingRec = activeReceivables.filter(r => {
      if (r.dueDate < today) return false;
      const d = differenceInCalendarDays(new Date(r.dueDate + 'T12:00:00'), new Date());
      return d >= 0 && d <= lead;
    });

    const overdueCount = overduePay.length + overdueRec.length;
    const upcomingCount = upcomingPay.length + upcomingRec.length;

    if (overdueCount === 0 && upcomingCount === 0) return null;

    return { overdueCount, upcomingCount, overduePayCount: overduePay.length, overdueRecCount: overdueRec.length, upcomingPayCount: upcomingPay.length, upcomingRecCount: upcomingRec.length, lead };
  }, [data.payables, data.receivables, settings, loaded]);

  if (!summary || dismissed) return null;

  const isUrgent = summary.overdueCount > 0;

  return (
    <div
      className={`mx-4 mt-3 rounded-lg border px-3 py-2 flex items-start gap-2 text-sm ${
        isUrgent
          ? 'bg-destructive/10 border-destructive/30 text-destructive'
          : 'bg-warning/10 border-warning/30 text-warning'
      }`}
      role="alert"
    >
      {isUrgent ? <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" /> : <Bell className="h-4 w-4 shrink-0 mt-0.5" />}
      <div className="flex-1 min-w-0 space-y-1">
        {summary.overdueCount > 0 && (
          <div>
            <strong>{summary.overdueCount}</strong> conta{summary.overdueCount !== 1 ? 's' : ''} vencida{summary.overdueCount !== 1 ? 's' : ''}
            {summary.overduePayCount > 0 && (
              <> · <Link to="/payables" className="underline font-medium">{summary.overduePayCount} a pagar</Link></>
            )}
            {summary.overdueRecCount > 0 && (
              <> · <Link to="/receivables" className="underline font-medium">{summary.overdueRecCount} a receber</Link></>
            )}
          </div>
        )}
        {summary.upcomingCount > 0 && (
          <div>
            <strong>{summary.upcomingCount}</strong> vence{summary.upcomingCount !== 1 ? 'm' : ''} em até {summary.lead} dia{summary.lead !== 1 ? 's' : ''}
            {summary.upcomingPayCount > 0 && (
              <> · <Link to="/payables" className="underline font-medium">{summary.upcomingPayCount} a pagar</Link></>
            )}
            {summary.upcomingRecCount > 0 && (
              <> · <Link to="/receivables" className="underline font-medium">{summary.upcomingRecCount} a receber</Link></>
            )}
          </div>
        )}
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 shrink-0 -mt-0.5"
        onClick={() => { sessionStorage.setItem('reminder-dismissed', '1'); setDismissed(true); }}
        aria-label="Dispensar"
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}