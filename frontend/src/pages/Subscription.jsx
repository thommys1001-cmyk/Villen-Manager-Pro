import React, { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { Sidebar } from '../components/Sidebar';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Sparkle, CrownSimple, Rocket, Buildings, Warning } from '@phosphor-icons/react';
import { toast } from 'sonner';

const PLAN_ICONS = { starter: Rocket, pro: Sparkle, business: CrownSimple };

export default function Subscription() {
  const [sub, setSub] = useState(null);
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const navigate = useNavigate();

  const fetchData = useCallback(async () => {
    try {
      const [meRes, plansRes] = await Promise.all([
        axios.get(`${process.env.REACT_APP_BACKEND_URL}/api/subscription/me`, { withCredentials: true }),
        axios.get(`${process.env.REACT_APP_BACKEND_URL}/api/subscription/plans`),
      ]);
      setSub(meRes.data);
      setPlans(plansRes.data.plans);
    } catch (e) {
      toast.error('Fehler beim Laden');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleUpgrade = async (planId) => {
    setActionLoading(true);
    try {
      const { data } = await axios.post(
        `${process.env.REACT_APP_BACKEND_URL}/api/subscription/checkout`,
        { plan: planId, origin_url: window.location.origin },
        { withCredentials: true }
      );
      window.location.href = data.url;
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Fehler');
      setActionLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!window.confirm('Abo zum Laufzeit-Ende kündigen?')) return;
    try {
      await axios.post(`${process.env.REACT_APP_BACKEND_URL}/api/subscription/cancel`, {}, { withCredentials: true });
      toast.success('Abo gekündigt');
      fetchData();
    } catch {
      toast.error('Fehler beim Kündigen');
    }
  };

  if (loading) return (
    <div className="flex bg-zinc-950 min-h-screen">
      <Sidebar />
      <div className="flex-1 lg:ml-64 flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gold-500 border-r-transparent" />
      </div>
    </div>
  );

  const statusBadge = sub?.status === 'trial' ? (
    <Badge className="bg-blue-500/15 text-blue-400 border-blue-500/40">Test-Phase</Badge>
  ) : sub?.status === 'active' ? (
    <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/40">Aktiv</Badge>
  ) : (
    <Badge className="bg-red-500/15 text-red-400 border-red-500/40">Abgelaufen</Badge>
  );

  return (
    <div className="flex bg-zinc-950 min-h-screen" data-testid="subscription-page">
      <Sidebar />
      <div className="flex-1 lg:ml-64 pt-16 lg:pt-0">
        <div className="bg-zinc-900/80 backdrop-blur-xl border-b border-gold-500/30 sticky top-0 z-30">
          <div className="p-4 lg:p-6">
            <h1 className="text-2xl lg:text-4xl font-bold tracking-tight text-gold-400 font-heading">Mein Abo</h1>
            <p className="text-gold-600 mt-1 text-sm">Tarif, Zahlungen und Limits verwalten</p>
          </div>
        </div>

        <div className="p-4 lg:p-8 space-y-6">
          {/* Current status */}
          <Card className="p-6 lg:p-8 bg-zinc-900 border-gold-500/30" data-testid="current-plan-card">
            <div className="flex items-start justify-between flex-wrap gap-4 mb-6">
              <div>
                <p className="text-xs text-gold-600 uppercase tracking-widest mb-2">Aktueller Tarif</p>
                <div className="flex items-center gap-3 mb-2">
                  <h2 className="text-3xl lg:text-4xl font-bold text-gold-400 font-heading">{sub?.plan_name}</h2>
                  {statusBadge}
                </div>
                {sub?.status === 'trial' && (
                  <p className="text-sm text-blue-400" data-testid="trial-info">
                    Test-Phase: noch {sub.days_left} Tag(e) gratis
                  </p>
                )}
                {sub?.status === 'active' && (
                  <p className="text-sm text-emerald-400">
                    Verlängert bis {new Date(sub.subscription_end).toLocaleDateString('de-DE')} · noch {sub.days_left} Tag(e)
                  </p>
                )}
                {sub?.status === 'expired' && (
                  <p className="text-sm text-red-400 flex items-center gap-2">
                    <Warning size={16} weight="fill" /> Abo abgelaufen - bitte upgraden
                  </p>
                )}
              </div>
              <div className="text-right">
                <p className="text-xs text-gold-600 uppercase tracking-widest mb-1">Unterkünfte</p>
                <p className="text-2xl font-bold text-gold-400 font-heading">
                  {sub?.property_count} / {sub?.property_limit === null ? '∞' : sub?.property_limit}
                </p>
              </div>
            </div>

            {sub?.status === 'active' && (
              <Button onClick={handleCancel} variant="outline" data-testid="cancel-subscription" className="border-red-500/40 text-red-400 hover:bg-red-500/10">
                Abo kündigen
              </Button>
            )}
          </Card>

          {/* Upgrade plans */}
          <div>
            <h2 className="text-xl lg:text-2xl font-bold font-heading text-gold-400 mb-4">Tarif ändern</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-6">
              {plans.map(plan => {
                const Icon = PLAN_ICONS[plan.id] || Buildings;
                const isCurrent = sub?.plan === plan.id && sub?.status === 'active';
                return (
                  <Card key={plan.id} data-testid={`upgrade-card-${plan.id}`} className={`p-6 bg-zinc-900 ${isCurrent ? 'border-2 border-gold-500' : 'border border-gold-500/30'}`}>
                    <div className="flex items-center gap-3 mb-4">
                      <Icon size={28} weight="fill" className="text-gold-500" />
                      <h3 className="text-xl font-bold font-heading text-gold-400">{plan.name}</h3>
                    </div>
                    <p className="text-3xl font-bold text-gold-400 font-heading">€{plan.price.toFixed(0)}<span className="text-sm text-gold-600 font-normal">/Monat</span></p>
                    <p className="text-sm text-gold-600 mt-2 mb-4">
                      {plan.property_limit === null ? 'Unbegrenzt' : `${plan.property_limit} Unterkünfte`}
                    </p>
                    <Button
                      onClick={() => handleUpgrade(plan.id)}
                      disabled={isCurrent || actionLoading}
                      data-testid={`upgrade-to-${plan.id}`}
                      className={`w-full ${isCurrent ? 'bg-zinc-800 text-gold-600' : 'bg-gradient-to-r from-gold-500 to-gold-600 text-zinc-950 font-semibold'}`}
                    >
                      {isCurrent ? 'Aktueller Tarif' : 'Wählen'}
                    </Button>
                  </Card>
                );
              })}
            </div>
          </div>

          <div className="text-center text-xs text-gold-700 pt-4">
            Zahlung via Stripe · SEPA, Karte, Apple Pay, Google Pay · DSGVO-konform
          </div>
        </div>
      </div>
    </div>
  );
}
