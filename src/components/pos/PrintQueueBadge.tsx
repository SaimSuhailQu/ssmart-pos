import React, { useCallback, useEffect, useState } from 'react';
import { Printer, RotateCcw } from 'lucide-react';
import { toast } from '../../state/toast';

interface QueueStatus {
  queued: number;
  failed: number;
  sending: number;
}

/**
 * Print-queue status badge for the POS header.
 *
 * Hidden when the queue is empty. Shows "Printer offline — N queued" while
 * jobs wait for retry, and a red "N failed" state the cashier can click to
 * retry immediately. Driven by the main-process spooler's
 * `print-queue-changed` events.
 */
export const PrintQueueBadge: React.FC = () => {
  const [status, setStatus] = useState<QueueStatus>({ queued: 0, failed: 0, sending: 0 });
  const [retrying, setRetrying] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const s = await window.api.getPrintQueueStatus();
      setStatus(s);
    } catch {
      /* spooler IPC unavailable in this build */
    }
  }, []);

  useEffect(() => {
    refresh();
    const unsub = window.api.onPrintQueueChanged?.((s) => {
      setStatus(s);
      if (s.failed > 0) {
        toast.warning(`Printer offline — ${s.failed + s.queued} receipt(s) queued. They will print automatically when the printer is back.`);
      }
    });
    return () => {
      unsub?.();
    };
  }, [refresh]);

  const retry = async () => {
    setRetrying(true);
    try {
      const n = await window.api.retryPrintQueue();
      toast.info(n > 0 ? `Retrying ${n} queued print job(s)…` : 'Print queue is clear.');
      await refresh();
    } catch {
      toast.error('Could not retry the print queue.');
    } finally {
      setRetrying(false);
    }
  };

  const pending = status.queued + status.sending;
  if (pending === 0 && status.failed === 0) return null;

  const failed = status.failed > 0;
  return (
    <button
      onClick={retry}
      title={failed ? 'Click to retry failed print jobs' : 'Print jobs pending'}
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold tracking-wider border uppercase cursor-pointer transition ${
        failed
          ? 'bg-status-coral/10 text-status-coral border-status-coral/30 hover:bg-status-coral/20'
          : 'bg-status-amber/10 text-status-amber border-status-amber/30 hover:bg-status-amber/20'
      }`}
    >
      {failed ? <RotateCcw size={11} className={retrying ? 'animate-spin' : ''} /> : <Printer size={11} />}
      {failed ? `${status.failed} failed` : `${pending} queued`}
    </button>
  );
};
