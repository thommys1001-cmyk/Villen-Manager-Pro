import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Button } from './ui/button';
import { Bell, BellSlash } from '@phosphor-icons/react';
import { toast } from 'sonner';

// Convert URL-safe base64 to Uint8Array for applicationServerKey
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export const PushNotificationToggle = () => {
  const [permission, setPermission] = useState(Notification.permission);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isSupported, setIsSupported] = useState(false);

  useEffect(() => {
    const supported = 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window;
    setIsSupported(supported);

    if (supported) {
      checkSubscription();
    }
  }, []);

  const checkSubscription = async () => {
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      setIsSubscribed(!!subscription);
    } catch (error) {
      console.error('Error checking subscription:', error);
    }
  };

  const handleSubscribe = async () => {
    setLoading(true);
    try {
      // Request permission
      const result = await Notification.requestPermission();
      setPermission(result);

      if (result !== 'granted') {
        toast.error('Benachrichtigungen wurden abgelehnt');
        setLoading(false);
        return;
      }

      // Get VAPID public key from backend
      const { data: vapidData } = await axios.get(
        `${process.env.REACT_APP_BACKEND_URL}/api/push/vapid-public-key`,
        { withCredentials: true }
      );

      if (!vapidData.public_key) {
        toast.error('VAPID Schlüssel nicht konfiguriert');
        setLoading(false);
        return;
      }

      // Subscribe to push manager
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidData.public_key)
      });

      // Send subscription to backend
      const subscriptionJson = subscription.toJSON();
      await axios.post(
        `${process.env.REACT_APP_BACKEND_URL}/api/push/subscribe`,
        {
          endpoint: subscriptionJson.endpoint,
          keys: subscriptionJson.keys
        },
        { withCredentials: true }
      );

      setIsSubscribed(true);
      toast.success('Push-Benachrichtigungen aktiviert!');
    } catch (error) {
      console.error('Subscription error:', error);
      toast.error('Fehler beim Aktivieren: ' + (error.message || 'Unbekannt'));
    } finally {
      setLoading(false);
    }
  };

  const handleUnsubscribe = async () => {
    setLoading(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      
      if (subscription) {
        await axios.post(
          `${process.env.REACT_APP_BACKEND_URL}/api/push/unsubscribe`,
          { endpoint: subscription.endpoint },
          { withCredentials: true }
        );
        await subscription.unsubscribe();
      }
      
      setIsSubscribed(false);
      toast.success('Push-Benachrichtigungen deaktiviert');
    } catch (error) {
      toast.error('Fehler beim Deaktivieren');
    } finally {
      setLoading(false);
    }
  };

  const handleTest = async () => {
    try {
      const { data } = await axios.post(
        `${process.env.REACT_APP_BACKEND_URL}/api/push/test`,
        {},
        { withCredentials: true }
      );
      
      if (data.success && data.sent_count > 0) {
        toast.success(data.message);
      } else {
        toast.error(data.message || 'Keine Benachrichtigung gesendet');
      }
    } catch (error) {
      toast.error('Test fehlgeschlagen');
    }
  };

  if (!isSupported) {
    return (
      <div className="text-sm text-gold-600">
        Push-Benachrichtigungen werden von Ihrem Browser nicht unterstützt.
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-3 items-center" data-testid="push-notification-toggle">
      {!isSubscribed ? (
        <Button
          onClick={handleSubscribe}
          disabled={loading || permission === 'denied'}
          data-testid="push-subscribe-button"
          className="bg-gradient-to-r from-gold-500 to-gold-600 hover:from-gold-400 hover:to-gold-500 text-gold-400 font-semibold"
        >
          <Bell size={20} weight="fill" className="mr-2" />
          {loading ? 'Aktiviere...' : 'Push-Benachrichtigungen aktivieren'}
        </Button>
      ) : (
        <>
          <Button
            onClick={handleUnsubscribe}
            disabled={loading}
            variant="outline"
            data-testid="push-unsubscribe-button"
            className="border-gold-500 text-gold-400 hover:bg-gold-500 hover:text-gold-400"
          >
            <BellSlash size={20} className="mr-2" />
            {loading ? 'Deaktiviere...' : 'Deaktivieren'}
          </Button>
          <Button
            onClick={handleTest}
            data-testid="push-test-button"
            className="bg-zinc-900 hover:bg-zinc-800 text-gold-400 border border-gold-500/50"
          >
            <Bell size={20} className="mr-2" />
            Test-Benachrichtigung
          </Button>
        </>
      )}
      
      {permission === 'denied' && (
        <p className="text-sm text-red-400">
          Benachrichtigungen wurden in Ihrem Browser blockiert. Bitte aktivieren Sie sie in den Browser-Einstellungen.
        </p>
      )}
    </div>
  );
};
