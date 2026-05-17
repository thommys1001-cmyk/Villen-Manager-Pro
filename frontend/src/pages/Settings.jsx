import React, { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { Sidebar } from '../components/Sidebar';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card } from '../components/ui/card';
import { Buildings, FloppyDisk, Image as ImageIcon } from '@phosphor-icons/react';
import { toast } from 'sonner';

export default function Settings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [account, setAccount] = useState(null);
  const [form, setForm] = useState({
    company_name: '',
    company_email: '',
    phone: '',
    website: '',
    address: '',
    city: '',
    postal_code: '',
    country: 'Deutschland',
    tax_id: '',
    vat_id: '',
    iban: '',
    bic: '',
    bank_name: '',
    logo_url: '',
  });

  const fetchAccount = useCallback(async () => {
    try {
      const { data } = await axios.get(
        `${process.env.REACT_APP_BACKEND_URL}/api/account/me`,
        { withCredentials: true }
      );
      setAccount(data);
      setForm({
        company_name: data.company_name || '',
        company_email: data.settings?.company_email || '',
        phone: data.settings?.phone || '',
        website: data.settings?.website || '',
        address: data.settings?.address || '',
        city: data.settings?.city || '',
        postal_code: data.settings?.postal_code || '',
        country: data.settings?.country || 'Deutschland',
        tax_id: data.settings?.tax_id || '',
        vat_id: data.settings?.vat_id || '',
        iban: data.settings?.iban || '',
        bic: data.settings?.bic || '',
        bank_name: data.settings?.bank_name || '',
        logo_url: data.settings?.logo_url || '',
      });
    } catch {
      toast.error('Fehler beim Laden');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAccount(); }, [fetchAccount]);

  const update = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { data } = await axios.patch(
        `${process.env.REACT_APP_BACKEND_URL}/api/account/settings`,
        form,
        { withCredentials: true }
      );
      setAccount(data);
      toast.success('Einstellungen gespeichert');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Fehler beim Speichern');
    } finally {
      setSaving(false);
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

  const Section = ({ title, children }) => (
    <Card className="p-5 lg:p-6 bg-zinc-900 border-gold-500/30 space-y-4">
      <h2 className="text-lg lg:text-xl font-bold text-gold-400 font-heading">{title}</h2>
      {children}
    </Card>
  );

  const Field = ({ label, k, type = 'text', placeholder, full = false }) => (
    <div className={full ? 'md:col-span-2' : ''}>
      <label className="text-xs font-semibold uppercase text-gold-600 mb-2 block">{label}</label>
      <Input
        type={type}
        value={form[k]}
        onChange={(e) => update(k, e.target.value)}
        placeholder={placeholder}
        data-testid={`settings-${k}`}
        className="bg-zinc-950 border-gold-500/30 text-gold-400"
      />
    </div>
  );

  return (
    <div className="flex bg-zinc-950 min-h-screen" data-testid="settings-page">
      <Sidebar />
      <div className="flex-1 lg:ml-64 pt-16 lg:pt-0">
        <div className="bg-zinc-900/80 backdrop-blur-xl border-b border-gold-500/30 sticky top-0 z-30">
          <div className="p-4 lg:p-6 flex items-center justify-between">
            <div>
              <h1 className="text-2xl lg:text-4xl font-bold tracking-tight text-gold-400 font-heading">Einstellungen</h1>
              <p className="text-gold-600 text-sm mt-1">Ihre Firmen-, Rechnungs- und Bankdaten</p>
            </div>
            <Button
              type="submit"
              form="settings-form"
              disabled={saving}
              data-testid="save-settings-button"
              className="bg-gradient-to-r from-gold-500 to-gold-600 hover:from-gold-400 hover:to-gold-500 text-zinc-950 font-semibold"
            >
              <FloppyDisk size={18} weight="bold" className="mr-2" />
              {saving ? 'Speichern…' : 'Speichern'}
            </Button>
          </div>
        </div>

        <form id="settings-form" onSubmit={handleSubmit} className="p-4 lg:p-8 space-y-6">
          <Section title="Firmendaten">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Firmenname *" k="company_name" placeholder="z.B. Villa Mali Svor" full />
              <Field label="Kontakt-E-Mail" k="company_email" type="email" placeholder="info@beispiel.de" />
              <Field label="Telefon" k="phone" placeholder="+49 ..." />
              <Field label="Webseite" k="website" placeholder="www.beispiel.de" full />
            </div>
          </Section>

          <Section title="Adresse">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Straße & Hausnummer" k="address" placeholder="Hauptstraße 1" full />
              <Field label="Postleitzahl" k="postal_code" placeholder="10115" />
              <Field label="Stadt" k="city" placeholder="Berlin" />
              <Field label="Land" k="country" placeholder="Deutschland" full />
            </div>
          </Section>

          <Section title="Rechnungs- & Steuerdaten">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Steuernummer" k="tax_id" placeholder="12/345/67890" />
              <Field label="USt-IdNr." k="vat_id" placeholder="DE123456789" />
            </div>
            <p className="text-xs text-gold-700 pt-2">Diese Daten erscheinen auf jeder generierten Rechnung.</p>
          </Section>

          <Section title="Bankverbindung">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Bank" k="bank_name" placeholder="Sparkasse Berlin" full />
              <Field label="IBAN" k="iban" placeholder="DE89 3704 0044 0532 0130 00" full />
              <Field label="BIC" k="bic" placeholder="COBADEFFXXX" />
            </div>
          </Section>

          <Section title="Branding">
            <Field label="Logo-URL (öffentlich erreichbar)" k="logo_url" placeholder="https://..." full />
            {form.logo_url && (
              <div className="mt-3 p-3 bg-zinc-950 rounded-lg border border-gold-500/20 flex items-center gap-3">
                <ImageIcon size={20} weight="fill" className="text-gold-500" />
                <img src={form.logo_url} alt="Logo Preview" className="h-12 object-contain" />
              </div>
            )}
            <p className="text-xs text-gold-700 pt-2">
              <Buildings size={14} className="inline mr-1" />
              Wird in Rechnungen und im Online-Buchungsformular angezeigt. Logo-Upload folgt – bis dahin
              bitte einen direkten Bild-Link verwenden.
            </p>
          </Section>

          <div className="flex justify-end pt-4">
            <Button
              type="submit"
              disabled={saving}
              data-testid="save-settings-button-bottom"
              className="bg-gradient-to-r from-gold-500 to-gold-600 hover:from-gold-400 hover:to-gold-500 text-zinc-950 font-semibold px-8"
            >
              <FloppyDisk size={18} weight="bold" className="mr-2" />
              {saving ? 'Speichern…' : 'Alle Änderungen speichern'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
