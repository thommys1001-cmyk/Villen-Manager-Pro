import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Sidebar } from '../components/Sidebar';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import { MagnifyingGlass } from '@phosphor-icons/react';
import { toast } from 'sonner';

export default function Availability() {
  const [availability, setAvailability] = useState([]);
  const [loading, setLoading] = useState(false);
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(
    new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );

  const fetchAvailability = async () => {
    setLoading(true);
    try {
      const { data } = await axios.get(
        `${process.env.REACT_APP_BACKEND_URL}/api/availability?start_date=${startDate}&end_date=${endDate}`,
        { withCredentials: true }
      );
      setAvailability(data);
    } catch (error) {
      toast.error('Fehler beim Laden der Verfügbarkeit');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAvailability();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const availableCount = availability.filter(r => r.is_available).length;
  const occupiedCount = availability.filter(r => !r.is_available).length;

  return (
    <div className="flex" data-testid="availability-page">
      <Sidebar />
      <div className="flex-1 lg:ml-64 pt-16 lg:pt-0">
        <div className="bg-zinc-900/80 backdrop-blur-xl border-b border-gold-500/30 sticky top-0 z-40">
          <div className="p-6">
            <h1 className="text-4xl font-bold tracking-tight text-gold-400 font-heading">Verfügbarkeit</h1>
            <p className="text-gold-600 mt-1">Überblick über verfügbare und belegte Unterkünfte</p>
          </div>
        </div>

        <div className="p-8">
          <div className="bg-zinc-900 border border-gold-500/30 rounded-lg p-6 mb-6">
            <div className="flex gap-4 items-end flex-wrap">
              <div className="flex-1 min-w-[150px]">
                <label className="text-xs font-semibold tracking-[0.1em] uppercase text-gold-500 mb-2 block">
                  Von
                </label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  data-testid="start-date-input"
                />
              </div>
              <div className="flex-1 min-w-[150px]">
                <label className="text-xs font-semibold tracking-[0.1em] uppercase text-gold-500 mb-2 block">
                  Bis
                </label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  data-testid="end-date-input"
                />
              </div>
              <Button
                onClick={fetchAvailability}
                data-testid="search-availability-button"
                className="bg-gradient-to-r from-gold-500 to-gold-600 hover:from-gold-400 hover:to-gold-500 text-zinc-950 font-semibold"
              >
                <MagnifyingGlass size={20} className="mr-2" weight="bold" />
                Suchen
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div className="bg-zinc-900 border border-gold-500/30 rounded-lg p-6">
              <p className="text-xs font-semibold tracking-[0.1em] uppercase text-gold-500 mb-2">
                Unterkunft
              </p>
              <p className="text-3xl font-bold text-emerald-500 font-heading">{availableCount}</p>
              <p className="text-xs text-gold-600 mt-1">Verfügbar im Zeitraum</p>
            </div>
            <div className="bg-zinc-900 border border-gold-500/30 rounded-lg p-6">
              <p className="text-xs font-semibold tracking-[0.1em] uppercase text-gold-500 mb-2">
                Belegte Unterkünfte
              </p>
              <p className="text-3xl font-bold text-red-500 font-heading">{occupiedCount}</p>
              <p className="text-xs text-gold-600 mt-1">Im Zeitraum belegt</p>
            </div>
          </div>

          <div className="bg-zinc-900 border border-gold-500/30 rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-zinc-950 border-b border-gold-500/30">
                  <TableHead className="font-semibold text-gold-400">Unterkunft</TableHead>
                  <TableHead className="font-semibold text-gold-400">Kategorie</TableHead>
                  <TableHead className="font-semibold text-gold-400">Status</TableHead>
                  <TableHead className="font-semibold text-gold-400">Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8">
                      <div className="inline-block h-6 w-6 animate-spin rounded-full border-4 border-solid border-gold-500 border-r-transparent"></div>
                    </TableCell>
                  </TableRow>
                ) : availability.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8 text-gold-600">
                      Keine Unterkünfte angelegt. Bitte unter "Immobilien" neue Unterkünfte erstellen.
                    </TableCell>
                  </TableRow>
                ) : (
                  availability.map((acc) => (
                    <TableRow key={acc.room_number} data-testid={`accommodation-row-${acc.room_number}`}>
                      <TableCell className="font-medium text-gold-300">{acc.room_number}</TableCell>
                      <TableCell className="text-gold-500">{acc.category || '-'}</TableCell>
                      <TableCell>
                        {acc.is_available ? (
                          <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/40">
                            Verfügbar
                          </Badge>
                        ) : (
                          <Badge className="bg-red-500/15 text-red-400 border-red-500/40">
                            Belegt
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {!acc.is_available && acc.bookings.length > 0 && (
                          <div className="text-sm">
                            {acc.bookings.map((booking, idx) => (
                              <div key={idx} className="mb-1">
                                <span className="font-medium text-gold-400">{booking.guest_name}</span>
                                <span className="text-gold-600 ml-2">
                                  {booking.check_in} bis {booking.check_out}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                        {acc.is_available && (
                          <span className="text-gold-600 text-sm">Keine Buchungen</span>
                        )}
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
