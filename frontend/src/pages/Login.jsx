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
    <div className="min-h-screen flex">
      <div 
        className="hidden lg:flex lg:w-1/2 bg-cover bg-center relative"
        style={{
          backgroundImage: `url('https://static.prod-images.emergentagent.com/jobs/c59dcd1b-f895-4ee2-8eb4-7df9ac4e70ca/images/0f6f370a46a6a6f1f937619c087f3096a72791ff1cb8c4725a6dbb42750d7c08.png')`
        }}
      >
        <div className="absolute inset-0 bg-zinc-950/40"></div>
        <div className="relative z-10 flex flex-col justify-end p-12">
          <h2 className="text-4xl font-bold text-white font-heading mb-2">Hotel Management System</h2>
          <p className="text-zinc-200 text-lg">Professionelle Verwaltung für Ihr Hotel</p>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <div className="mb-8">
            <h1 className="text-4xl font-bold tracking-tight text-zinc-950 font-heading mb-2">Anmelden</h1>
            <p className="text-zinc-600">Geben Sie Ihre Anmeldedaten ein</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6" data-testid="login-form">
            <div>
              <label className="text-xs font-semibold tracking-[0.1em] uppercase text-zinc-500 mb-2 block">
                E-Mail
              </label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ihre@email.com"
                required
                data-testid="email-input"
                className="h-11"
              />
            </div>

            <div>
              <label className="text-xs font-semibold tracking-[0.1em] uppercase text-zinc-500 mb-2 block">
                Passwort
              </label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                data-testid="password-input"
                className="h-11"
              />
            </div>

            <Button
              type="submit"
              disabled={loading}
              data-testid="login-submit-button"
              className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white font-medium"
            >
              {loading ? 'Anmelden...' : 'Anmelden'}
            </Button>
          </form>

          <div className="mt-8 p-4 bg-zinc-100 border border-zinc-200 rounded-lg">
            <p className="text-xs font-semibold tracking-[0.1em] uppercase text-zinc-500 mb-2">Test-Konten</p>
            <div className="space-y-1 text-sm text-zinc-600">
              <p><strong>Admin:</strong> admin@hotel.com / admin123</p>
              <p><strong>Rezeption:</strong> rezeption@hotel.com / rezeption123</p>
              <p><strong>Buchhaltung:</strong> buchhaltung@hotel.com / buchhaltung123</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}