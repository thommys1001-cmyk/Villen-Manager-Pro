import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { CheckCircle, Warning, Spinner } from '@phosphor-icons/react';

const POLL_INTERVAL = 2000;
const MAX_ATTEMPTS = 10;

export default function SubscriptionSuccess() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const sessionId = searchParams.get('session_id');
  const [status, setStatus] = useState('checking'); // checking, paid, failed, expired, timeout
  const [plan, setPlan] = useState(null);
  const [attempts, setAttempts] = useState(0);

  useEffect(() => {
    if (!sessionId) {
      setStatus('failed');
      return;
    }

    let cancelled = false;
    let currentAttempts = 0;

    const poll = async () => {
      if (cancelled) return;
      if (currentAttempts >= MAX_ATTEMPTS) {
        setStatus('timeout');
        return;
      }
      currentAttempts += 1;
      setAttempts(currentAttempts);
      try {
        const { data } = await axios.get(
          `${process.env.REACT_APP_BACKEND_URL}/api/subscription/checkout/status/${sessionId}`,
          { withCredentials: true }
        );
        setPlan(data.plan);
        if (data.payment_status === 'paid') {
          setStatus('paid');
          return;
        }
        if (data.status === 'expired') {
          setStatus('expired');
          return;
        }
        setTimeout(poll, POLL_INTERVAL);
      } catch (e) {
        setStatus('failed');
      }
    };
    poll();
    return () => { cancelled = true; };
  }, [sessionId]);

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
      <Card className="max-w-md w-full p-8 bg-zinc-900 border-gold-500/30 text-center" data-testid="subscription-result">
        {status === 'checking' && (
          <>
            <Spinner size={64} className="text-gold-500 animate-spin mx-auto mb-4" />
            <h1 className="text-2xl font-bold font-heading text-gold-400 mb-2">Zahlung wird verifiziert…</h1>
            <p className="text-gold-600 text-sm">Versuch {attempts} / {MAX_ATTEMPTS}</p>
          </>
        )}
        {status === 'paid' && (
          <>
            <CheckCircle size={72} weight="fill" className="text-emerald-500 mx-auto mb-4" />
            <h1 className="text-3xl font-bold font-heading text-gold-400 mb-3">Willkommen!</h1>
            <p className="text-gold-500 mb-6">
              Ihr <strong className="text-gold-400">{plan}</strong>-Abo ist aktiv. Vielen Dank!
            </p>
            <Button onClick={() => navigate('/dashboard')} data-testid="goto-dashboard" className="w-full bg-gradient-to-r from-gold-500 to-gold-600 text-zinc-950 font-semibold">
              Zum Dashboard
            </Button>
          </>
        )}
        {status === 'expired' && (
          <>
            <Warning size={64} weight="fill" className="text-red-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold font-heading text-gold-400 mb-2">Sitzung abgelaufen</h1>
            <p className="text-gold-600 mb-6">Die Zahlungssitzung ist abgelaufen. Bitte erneut versuchen.</p>
            <Button onClick={() => navigate('/pricing')} className="w-full bg-gradient-to-r from-gold-500 to-gold-600 text-zinc-950 font-semibold">Zurück zur Preisliste</Button>
          </>
        )}
        {(status === 'timeout' || status === 'failed') && (
          <>
            <Warning size={64} weight="fill" className="text-amber-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold font-heading text-gold-400 mb-2">Status nicht ermittelbar</h1>
            <p className="text-gold-600 mb-6">Die Zahlung wird ggf. noch verarbeitet. Prüfen Sie in wenigen Minuten Ihren Abo-Status oder kontaktieren Sie uns.</p>
            <Button onClick={() => navigate('/subscription')} className="w-full bg-gradient-to-r from-gold-500 to-gold-600 text-zinc-950 font-semibold">Zur Abo-Übersicht</Button>
          </>
        )}
      </Card>
    </div>
  );
}
