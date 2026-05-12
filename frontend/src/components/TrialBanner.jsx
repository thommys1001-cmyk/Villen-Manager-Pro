import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { Sparkle, X } from '@phosphor-icons/react';

export const TrialBanner = () => {
  const [sub, setSub] = useState(null);
  const [dismissed, setDismissed] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    axios.get(`${process.env.REACT_APP_BACKEND_URL}/api/subscription/me`, { withCredentials: true })
      .then(({ data }) => setSub(data))
      .catch(() => {});
  }, []);

  if (!sub || dismissed) return null;
  // Only show during trial or expired
  if (sub.status === 'active') return null;

  const isTrial = sub.status === 'trial';
  const isExpired = sub.status === 'expired';

  return (
    <div
      data-testid="trial-banner"
      className={`w-full px-4 py-3 flex items-center justify-between gap-3 ${
        isExpired
          ? 'bg-red-900/40 border-b border-red-500/40'
          : 'bg-gradient-to-r from-gold-500/20 to-gold-600/20 border-b border-gold-500/40'
      }`}
    >
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <Sparkle size={20} weight="fill" className={isExpired ? 'text-red-400' : 'text-gold-500'} />
        <div className="text-sm min-w-0">
          {isTrial && (
            <span className="text-gold-300">
              <strong className="text-gold-400">Test-Phase aktiv:</strong> noch <strong>{sub.days_left} Tag(e)</strong> kostenlos.
              Wählen Sie jetzt einen Tarif, um nahtlos weiterzumachen.
            </span>
          )}
          {isExpired && (
            <span className="text-red-300">
              <strong className="text-red-400">Test-Phase abgelaufen.</strong> Bitte wählen Sie einen Tarif, um den vollen Funktionsumfang freizuschalten.
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          onClick={() => navigate('/subscription')}
          data-testid="trial-upgrade-button"
          className={`px-3 py-1.5 rounded-md text-xs font-semibold ${
            isExpired
              ? 'bg-red-500 hover:bg-red-400 text-white'
              : 'bg-gold-500 hover:bg-gold-400 text-zinc-950'
          }`}
        >
          Jetzt upgraden
        </button>
        {!isExpired && (
          <button onClick={() => setDismissed(true)} className="text-gold-500 hover:text-gold-300 p-1" data-testid="trial-banner-close">
            <X size={16} weight="bold" />
          </button>
        )}
      </div>
    </div>
  );
};
