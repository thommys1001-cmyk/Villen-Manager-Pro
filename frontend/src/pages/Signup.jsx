import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card } from '../components/ui/card';
import { Sparkle } from '@phosphor-icons/react';
import { toast } from 'sonner';

export default function Signup() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    company_name: '',
    name: '',
    email: '',
    password: '',
    confirm: '',
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (formData.password.length < 6) {
      toast.error('Passwort muss mindestens 6 Zeichen lang sein');
      return;
    }
    if (formData.password !== formData.confirm) {
      toast.error('Passwörter stimmen nicht überein');
      return;
    }
    setLoading(true);
    try {
      await axios.post(
        `${process.env.REACT_APP_BACKEND_URL}/api/auth/signup`,
        {
          email: formData.email,
          password: formData.password,
          name: formData.name,
          company_name: formData.company_name,
        },
        { withCredentials: true }
      );
      toast.success('Konto erstellt! 7 Tage gratis aktiviert.');
      navigate('/dashboard');
      // Reload so AuthContext refreshes
      setTimeout(() => window.location.reload(), 100);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Registrierung fehlgeschlagen');
    } finally {
      setLoading(false);
    }
  };

  const update = (k, v) => setFormData(p => ({ ...p, [k]: v }));

  return (
    <div className="min-h-screen flex bg-zinc-950" data-testid="signup-page">
      <div
        className="hidden lg:flex lg:w-1/2 bg-cover bg-center relative"
        style={{
          backgroundImage: `linear-gradient(rgba(10,10,10,0.75), rgba(10,10,10,0.9)), url('https://customer-assets.emergentagent.com/wingman/359d1d25-501d-49ee-acdc-7ddd114c4b2b/attachments/8dba1e69afd1420499fa76f1c7e5ee55_pical-resort-infinity-pool-by-sea-airview.jpg')`,
        }}
      >
        <div className="absolute inset-0 flex flex-col items-center justify-center p-12 text-center">
          <Sparkle size={56} weight="fill" className="text-gold-500 mb-6" />
          <h2 className="text-5xl font-bold text-gold-500 font-heading mb-3">7 Tage gratis</h2>
          <p className="text-gold-600 text-xl tracking-[0.25em] uppercase mb-6">Keine Kreditkarte</p>
          <p className="text-gold-400/90 text-lg max-w-md">
            Erstellen Sie Ihr eigenes Konto und verwalten Sie Ihre Villen, Ferienhäuser & Apartments
            – komplett DSGVO-konform, in der EU gehostet.
          </p>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-6 lg:p-8">
        <Card className="w-full max-w-md p-6 lg:p-8 bg-zinc-900 border-gold-500/30">
          <h1 className="text-3xl lg:text-4xl font-bold text-gold-400 font-heading mb-2">Konto erstellen</h1>
          <p className="text-gold-600 mb-6 text-sm">7 Tage gratis testen – ohne Kreditkarte.</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-semibold uppercase text-gold-600 mb-2 block">Firmenname *</label>
              <Input
                value={formData.company_name}
                onChange={(e) => update('company_name', e.target.value)}
                required
                placeholder="z.B. Villa Mali Svor"
                data-testid="company-name-input"
                className="bg-zinc-950 border-gold-500/30 text-gold-400"
              />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase text-gold-600 mb-2 block">Ihr Name *</label>
              <Input
                value={formData.name}
                onChange={(e) => update('name', e.target.value)}
                required
                placeholder="Max Mustermann"
                data-testid="name-input"
                className="bg-zinc-950 border-gold-500/30 text-gold-400"
              />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase text-gold-600 mb-2 block">E-Mail *</label>
              <Input
                type="email"
                value={formData.email}
                onChange={(e) => update('email', e.target.value)}
                required
                placeholder="ihre@email.de"
                data-testid="email-input"
                className="bg-zinc-950 border-gold-500/30 text-gold-400"
              />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase text-gold-600 mb-2 block">Passwort *</label>
              <Input
                type="password"
                value={formData.password}
                onChange={(e) => update('password', e.target.value)}
                required
                minLength={6}
                placeholder="Mind. 6 Zeichen"
                data-testid="password-input"
                className="bg-zinc-950 border-gold-500/30 text-gold-400"
              />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase text-gold-600 mb-2 block">Passwort bestätigen *</label>
              <Input
                type="password"
                value={formData.confirm}
                onChange={(e) => update('confirm', e.target.value)}
                required
                placeholder="Passwort wiederholen"
                data-testid="confirm-input"
                className="bg-zinc-950 border-gold-500/30 text-gold-400"
              />
            </div>

            <Button
              type="submit"
              disabled={loading}
              data-testid="signup-submit"
              className="w-full bg-gradient-to-r from-gold-500 to-gold-600 hover:from-gold-400 hover:to-gold-500 text-zinc-950 font-bold py-6"
            >
              {loading ? 'Konto wird erstellt…' : '7 Tage gratis starten'}
            </Button>
            <p className="text-xs text-gold-700 text-center">
              Bereits ein Konto? <Link to="/login" className="text-gold-500 hover:underline">Anmelden</Link>
            </p>
          </form>
        </Card>
      </div>
    </div>
  );
}
