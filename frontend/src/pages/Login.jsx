import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { toast } from 'sonner';

const formatApiErrorDetail = (detail) => {
  if (detail == null) return 'Etwas ist schief gelaufen. Bitte versuchen Sie es erneut.';
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail))
    return detail
      .map((e) => (e && typeof e.msg === 'string' ? e.msg : JSON.stringify(e)))
      .filter(Boolean)
      .join(' ');
  if (detail && typeof detail.msg === 'string') return detail.msg;
  return String(detail);
};

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      await login(email, password);
      toast.success('Erfolgreich angemeldet!');
      navigate('/dashboard');
    } catch (error) {
      const errorMsg = formatApiErrorDetail(error.response?.data?.detail) || error.message;
      toast.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-zinc-950">
      <div 
        className="hidden lg:flex lg:w-1/2 bg-cover bg-center relative"
        style={{
          backgroundImage: `linear-gradient(rgba(0,0,0,0.6), rgba(0,0,0,0.8)), url('https://images.unsplash.com/photo-1613977257363-707ba9348227?w=1200')`
        }}
      >
        <div className="absolute inset-0 flex flex-col items-center justify-center p-12">
          <img 
            src="https://customer-assets.emergentagent.com/wingman/359d1d25-501d-49ee-acdc-7ddd114c4b2b/attachments/abc94a5694cb4db0a3fad6a16ce20ec7_icon (1).png" 
            alt="Villen Manager Pro"
            className="w-48 h-48 object-contain mb-8"
          />
          <h2 className="text-5xl font-bold text-gold-500 font-heading mb-3 text-center">VILLEN MANAGER</h2>
          <p className="text-gold-600 text-xl tracking-[0.3em] uppercase">PRO</p>
          <p className="text-gold-400/80 text-lg mt-6 text-center max-w-md">
            Luxuriöses Immobilien-Management für Villen, Ferienhäuser, Appartments und Zimmer
          </p>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-8 bg-zinc-950">
        <div className="w-full max-w-md">
          <div className="flex justify-center lg:hidden mb-8">
            <img 
              src="https://customer-assets.emergentagent.com/wingman/359d1d25-501d-49ee-acdc-7ddd114c4b2b/attachments/abc94a5694cb4db0a3fad6a16ce20ec7_icon (1).png" 
              alt="Logo"
              className="w-24 h-24 object-contain"
            />
          </div>

          <div className="mb-8">
            <h1 className="text-4xl font-bold tracking-tight text-gold-500 font-heading mb-2">Anmelden</h1>
            <p className="text-gold-700">Geben Sie Ihre Anmeldedaten ein</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6" data-testid="login-form">
            <div>
              <label className="text-xs font-semibold tracking-[0.1em] uppercase text-gold-600 mb-2 block">
                E-Mail
              </label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ihre@email.com"
                required
                data-testid="email-input"
                className="h-11 bg-zinc-900 border-gold-900/30 text-gold-400 placeholder:text-gold-800 focus:border-gold-500"
              />
            </div>

            <div>
              <label className="text-xs font-semibold tracking-[0.1em] uppercase text-gold-600 mb-2 block">
                Passwort
              </label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                data-testid="password-input"
                className="h-11 bg-zinc-900 border-gold-900/30 text-gold-400 placeholder:text-gold-800 focus:border-gold-500"
              />
            </div>

            <Button
              type="submit"
              disabled={loading}
              data-testid="login-submit-button"
              className="w-full h-11 bg-gradient-to-r from-gold-500 to-gold-600 hover:from-gold-400 hover:to-gold-500 text-zinc-950 font-bold shadow-lg shadow-gold-500/20"
            >
              {loading ? 'Anmelden...' : 'Anmelden'}
            </Button>
          </form>

          <div className="mt-8 p-4 bg-zinc-900 border border-gold-900/30 rounded-lg">
            <p className="text-xs font-semibold tracking-[0.1em] uppercase text-gold-600 mb-2">Test-Konten</p>
            <div className="space-y-1 text-sm text-gold-400/80">
              <p><strong className="text-gold-500">Admin:</strong> admin@villenmanager.com / admin123</p>
              <p><strong className="text-gold-500">Rezeption:</strong> rezeption@villenmanager.com / rezeption123</p>
              <p><strong className="text-gold-500">Buchhaltung:</strong> buchhaltung@villenmanager.com / buchhaltung123</p>
            </div>
          </div>

          <div className="mt-8 text-center text-xs text-gold-700">
            <p>Kontakt: <a href="mailto:info@luxusvilla-ferien.de" className="hover:text-gold-500">info@luxusvilla-ferien.de</a></p>
            <p className="mt-1">WhatsApp: <a href="https://wa.me/4915227072018" className="hover:text-gold-500">+49 1522 7072 018</a></p>
          </div>
        </div>
      </div>
    </div>
  );
}
