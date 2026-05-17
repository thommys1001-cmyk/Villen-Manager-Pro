import React, { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { Sidebar } from '../components/Sidebar';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { Plus, Pencil, Trash, FilePdf } from '@phosphor-icons/react';
import { toast } from 'sonner';

export default function Bookings() {
  const [bookings, setBookings] = useState([]);
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editingBooking, setEditingBooking] = useState(null);
  const [formData, setFormData] = useState({
    guest_name: '',
    email: '',
    phone: '',
    room_number: '',
    room_type: 'Villa',
    check_in_date: '',
    check_out_date: '',
    price: '',
    deposit: '',
    price_note: '',
    deposit_note: '',
    guests_count: 1,
  });

  const fetchBookings = useCallback(async () => {
    try {
      const { data } = await axios.get(
        `${process.env.REACT_APP_BACKEND_URL}/api/bookings`,
        { withCredentials: true }
      );
      setBookings(data);
    } catch (error) {
      toast.error('Fehler beim Laden der Buchungen');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchProperties = useCallback(async () => {
    try {
      const { data } = await axios.get(
        `${process.env.REACT_APP_BACKEND_URL}/api/properties`,
        { withCredentials: true }
      );
      setProperties(data);
    } catch (error) {
      // silent fail - properties might be empty
    }
  }, []);

  useEffect(() => {
    fetchBookings();
    fetchProperties();
  }, [fetchBookings, fetchProperties]);

  const handlePropertySelect = (propertyName) => {
    const prop = properties.find(p => p.name === propertyName);
    setFormData(prev => ({
      ...prev,
      room_number: propertyName,
      room_type: prop?.category || prev.room_type,
      price: prop?.default_price ? prop.default_price : prev.price,
      deposit: prop?.default_deposit ? prop.default_deposit : prev.deposit,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...formData,
        email: formData.email || null,
        price: formData.price === '' ? null : parseFloat(formData.price),
        deposit: formData.deposit === '' ? null : parseFloat(formData.deposit),
        price_note: formData.price_note || null,
        deposit_note: formData.deposit_note || null,
      };
      if (editingBooking) {
        await axios.patch(
          `${process.env.REACT_APP_BACKEND_URL}/api/bookings/${editingBooking._id}`,
          payload,
          { withCredentials: true }
        );
        toast.success('Buchung aktualisiert');
      } else {
        await axios.post(
          `${process.env.REACT_APP_BACKEND_URL}/api/bookings`,
          payload,
          { withCredentials: true }
        );
        toast.success('Buchung erstellt');
      }
      setShowDialog(false);
      resetForm();
      fetchBookings();
    } catch (error) {
      toast.error('Fehler beim Speichern');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Möchten Sie diese Buchung wirklich löschen?')) return;
    
    try {
      await axios.delete(
        `${process.env.REACT_APP_BACKEND_URL}/api/bookings/${id}`,
        { withCredentials: true }
      );
      toast.success('Buchung gelöscht');
      fetchBookings();
    } catch (error) {
      toast.error('Fehler beim Löschen');
    }
  };

  const handleDownloadInvoice = async (bookingId, roomNumber) => {
    try {
      const response = await axios.get(
        `${process.env.REACT_APP_BACKEND_URL}/api/bookings/${bookingId}/invoice`,
        { 
          withCredentials: true,
          responseType: 'blob'
        }
      );
      
      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `rechnung_${roomNumber}_${bookingId}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      
      toast.success('Rechnung heruntergeladen');
    } catch (error) {
      toast.error('Fehler beim Download');
    }
  };

  const resetForm = () => {
    setFormData({
      guest_name: '',
      email: '',
      phone: '',
      room_number: '',
      room_type: 'Villa',
      check_in_date: '',
      check_out_date: '',
      price: '',
      deposit: '',
      price_note: '',
      deposit_note: '',
      guests_count: 1,
    });
    setEditingBooking(null);
  };

  const openEditDialog = (booking) => {
    setEditingBooking(booking);
    setFormData({
      guest_name: booking.guest_name,
      email: booking.email,
      phone: booking.phone,
      room_number: booking.room_number,
      room_type: booking.room_type,
      check_in_date: booking.check_in_date,
      check_out_date: booking.check_out_date,
      price: booking.price ?? '',
      deposit: booking.deposit ?? '',
      price_note: booking.price_note || '',
      deposit_note: booking.deposit_note || '',
      guests_count: booking.guests_count,
    });
    setShowDialog(true);
  };

  const getStatusBadge = (status) => {
    const variants = {
      pending: 'text-gold-700 bg-gold-50 border-gold-200',
      checked_in: 'text-emerald-700 bg-emerald-50 border-emerald-200',
      checked_out: 'text-gold-500 bg-zinc-950 border-gold-500/30',
    };
    const labels = {
      pending: 'Ausstehend',
      checked_in: 'Eingecheckt',
      checked_out: 'Ausgecheckt',
    };
    return (
      <Badge className={variants[status] || variants.pending}>
        {labels[status] || status}
      </Badge>
    );
  };

  return (
    <div className="flex" data-testid="bookings-page">
      <Sidebar />
      <div className="flex-1 lg:ml-64 pt-16 lg:pt-0">
        <div className="bg-zinc-900/80 backdrop-blur-xl border-b border-gold-500/30 sticky top-0 z-40">
          <div className="p-6 flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold tracking-tight text-gold-400 font-heading">Buchungen</h1>
              <p className="text-gold-600 mt-1">Verwalten Sie alle Buchungen</p>
            </div>
            <Dialog open={showDialog} onOpenChange={(open) => {
              setShowDialog(open);
              if (!open) resetForm();
            }}>
              <DialogTrigger asChild>
                <Button data-testid="add-booking-button" className="bg-blue-600 hover:bg-blue-700 text-white">
                  <Plus size={20} weight="bold" className="mr-2" />
                  Neue Buchung
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle className="text-2xl font-heading">
                    {editingBooking ? 'Buchung bearbeiten' : 'Neue Buchung erstellen'}
                  </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-semibold tracking-[0.1em] uppercase text-gold-500 mb-2 block">
                        Gastname
                      </label>
                      <Input
                        value={formData.guest_name}
                        onChange={(e) => setFormData({ ...formData, guest_name: e.target.value })}
                        required
                        data-testid="guest-name-input"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold tracking-[0.1em] uppercase text-gold-500 mb-2 block">
                        E-Mail <span className="text-gold-700 normal-case">(optional)</span>
                      </label>
                      <Input
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        data-testid="guest-email-input"
                        placeholder="gast@beispiel.de"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold tracking-[0.1em] uppercase text-gold-500 mb-2 block">
                        Telefon
                      </label>
                      <Input
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        required
                        data-testid="guest-phone-input"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold tracking-[0.1em] uppercase text-gold-500 mb-2 block">
                        Unterkunft
                      </label>
                      {properties.length > 0 ? (
                        <Select
                          value={formData.room_number}
                          onValueChange={handlePropertySelect}
                        >
                          <SelectTrigger data-testid="accommodation-select">
                            <SelectValue placeholder="Unterkunft wählen" />
                          </SelectTrigger>
                          <SelectContent>
                            {properties.map(prop => (
                              <SelectItem key={prop._id} value={prop.name}>
                                {prop.name} ({prop.category})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Input
                          value={formData.room_number}
                          onChange={(e) => setFormData({ ...formData, room_number: e.target.value })}
                          required
                          data-testid="room-number-input"
                          placeholder="Erst unter Immobilien anlegen"
                        />
                      )}
                    </div>
                    <div>
                      <label className="text-xs font-semibold tracking-[0.1em] uppercase text-gold-500 mb-2 block">
                        Kategorie
                      </label>
                      <Select
                        value={formData.room_type}
                        onValueChange={(value) => setFormData({ ...formData, room_type: value })}
                      >
                        <SelectTrigger data-testid="category-select">
                          <SelectValue placeholder="Kategorie wählen" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Villa">Villen</SelectItem>
                          <SelectItem value="Ferienhaus">Ferienhäuser</SelectItem>
                          <SelectItem value="Appartment">Appartment</SelectItem>
                          <SelectItem value="Zimmer">Zimmer</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-xs font-semibold tracking-[0.1em] uppercase text-gold-500 mb-2 block">
                        Anzahl Gäste
                      </label>
                      <Input
                        type="number"
                        min="1"
                        value={formData.guests_count}
                        onChange={(e) => setFormData({ ...formData, guests_count: parseInt(e.target.value) })}
                        required
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold tracking-[0.1em] uppercase text-gold-500 mb-2 block">
                        Check-In
                      </label>
                      <Input
                        type="date"
                        value={formData.check_in_date}
                        onChange={(e) => setFormData({ ...formData, check_in_date: e.target.value })}
                        required
                        data-testid="check-in-date-input"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold tracking-[0.1em] uppercase text-gold-500 mb-2 block">
                        Check-Out
                      </label>
                      <Input
                        type="date"
                        value={formData.check_out_date}
                        onChange={(e) => setFormData({ ...formData, check_out_date: e.target.value })}
                        required
                        data-testid="check-out-date-input"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold tracking-[0.1em] uppercase text-gold-500 mb-2 block">
                        Preis pro Nacht (€) <span className="text-gold-700 normal-case">(optional)</span>
                      </label>
                      <Input
                        type="number"
                        step="0.01"
                        value={formData.price}
                        onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                        data-testid="price-input"
                        placeholder="z.B. 250.00 (leer lassen für Freitext)"
                      />
                      <Input
                        value={formData.price_note}
                        onChange={(e) => setFormData({ ...formData, price_note: e.target.value })}
                        data-testid="price-note-input"
                        placeholder="oder Freitext (z.B. 'auf Anfrage')"
                        className="mt-2 text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold tracking-[0.1em] uppercase text-gold-500 mb-2 block">
                        Kaution (€) <span className="text-gold-700 normal-case">(optional)</span>
                      </label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={formData.deposit}
                        onChange={(e) => setFormData({ ...formData, deposit: e.target.value })}
                        data-testid="deposit-input"
                        placeholder="z.B. 500.00"
                      />
                      <Input
                        value={formData.deposit_note}
                        onChange={(e) => setFormData({ ...formData, deposit_note: e.target.value })}
                        data-testid="deposit-note-input"
                        placeholder="oder Freitext"
                        className="mt-2 text-sm"
                      />
                    </div>
                  </div>
                  <div className="flex gap-3 pt-4">
                    <Button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white" data-testid="save-booking-button">
                      {editingBooking ? 'Aktualisieren' : 'Erstellen'}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setShowDialog(false);
                        resetForm();
                      }}
                    >
                      Abbrechen
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <div className="p-8">
          <div className="bg-zinc-900 border border-gold-500/30 rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-zinc-950 border-b border-gold-500/30">
                  <TableHead className="font-semibold text-gold-400">Gastname</TableHead>
                  <TableHead className="font-semibold text-gold-400">Unterkunft</TableHead>
                  <TableHead className="font-semibold text-gold-400">Kategorie</TableHead>
                  <TableHead className="font-semibold text-gold-400">Check-In</TableHead>
                  <TableHead className="font-semibold text-gold-400">Check-Out</TableHead>
                  <TableHead className="font-semibold text-gold-400">Preis</TableHead>
                  <TableHead className="font-semibold text-gold-400">Kaution</TableHead>
                  <TableHead className="font-semibold text-gold-400">Status</TableHead>
                  <TableHead className="font-semibold text-gold-400">Aktionen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8">
                      <div className="inline-block h-6 w-6 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
                    </TableCell>
                  </TableRow>
                ) : bookings.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-gold-600">
                      Keine Buchungen gefunden
                    </TableCell>
                  </TableRow>
                ) : (
                  bookings.map((booking) => (
                    <TableRow key={booking._id} data-testid={`booking-row-${booking._id}`}>
                      <TableCell className="font-medium">{booking.guest_name}</TableCell>
                      <TableCell>{booking.room_number}</TableCell>
                      <TableCell>{booking.room_type}</TableCell>
                      <TableCell>{booking.check_in_date}</TableCell>
                      <TableCell>{booking.check_out_date}</TableCell>
                      <TableCell>{typeof booking.price === 'number' ? `€${booking.price.toFixed(2)}` : (booking.price_note || '—')}</TableCell>
                      <TableCell>{typeof booking.deposit === 'number' && booking.deposit > 0 ? `€${booking.deposit.toFixed(2)}` : (booking.deposit_note || '—')}</TableCell>
                      <TableCell>{getStatusBadge(booking.status)}</TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDownloadInvoice(booking._id, booking.room_number)}
                            data-testid={`download-invoice-${booking._id}`}
                            className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                          >
                            <FilePdf size={16} />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openEditDialog(booking)}
                            data-testid={`edit-booking-${booking._id}`}
                          >
                            <Pencil size={16} />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDelete(booking._id)}
                            data-testid={`delete-booking-${booking._id}`}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash size={16} />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    </div>
  );
}