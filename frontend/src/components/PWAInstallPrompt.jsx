import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { DeviceMobile, X, Download } from '@phosphor-icons/react';

export const PWAInstallPrompt = () => {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSInstructions, setShowIOSInstructions] = useState(false);

  useEffect(() => {
    // Detect iOS
    const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    setIsIOS(iOS);

    // Check if already installed
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || 
                        window.navigator.standalone === true;
    
    if (isStandalone) {
      return;
    }

    // Check if dismissed recently
    const lastDismissed = localStorage.getItem('pwa-install-dismissed');
    if (lastDismissed && Date.now() - parseInt(lastDismissed) < 7 * 24 * 60 * 60 * 1000) {
      return;
    }

    // iOS: Show install instructions after 3s
    if (iOS) {
      setTimeout(() => setShowPrompt(true), 3000);
      return;
    }

    // Android/Chrome: Listen for beforeinstallprompt
    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowPrompt(true);
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (isIOS) {
      setShowIOSInstructions(true);
      return;
    }

    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      console.log('PWA installed');
    }
    
    setDeferredPrompt(null);
    setShowPrompt(false);
  };

  const handleDismiss = () => {
    localStorage.setItem('pwa-install-dismissed', Date.now().toString());
    setShowPrompt(false);
    setShowIOSInstructions(false);
  };

  if (!showPrompt) return null;

  if (showIOSInstructions) {
    return (
      <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:max-w-sm z-50 bg-zinc-900 border border-gold-500 rounded-lg shadow-xl shadow-gold-500/20 p-5" data-testid="pwa-ios-instructions">
        <button
          onClick={handleDismiss}
          className="absolute top-3 right-3 text-gold-400 hover:text-gold-300"
          data-testid="pwa-close-button"
        >
          <X size={20} weight="bold" />
        </button>
        <div className="flex items-start gap-3 mb-3">
          <DeviceMobile size={32} weight="fill" className="text-gold-500 flex-shrink-0" />
          <div>
            <h3 className="text-gold-500 font-bold text-lg font-heading">App installieren</h3>
            <p className="text-gold-400 text-sm">Auf dem Home-Bildschirm hinzufügen</p>
          </div>
        </div>
        <ol className="text-gold-400 text-sm space-y-2 list-decimal list-inside">
          <li>Tippen Sie auf das <strong className="text-gold-500">Teilen-Symbol</strong> unten in Safari</li>
          <li>Wählen Sie <strong className="text-gold-500">"Zum Home-Bildschirm"</strong></li>
          <li>Tippen Sie auf <strong className="text-gold-500">"Hinzufügen"</strong></li>
        </ol>
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:max-w-sm z-50 bg-zinc-900 border border-gold-500 rounded-lg shadow-xl shadow-gold-500/20 p-5" data-testid="pwa-install-prompt">
      <button
        onClick={handleDismiss}
        className="absolute top-3 right-3 text-gold-400 hover:text-gold-300"
        data-testid="pwa-close-button"
      >
        <X size={20} weight="bold" />
      </button>
      <div className="flex items-start gap-3 mb-4">
        <DeviceMobile size={32} weight="fill" className="text-gold-500 flex-shrink-0" />
        <div>
          <h3 className="text-gold-500 font-bold text-lg font-heading">App installieren</h3>
          <p className="text-gold-400 text-sm mt-1">
            Villen Manager Pro als App auf Ihrem Gerät installieren für schnellen Zugriff.
          </p>
        </div>
      </div>
      <div className="flex gap-2">
        <Button
          onClick={handleInstall}
          data-testid="pwa-install-button"
          className="flex-1 bg-gradient-to-r from-gold-500 to-gold-600 hover:from-gold-400 hover:to-gold-500 text-zinc-950 font-bold"
        >
          <Download size={18} weight="bold" className="mr-2" />
          Installieren
        </Button>
        <Button
          onClick={handleDismiss}
          variant="outline"
          className="border-gold-500 text-gold-400 hover:bg-gold-500 hover:text-zinc-950"
        >
          Später
        </Button>
      </div>
    </div>
  );
};
