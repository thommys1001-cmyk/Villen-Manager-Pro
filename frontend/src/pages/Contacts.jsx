import React, { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { Sidebar } from '../components/Sidebar';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import {
  Plus, MagnifyingGlass, EnvelopeSimple, Phone, Printer,
  WhatsappLogo, Trash, Pencil, IdentificationCard, X
} from '@phosphor-icons/react';
import { toast } from 'sonner';

export default function Contacts() {
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    name: '', email: '', phone: '', address: '', city: '', postal_code: '',
    country: '', nationality: '', id_number: '', date_of_birth: '', notes: '',
  });

  const fetchContacts = useCallback(async () => {
    try {
      const { data } = await axios.get(
        `${process.env.REACT_APP_BACKEND_URL}/api/contacts`,
        { withCredentials: true }
      );
      setContacts(data);
    } catch {
      toast.error('Fehler beim Laden');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchContacts(); }, [fetchContacts]);

  const resetForm = () => setForm({
    name: '', email: '', phone: '', address: '', city: '', postal_code: '',
    country: '', nationality: '', id_number: '', date_of_birth: '', notes: '',
  });

  const openCreate = () => { resetForm(); setEditing(false); setShowCreate(true); };

  const openEdit = (c) => {
    setForm({
      name: c.name || '',
      email: c.email || '',
      phone: c.phone || '',
      address: c.address || '',
      city: c.city || '',
      postal_code: c.postal_code || '',
      country: c.country || '',
      nationality: c.nationality || '',
      id_number: c.id_number || '',
      date_of_birth: c.date_of_birth || '',
      notes: c.notes || '',
    });
    setSelected(c);
    setEditing(true);
    setShowCreate(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = Object.fromEntries(Object.entries(form).map(([k, v]) => [k, v || null]));
      payload.name = form.name; // required
      if (editing && selected) {
        await axios.patch(
          `${process.env.REACT_APP_BACKEND_URL}/api/contacts/${selected._id}`,
          payload,
          { withCredentials: true }
        );
        toast.success('Kontakt aktualisiert');
      } else {
        await axios.post(
          `${process.env.REACT_APP_BACKEND_URL}/api/contacts`,
          payload,
          { withCredentials: true }
        );
        toast.success('Kontakt erstellt');
      }
      setShowCreate(false);
      fetchContacts();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Fehler beim Speichern');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Kontakt wirklich löschen?')) return;
    try {
      await axios.delete(`${process.env.REACT_APP_BACKEND_URL}/api/contacts/${id}`, { withCredentials: true });
      toast.success('Kontakt gelöscht');
      setSelected(null);
      fetchContacts();
    } catch {
      toast.error('Fehler beim Löschen');
    }
  };

  const filtered = contacts.filter(c => {
    const q = search.toLowerCase();
    return !q || c.name?.toLowerCase().includes(q) || c.email?.toLowerCase().includes(q) || c.phone?.includes(q);
  });

  // Format for share/print
  const formatContactText = (c) => [
    c.name,
    c.email && `E-Mail: ${c.email}`,
    c.phone && `Tel: ${c.phone}`,
    c.address && `${c.address}`,
    (c.postal_code || c.city) && `${c.postal_code || ''} ${c.city || ''}`.trim(),
    c.country,
    c.nationality && `Nationalität: ${c.nationality}`,
    c.id_number && `Ausweis-Nr.: ${c.id_number}`,
    c.date_of_birth && `Geburtsdatum: ${c.date_of_birth}`,
  ].filter(Boolean).join('\n');

  const handlePrint = () => {
    if (!selected) return;
    const w = window.open('', '_blank');
    if (!w) return;
    const html = `
      <html><head><title>${selected.name}</title>
      <style>
        body{font-family:Georgia,serif;padding:40px;max-width:600px;color:#1a1a1a;}
        h1{color:#D4AF37;border-bottom:2px solid #D4AF37;padding-bottom:8px;}
        .field{margin:8px 0;font-size:14px;}
        .label{font-weight:bold;color:#666;display:inline-block;min-width:120px;}
        img{max-width:300px;border:1px solid #ccc;border-radius:4px;margin-top:12px;}
      </style></head><body>
      <h1>${selected.name}</h1>
      ${selected.email ? `<div class="field"><span class="label">E-Mail:</span> ${selected.email}</div>` : ''}
      ${selected.phone ? `<div class="field"><span class="label">Telefon:</span> ${selected.phone}</div>` : ''}
      ${selected.address ? `<div class="field"><span class="label">Adresse:</span> ${selected.address}</div>` : ''}
      ${(selected.postal_code || selected.city) ? `<div class="field"><span class="label">Ort:</span> ${selected.postal_code || ''} ${selected.city || ''}</div>` : ''}
      ${selected.country ? `<div class="field"><span class="label">Land:</span> ${selected.country}</div>` : ''}
      ${selected.nationality ? `<div class="field"><span class="label">Nationalität:</span> ${selected.nationality}</div>` : ''}
      ${selected.id_number ? `<div class="field"><span class="label">Ausweis-Nr.:</span> ${selected.id_number}</div>` : ''}
      ${selected.date_of_birth ? `<div class="field"><span class="label">Geburtsdatum:</span> ${selected.date_of_birth}</div>` : ''}
      ${selected.notes ? `<div class="field"><span class="label">Notizen:</span> ${selected.notes}</div>` : ''}
      ${selected.id_document_url ? `<h3>Ausweis-Scan</h3><img src="${selected.id_document_url}" alt="Ausweis" />` : ''}
      </body></html>`;
    w.document.write(html);
    w.document.close();
    setTimeout(() => w.print(), 250);
  };

  const handleEmail = () => {
    if (!selected) return;
    const subject = encodeURIComponent(`Kontaktdaten: ${selected.name}`);
    const body = encodeURIComponent(formatContactText(selected));
    const to = selected.email || '';
    window.location.href = `mailto:${to}?subject=${subject}&body=${body}`;
  };

  const handleWhatsApp = () => {
    if (!selected) return;
    const text = encodeURIComponent(formatContactText(selected));
    const phone = (selected.phone || '').replace(/[^0-9]/g, '');
    window.open(`https://wa.me/${phone}?text=${text}`, '_blank');
  };

  return (
    <div className="flex bg-zinc-950 min-h-screen" data-testid="contacts-page">
      <Sidebar />
      <div className="flex-1 lg:ml-64 pt-16 lg:pt-0">
        <div className="bg-zinc-900/80 backdrop-blur-xl border-b border-gold-500/30 sticky top-0 z-30">
          <div className="p-4 lg:p-6 flex items-center justify-between flex-wrap gap-3">
            <div>
              <h1 className="text-2xl lg:text-4xl font-bold tracking-tight text-gold-400 font-heading">Kontakte</h1>
              <p className="text-gold-600 text-sm mt-1">Gäste & Kunden mit Ausweis-Archiv</p>
            </div>
            <Dialog open={showCreate} onOpenChange={setShowCreate}>
              <DialogTrigger asChild>
                <Button onClick={openCreate} data-testid="add-contact-button" className="bg-gradient-to-r from-gold-500 to-gold-600 text-zinc-950 font-semibold">
                  <Plus size={18} weight="bold" className="mr-2" />
                  Neuer Kontakt
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>{editing ? 'Kontakt bearbeiten' : 'Neuer Kontakt'}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-3">
                  <Input placeholder="Name *" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-testid="contact-name" />
                  <Input type="email" placeholder="E-Mail" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                  <Input placeholder="Telefon" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                  <Input placeholder="Adresse" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
                  <div className="grid grid-cols-2 gap-2">
                    <Input placeholder="PLZ" value={form.postal_code} onChange={(e) => setForm({ ...form, postal_code: e.target.value })} />
                    <Input placeholder="Stadt" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
                  </div>
                  <Input placeholder="Land" value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} />
                  <Input placeholder="Nationalität" value={form.nationality} onChange={(e) => setForm({ ...form, nationality: e.target.value })} />
                  <Input placeholder="Ausweis-Nr." value={form.id_number} onChange={(e) => setForm({ ...form, id_number: e.target.value })} />
                  <Input placeholder="Geburtsdatum (YYYY-MM-DD)" value={form.date_of_birth} onChange={(e) => setForm({ ...form, date_of_birth: e.target.value })} />
                  <Input placeholder="Notizen" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
                  <Button type="submit" data-testid="save-contact-button" className="w-full bg-gradient-to-r from-gold-500 to-gold-600 text-zinc-950 font-semibold">
                    {editing ? 'Speichern' : 'Erstellen'}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <div className="p-4 lg:p-8">
          <div className="mb-4 relative max-w-md">
            <MagnifyingGlass size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gold-600" />
            <Input
              placeholder="Suche nach Name, Email, Telefon…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              data-testid="contact-search"
              className="pl-10 bg-zinc-900 border-gold-500/30 text-gold-400"
            />
          </div>

          <Card className="bg-zinc-900 border-gold-500/30 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-zinc-950 border-b border-gold-500/30 hover:bg-zinc-950">
                  <TableHead className="font-semibold text-gold-400">Name</TableHead>
                  <TableHead className="font-semibold text-gold-400">E-Mail</TableHead>
                  <TableHead className="font-semibold text-gold-400">Telefon</TableHead>
                  <TableHead className="font-semibold text-gold-400">Ausweis</TableHead>
                  <TableHead className="font-semibold text-gold-400 text-right">Aktion</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-8">
                    <div className="inline-block h-6 w-6 animate-spin rounded-full border-4 border-gold-500 border-r-transparent" />
                  </TableCell></TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-8 text-gold-600">
                    Noch keine Kontakte. Buchungen erzeugen automatisch Einträge.
                  </TableCell></TableRow>
                ) : filtered.map(c => (
                  <TableRow key={c._id} data-testid={`contact-row-${c._id}`} className="cursor-pointer hover:bg-zinc-950/50" onClick={() => setSelected(c)}>
                    <TableCell className="font-semibold text-gold-300">{c.name}</TableCell>
                    <TableCell className="text-gold-500">{c.email || '—'}</TableCell>
                    <TableCell className="text-gold-500">{c.phone || '—'}</TableCell>
                    <TableCell>
                      {c.id_document_url ? (
                        <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/40">
                          <IdentificationCard size={12} weight="fill" className="mr-1" /> gespeichert
                        </Badge>
                      ) : <span className="text-gold-700 text-xs">—</span>}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); openEdit(c); }} className="text-gold-500 hover:bg-gold-500/10">
                        <Pencil size={16} />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </div>

        {/* Detail dialog */}
        <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-3">
                {selected?.name}
                {selected?.id_document_url && (
                  <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/40 text-xs">
                    <IdentificationCard size={12} weight="fill" className="mr-1" /> Ausweis im Profil
                  </Badge>
                )}
              </DialogTitle>
            </DialogHeader>
            {selected && (
              <div className="space-y-4" data-testid="contact-detail">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  {selected.email && <div><span className="text-gold-600 uppercase text-xs">E-Mail</span><br /><span className="text-gold-300">{selected.email}</span></div>}
                  {selected.phone && <div><span className="text-gold-600 uppercase text-xs">Telefon</span><br /><span className="text-gold-300">{selected.phone}</span></div>}
                  {selected.address && <div className="col-span-2"><span className="text-gold-600 uppercase text-xs">Adresse</span><br /><span className="text-gold-300">{selected.address}{(selected.postal_code || selected.city) ? `, ${selected.postal_code || ''} ${selected.city || ''}` : ''}{selected.country ? `, ${selected.country}` : ''}</span></div>}
                  {selected.nationality && <div><span className="text-gold-600 uppercase text-xs">Nationalität</span><br /><span className="text-gold-300">{selected.nationality}</span></div>}
                  {selected.id_number && <div><span className="text-gold-600 uppercase text-xs">Ausweis-Nr.</span><br /><span className="text-gold-300">{selected.id_number}</span></div>}
                  {selected.date_of_birth && <div><span className="text-gold-600 uppercase text-xs">Geburtsdatum</span><br /><span className="text-gold-300">{selected.date_of_birth}</span></div>}
                  {selected.bookings?.length > 0 && <div><span className="text-gold-600 uppercase text-xs">Buchungen</span><br /><span className="text-gold-300">{selected.bookings.length}</span></div>}
                </div>

                {selected.id_document_url && (
                  <div className="border border-gold-500/30 rounded-lg p-3 bg-zinc-950">
                    <p className="text-xs text-gold-600 uppercase tracking-wider mb-2">Ausweis-Scan</p>
                    <img src={selected.id_document_url} alt="Ausweis" className="max-w-full rounded" />
                  </div>
                )}

                <div className="flex flex-wrap gap-2 pt-2 border-t border-gold-500/20">
                  <Button onClick={handlePrint} data-testid="contact-print" size="sm" className="bg-zinc-950 hover:bg-zinc-900 text-gold-400 border border-gold-500/40">
                    <Printer size={16} className="mr-1" /> Drucken
                  </Button>
                  <Button onClick={handleEmail} data-testid="contact-email" size="sm" className="bg-zinc-950 hover:bg-zinc-900 text-gold-400 border border-gold-500/40">
                    <EnvelopeSimple size={16} className="mr-1" /> E-Mail
                  </Button>
                  <Button onClick={handleWhatsApp} data-testid="contact-whatsapp" size="sm" disabled={!selected.phone} className="bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/40 disabled:opacity-40">
                    <WhatsappLogo size={16} className="mr-1" /> WhatsApp
                  </Button>
                  <Button onClick={() => openEdit(selected)} size="sm" className="bg-zinc-950 hover:bg-zinc-900 text-gold-400 border border-gold-500/40">
                    <Pencil size={16} className="mr-1" /> Bearbeiten
                  </Button>
                  <Button onClick={() => handleDelete(selected._id)} size="sm" data-testid="contact-delete" className="bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-500/40">
                    <Trash size={16} className="mr-1" /> Löschen
                  </Button>
                </div>

                {selected.notes && (
                  <div className="pt-2 border-t border-gold-500/20">
                    <p className="text-xs text-gold-600 uppercase tracking-wider mb-1">Notizen</p>
                    <p className="text-sm text-gold-400">{selected.notes}</p>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
