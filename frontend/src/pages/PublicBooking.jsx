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
    price_per_night: '',
    deposit: '',
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
    
    const checkIn = new Date(formData.check_in_date);
    const checkOut = new Date(formData.check_out_date);
    const nights = Math.max(0, Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24)));
    
    // Use custom price if set, otherwise default
    const pricePerNight = parseFloat(formData.price_per_night) || 0;
    if (pricePerNight > 0) {
      return pricePerNight * nights;
    }
    
    const roomType = roomTypes.find(rt => rt.type === formData.room_type);
    if (!roomType) return 0;
    return roomType.price_per_night * nights;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const submitData = {
        ...formData,
        price_per_night: formData.price_per_night ? parseFloat(formData.price_per_night) : null,
        deposit: formData.deposit ? parseFloat(formData.deposit) : 0
      };
      
      const { data } = await axios.post(
        `${process.env.REACT_APP_BACKEND_URL}/api/public/bookings`,
        submitData
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
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
        <Card className="max-w-2xl w-full p-8 text-center">
          <div className="mb-6 flex justify-center">
            <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center">
              <CheckCircle size={48} weight="fill" className="text-emerald-600" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-gold-400 font-heading mb-4">Buchung erfolgreich!</h1>
          <p className="text-gold-600 mb-6">
            Vielen Dank für Ihre Buchung. Eine Bestätigungs-E-Mail wurde an <strong>{formData.email}</strong> gesendet.
          </p>
          <div className="bg-zinc-950 border border-gold-500/30 rounded-lg p-6 mb-6 text-left">
            <h3 className="font-semibold text-gold-400 mb-3">Ihre Buchungsdetails:</h3>
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
    <div className="min-h-screen bg-zinc-950">
      <div className="bg-zinc-950 border-b border-gold-500/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex items-center gap-4">
          <img 
            src="https://customer-assets.emergentagent.com/wingman/359d1d25-501d-49ee-acdc-7ddd114c4b2b/attachments/abc94a5694cb4db0a3fad6a16ce20ec7_icon (1).png" 
            alt="Villen Manager Pro"
            className="w-16 h-16 object-contain logo-no-bg"
          />
          <div>
            <h1 className="text-3xl font-bold tracking-wider text-gold-400 font-heading">VILLEN MANAGER PRO</h1>
            <p className="text-gold-600 mt-1">Online Buchung</p>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <Card className="p-8 bg-zinc-900 border-gold-500/30">
              <h2 className="text-2xl font-bold text-gold-400 font-heading mb-6">Ihre Buchung</h2>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold tracking-[0.1em] uppercase text-gold-500 mb-2 block">
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
                    <label className="text-xs font-semibold tracking-[0.1em] uppercase text-gold-500 mb-2 block">
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
                    <label className="text-xs font-semibold tracking-[0.1em] uppercase text-gold-500 mb-2 block">
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
                    <label className="text-xs font-semibold tracking-[0.1em] uppercase text-gold-500 mb-2 block">
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
                        <SelectItem value="Villa">Villen</SelectItem>
                        <SelectItem value="Ferienhaus">Ferienhäuser</SelectItem>
                        <SelectItem value="Appartment">Appartment</SelectItem>
                        <SelectItem value="Zimmer">Zimmer</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold tracking-[0.1em] uppercase text-gold-500 mb-2 block">
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
                    <label className="text-xs font-semibold tracking-[0.1em] uppercase text-gold-500 mb-2 block">
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
                    <label className="text-xs font-semibold tracking-[0.1em] uppercase text-gold-500 mb-2 block">
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

                  <div>
                    <label className="text-xs font-semibold tracking-[0.1em] uppercase text-gold-500 mb-2 block">
                      Preis pro Nacht (€)
                    </label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.price_per_night}
                      onChange={(e) => setFormData({ ...formData, price_per_night: e.target.value })}
                      data-testid="price-per-night-input"
                      placeholder="z.B. 250.00"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold tracking-[0.1em] uppercase text-gold-500 mb-2 block">
                      Kaution (€)
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
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold tracking-[0.1em] uppercase text-gold-500 mb-2 block">
                    Besondere Wünsche
                  </label>
                  <textarea
                    className="w-full min-h-[100px] px-3 py-2 border border-gold-500/30 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600"
                    value={formData.special_requests}
                    onChange={(e) => setFormData({ ...formData, special_requests: e.target.value })}
                    placeholder="z.B. Allergien, Nichtraucherzimmer, etc."
                  />
                </div>

                <div className="pt-6 border-t border-gold-500/30">
                  <Button
                    type="submit"
                    disabled={loading}
                    data-testid="submit-booking-button"
                    className="w-full bg-gradient-to-r from-gold-500 to-gold-600 hover:from-gold-400 hover:to-gold-500 text-gold-400 h-12 text-lg font-bold shadow-xl shadow-gold-500/30"
                  >
                    {loading ? 'Buchung wird verarbeitet...' : 'Jetzt buchen'}
                  </Button>
                </div>
              </form>
            </Card>
          </div>

          <div className="space-y-6">
            <Card className="p-6 bg-zinc-900 border-gold-500/30">
              <h3 className="text-lg font-semibold text-gold-400 mb-4">Ihre Zusammenfassung</h3>
              {formData.room_type && (
                <div className="space-y-3 text-sm text-gold-400">
                  <div className="flex justify-between">
                    <span>Kategorie:</span>
                    <span className="font-medium text-gold-500">{formData.room_type}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Nächte:</span>
                    <span className="font-medium text-gold-500">
                      {Math.max(0, Math.ceil((new Date(formData.check_out_date) - new Date(formData.check_in_date)) / (1000 * 60 * 60 * 24)))}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Gäste:</span>
                    <span className="font-medium text-gold-500">{formData.guests_count}</span>
                  </div>
                  {formData.deposit && parseFloat(formData.deposit) > 0 && (
                    <div className="flex justify-between">
                      <span>Kaution:</span>
                      <span className="font-medium text-gold-500">€{parseFloat(formData.deposit).toFixed(2)}</span>
                    </div>
                  )}
                  <div className="pt-3 border-t border-gold-500/30 flex justify-between text-lg font-bold">
                    <span className="text-gold-400">Gesamt:</span>
                    <span className="text-gold-500">€{calculateTotal().toFixed(2)}</span>
                  </div>
                </div>
              )}
              {!formData.room_type && (
                <p className="text-gold-600 text-sm">Wählen Sie eine Kategorie, um den Preis zu sehen</p>
              )}
            </Card>

            {formData.room_type && roomTypes.find(rt => rt.type === formData.room_type) && (
              <Card className="p-6">
                <h3 className="text-lg font-semibold text-gold-400 mb-3">
                  {roomTypes.find(rt => rt.type === formData.room_type).type}
                </h3>
                <p className="text-sm text-gold-600 mb-4">
                  {roomTypes.find(rt => rt.type === formData.room_type).description}
                </p>
                <div className="space-y-2">
                  {roomTypes.find(rt => rt.type === formData.room_type).features.map((feature, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-sm text-gold-500">
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