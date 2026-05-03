import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card } from '../components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { CheckCircle, Bed, Wifi, Snowflake, Television } from '@phosphor-icons/react';
import { toast } from 'sonner';

export default function PublicBooking() {
  const [roomTypes, setRoomTypes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [bookingSuccess, setBookingSuccess] = useState(false);
  const [bookingDetails, setBookingDetails] = useState(null);
  const [formData, setFormData] = useState({
    guest_name: '',
    email: '',
    phone: '',
    room_type: '',
    check_in_date: new Date().toISOString().split('T')[0],
    check_out_date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    guests_count: 1,
    special_requests: ''
  });

  useEffect(() => {
    fetchRoomTypes();
  }, []);

  const fetchRoomTypes = async () => {
    try {
      const { data } = await axios.get(
        `${process.env.REACT_APP_BACKEND_URL}/api/public/room-types`
      );
      setRoomTypes(data);
    } catch (error) {
      toast.error('Fehler beim Laden der Zimmertypen');
    }
  };

  const calculateTotal = () => {
    if (!formData.room_type || !formData.check_in_date || !formData.check_out_date) return 0;
    const roomType = roomTypes.find(rt => rt.type === formData.room_type);
    if (!roomType) return 0;
    
    const checkIn = new Date(formData.check_in_date);
    const checkOut = new Date(formData.check_out_date);
    const nights = Math.max(0, Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24)));
    
    return roomType.price_per_night * nights;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data } = await axios.post(
        `${process.env.REACT_APP_BACKEND_URL}/api/public/bookings`,
        formData
      );
      setBookingDetails(data);
      setBookingSuccess(true);
      toast.success('Buchung erfolgreich!');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Fehler bei der Buchung');
    } finally {
      setLoading(false);
    }
  };

  if (bookingSuccess) {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-4">
        <Card className="max-w-2xl w-full p-8 text-center">
          <div className="mb-6 flex justify-center">
            <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center">
              <CheckCircle size={48} weight="fill" className="text-emerald-600" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-zinc-950 font-heading mb-4">Buchung erfolgreich!</h1>
          <p className="text-zinc-600 mb-6">
            Vielen Dank für Ihre Buchung. Eine Bestätigungs-E-Mail wurde an <strong>{formData.email}</strong> gesendet.
          </p>
          <div className="bg-zinc-50 border border-zinc-200 rounded-lg p-6 mb-6 text-left">
            <h3 className="font-semibold text-zinc-900 mb-3">Ihre Buchungsdetails:</h3>
            <div className="space-y-2 text-sm">
              <p><span className="font-medium">Zimmernummer:</span> {bookingDetails?.room_number}</p>
              <p><span className="font-medium">Zimmertyp:</span> {formData.room_type}</p>
              <p><span className="font-medium">Check-In:</span> {formData.check_in_date}</p>
              <p><span className="font-medium">Check-Out:</span> {formData.check_out_date}</p>
              <p><span className="font-medium">Gesamtpreis:</span> €{bookingDetails?.total_price?.toFixed(2)}</p>
            </div>
          </div>
          <Button
            onClick={() => window.location.href = '/login'}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            Zum Management-System
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="bg-white border-b border-zinc-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <h1 className="text-4xl font-bold tracking-tight text-zinc-950 font-heading">Grand Hotel</h1>
          <p className="text-zinc-600 mt-1">Online Buchung</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <Card className="p-8">
              <h2 className="text-2xl font-bold text-zinc-950 font-heading mb-6">Ihre Buchung</h2>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold tracking-[0.1em] uppercase text-zinc-500 mb-2 block">
                      Name *
                    </label>
                    <Input
                      value={formData.guest_name}
                      onChange={(e) => setFormData({ ...formData, guest_name: e.target.value })}
                      required
                      data-testid="guest-name-input"
                      placeholder="Max Mustermann"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold tracking-[0.1em] uppercase text-zinc-500 mb-2 block">
                      E-Mail *
                    </label>
                    <Input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      required
                      data-testid="guest-email-input"
                      placeholder="max@beispiel.de"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold tracking-[0.1em] uppercase text-zinc-500 mb-2 block">
                      Telefon *
                    </label>
                    <Input
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      required
                      data-testid="guest-phone-input"
                      placeholder="+49 123 456789"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold tracking-[0.1em] uppercase text-zinc-500 mb-2 block">
                      Kategorie *
                    </label>
                    <Select
                      value={formData.room_type}
                      onValueChange={(value) => setFormData({ ...formData, room_type: value })}
                    >
                      <SelectTrigger data-testid="room-type-select">
                        <SelectValue placeholder="Wählen Sie eine Kategorie" />
                      </SelectTrigger>
                      <SelectContent>
                        {roomTypes.map(rt => (
                          <SelectItem key={rt.type} value={rt.type}>
                            {rt.type === 'Villa' ? 'Villen' : rt.type === 'Ferienhaus' ? 'Ferienhäuser' : rt.type} - €{rt.price_per_night}/Nacht
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold tracking-[0.1em] uppercase text-zinc-500 mb-2 block">
                      Check-In *
                    </label>
                    <Input
                      type="date"
                      value={formData.check_in_date}
                      onChange={(e) => setFormData({ ...formData, check_in_date: e.target.value })}
                      required
                      data-testid="check-in-date-input"
                      min={new Date().toISOString().split('T')[0]}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold tracking-[0.1em] uppercase text-zinc-500 mb-2 block">
                      Check-Out *
                    </label>
                    <Input
                      type="date"
                      value={formData.check_out_date}
                      onChange={(e) => setFormData({ ...formData, check_out_date: e.target.value })}
                      required
                      data-testid="check-out-date-input"
                      min={formData.check_in_date}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold tracking-[0.1em] uppercase text-zinc-500 mb-2 block">
                      Anzahl Gäste *
                    </label>
                    <Input
                      type="number"
                      min="1"
                      max="4"
                      value={formData.guests_count}
                      onChange={(e) => setFormData({ ...formData, guests_count: parseInt(e.target.value) })}
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold tracking-[0.1em] uppercase text-zinc-500 mb-2 block">
                    Besondere Wünsche
                  </label>
                  <textarea
                    className="w-full min-h-[100px] px-3 py-2 border border-zinc-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600"
                    value={formData.special_requests}
                    onChange={(e) => setFormData({ ...formData, special_requests: e.target.value })}
                    placeholder="z.B. Allergien, Nichtraucherzimmer, etc."
                  />
                </div>

                <div className="pt-6 border-t">
                  <Button
                    type="submit"
                    disabled={loading}
                    data-testid="submit-booking-button"
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white h-12 text-lg"
                  >
                    {loading ? 'Buchung wird verarbeitet...' : 'Jetzt buchen'}
                  </Button>
                </div>
              </form>
            </Card>
          </div>

          <div className="space-y-6">
            <Card className="p-6 bg-blue-50 border-blue-200">
              <h3 className="text-lg font-semibold text-zinc-900 mb-4">Ihre Zusammenfassung</h3>
              {formData.room_type && (
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span>Kategorie:</span>
                    <span className="font-medium">{formData.room_type}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Nächte:</span>
                    <span className="font-medium">
                      {Math.max(0, Math.ceil((new Date(formData.check_out_date) - new Date(formData.check_in_date)) / (1000 * 60 * 60 * 24)))}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Gäste:</span>
                    <span className="font-medium">{formData.guests_count}</span>
                  </div>
                  <div className="pt-3 border-t border-blue-300 flex justify-between text-lg font-bold text-blue-900">
                    <span>Gesamt:</span>
                    <span>€{calculateTotal().toFixed(2)}</span>
                  </div>
                </div>
              )}
              {!formData.room_type && (
                <p className="text-zinc-600 text-sm">Wählen Sie eine Kategorie, um den Preis zu sehen</p>
              )}
            </Card>

            {formData.room_type && roomTypes.find(rt => rt.type === formData.room_type) && (
              <Card className="p-6">
                <h3 className="text-lg font-semibold text-zinc-900 mb-3">
                  {roomTypes.find(rt => rt.type === formData.room_type).type}
                </h3>
                <p className="text-sm text-zinc-600 mb-4">
                  {roomTypes.find(rt => rt.type === formData.room_type).description}
                </p>
                <div className="space-y-2">
                  {roomTypes.find(rt => rt.type === formData.room_type).features.map((feature, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-sm text-zinc-700">
                      <CheckCircle size={16} weight="fill" className="text-emerald-600" />
                      {feature}
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}