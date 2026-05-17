import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { Check, Sparkle, CrownSimple, Rocket, Buildings } from '@phosphor-icons/react';
import { toast } from 'sonner';

const PLAN_ICONS = {
  starter: Rocket,
  pro: Sparkle,
  business: CrownSimple,
};

const PLAN_FEATURES = {
  starter: [
    'Bis zu 10 Unterkünfte',
    'Buchungsverwaltung',
    'Check-In mit ID-Scan',
    'Buchhaltung & PDF-Rechnungen',
    'Web-Push-Benachrichtigungen',
    'PWA für Mobil & Desktop',
  ],
  pro: [
    'Bis zu 20 Unterkünfte',
    'Alle Starter-Funktionen',
    'Kalender-Übersicht',
    'Online-Buchung für Gäste',
    'Service- & Wartungs-Tracking',
    'Priorisierter Support',
  ],
  business: [
    'Unbegrenzte Unterkünfte',
    'Alle Pro-Funktionen',
    'Mehrbenutzer (Admin / Rezeption / Buchhaltung)',
    'Export & API-Zugriff',
    '24/7 Premium Support',
    'Eigenes Branding',
  ],
};

export default function Pricing() {
  const [plans, setPlans] = useState([]);
  const [trialDays, setTrialDays] = useState(7);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    axios.get(`${process.env.REACT_APP_BACKEND_URL}/api/subscription/plans`)
      .then(({ data }) => {
        setPlans(data.plans);
        setTrialDays(data.trial_days);
      })
      .catch(() => toast.error('Fehler beim Laden der Tarife'));
  }, []);

  const handleStartTrial = () => {
    navigate('/signup');
  };

  const handleUpgrade = async (planId) => {
    setLoading(true);
    try {
      const { data } = await axios.post(
        `${process.env.REACT_APP_BACKEND_URL}/api/subscription/checkout`,
        { plan: planId, origin_url: window.location.origin },
        { withCredentials: true }
      );
      window.location.href = data.url;
    } catch (error) {
      if (error.response?.status === 401) {
        toast.error('Bitte zuerst anmelden');
        navigate('/login');
      } else {
        toast.error(error.response?.data?.detail || 'Fehler beim Checkout');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950" data-testid="pricing-page">
      <div className="border-b border-gold-500/30 bg-zinc-900/50 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate('/')}>
            <img
              src="https://customer-assets.emergentagent.com/wingman/359d1d25-501d-49ee-acdc-7ddd114c4b2b/attachments/abc94a5694cb4db0a3fad6a16ce20ec7_icon (1).png"
              alt="Logo"
              className="w-12 h-12 object-contain logo-no-bg"
            />
            <div>
              <h1 className="text-xl font-bold tracking-wider text-gold-400 font-heading">VILLEN MANAGER PRO</h1>
              <p className="text-xs text-gold-600 tracking-[0.2em]">EXKLUSIVE IMMOBILIENVERWALTUNG</p>
            </div>
          </div>
          <Button onClick={() => navigate('/login')} variant="outline" className="border-gold-500 text-gold-400 hover:bg-gold-500/10" data-testid="login-link">
            Anmelden
          </Button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center mb-16">
          <div className="inline-block px-4 py-1.5 bg-gold-500/10 border border-gold-500/30 rounded-full text-gold-400 text-xs tracking-[0.2em] uppercase mb-6">
            {trialDays} Tage gratis testen · Keine Kreditkarte
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold font-heading text-gold-400 mb-4">
            Wählen Sie Ihren Tarif
          </h1>
          <p className="text-base lg:text-lg text-gold-600 max-w-2xl mx-auto">
            Verwalten Sie Ihre Villen, Ferienhäuser & Apartments professionell — überall, jederzeit.
            Monatlich kündbar.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 mb-16">
          {plans.map((plan, idx) => {
            const Icon = PLAN_ICONS[plan.id] || Buildings;
            const isPro = plan.id === 'pro';
            return (
              <Card
                key={plan.id}
                data-testid={`plan-card-${plan.id}`}
                className={`relative p-6 lg:p-8 bg-zinc-900 transition-all hover:scale-[1.02] ${
                  isPro
                    ? 'border-2 border-gold-500 shadow-2xl shadow-gold-500/20'
                    : 'border border-gold-500/30 hover:border-gold-500/60'
                }`}
              >
                {isPro && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-gradient-to-r from-gold-500 to-gold-600 text-zinc-950 text-xs font-bold tracking-wider rounded-full">
                    BELIEBTESTE WAHL
                  </div>
                )}
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 rounded-lg bg-gold-500/10 flex items-center justify-center">
                    <Icon size={28} weight="fill" className="text-gold-500" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold font-heading text-gold-400">{plan.name}</h3>
                  </div>
                </div>

                <div className="mb-6">
                  <span className="text-5xl font-bold text-gold-400 font-heading">€{plan.price.toFixed(0)}</span>
                  <span className="text-gold-600 ml-2">/ Monat</span>
                  <p className="text-sm text-gold-600 mt-2">
                    {plan.property_limit === null
                      ? 'Unbegrenzte Unterkünfte'
                      : `Bis zu ${plan.property_limit} Unterkünfte`}
                  </p>
                </div>

                <div className="space-y-3 mb-8">
                  {PLAN_FEATURES[plan.id].map((feat, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <Check size={20} weight="bold" className="text-gold-500 mt-0.5 flex-shrink-0" />
                      <span className="text-sm text-gold-400">{feat}</span>
                    </div>
                  ))}
                </div>

                <Button
                  onClick={() => handleUpgrade(plan.id)}
                  disabled={loading}
                  data-testid={`subscribe-${plan.id}`}
                  className={`w-full font-semibold ${
                    isPro
                      ? 'bg-gradient-to-r from-gold-500 to-gold-600 hover:from-gold-400 hover:to-gold-500 text-zinc-950'
                      : 'bg-zinc-950 hover:bg-zinc-800 text-gold-400 border border-gold-500/40'
                  }`}
                >
                  {plan.name} abonnieren
                </Button>
              </Card>
            );
          })}
        </div>

        <div className="text-center bg-gradient-to-r from-zinc-900 via-zinc-900/80 to-zinc-900 border border-gold-500/30 rounded-2xl p-8 lg:p-12">
          <h2 className="text-2xl lg:text-3xl font-bold font-heading text-gold-400 mb-3">
            Nicht sicher welcher Tarif?
          </h2>
          <p className="text-gold-600 mb-6 max-w-xl mx-auto">
            Starten Sie mit {trialDays} Tagen kostenlosem Zugang — keine Kreditkarte erforderlich.
            Sie können jederzeit upgraden oder kündigen.
          </p>
          <Button
            onClick={handleStartTrial}
            data-testid="start-trial-cta"
            className="bg-gradient-to-r from-gold-500 to-gold-600 hover:from-gold-400 hover:to-gold-500 text-zinc-950 font-bold px-8 py-6 text-base"
          >
            {trialDays} Tage gratis starten
          </Button>
        </div>

        <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
          <div className="p-6">
            <div className="text-3xl font-bold text-gold-400 font-heading mb-2">SEPA</div>
            <p className="text-sm text-gold-600">Bankeinzug, Karte, Apple Pay, Google Pay</p>
          </div>
          <div className="p-6">
            <div className="text-3xl font-bold text-gold-400 font-heading mb-2">Monatlich</div>
            <p className="text-sm text-gold-600">Kündbar zum Ende jedes Monats</p>
          </div>
          <div className="p-6">
            <div className="text-3xl font-bold text-gold-400 font-heading mb-2">DSGVO</div>
            <p className="text-sm text-gold-600">Daten in der EU, gesetzeskonform</p>
          </div>
        </div>
      </div>
    </div>
  );
}
