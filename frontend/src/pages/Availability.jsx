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
import { Calendar, MagnifyingGlass } from '@phosphor-icons/react';
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
  }, []);

  const availableCount = availability.filter(r => r.is_available).length;
  const occupiedCount = availability.filter(r => !r.is_available).length;

  return (
    <div className="flex" data-testid="availability-page">
      <Sidebar />
      <div className="flex-1 ml-64">
        <div className="bg-white/80 backdrop-blur-xl border-b border-zinc-200 sticky top-0 z-40">
          <div className="p-6">
            <h1 className="text-4xl font-bold tracking-tight text-zinc-950 font-heading">Zimmerverfügbarkeit</h1>
            <p className="text-zinc-600 mt-1">Überblick über verfügbare und belegte Zimmer</p>
          </div>
        </div>

        <div className="p-8">
          <div className="bg-white border border-zinc-200 rounded-lg p-6 mb-6">
            <div className="flex gap-4 items-end">
              <div className="flex-1">
                <label className="text-xs font-semibold tracking-[0.1em] uppercase text-zinc-500 mb-2 block">
                  Von
                </label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  data-testid="start-date-input"
                />
              </div>
              <div className="flex-1">
                <label className="text-xs font-semibold tracking-[0.1em] uppercase text-zinc-500 mb-2 block">
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
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                <MagnifyingGlass size={20} className="mr-2" weight="bold" />
                Suchen
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div className="bg-white border border-zinc-200 rounded-lg p-6">
              <p className="text-xs font-semibold tracking-[0.1em] uppercase text-zinc-500 mb-2">
                Verfügbare Zimmer
              </p>
              <p className="text-3xl font-bold text-emerald-600 font-heading">{availableCount}</p>
            </div>
            <div className="bg-white border border-zinc-200 rounded-lg p-6">
              <p className="text-xs font-semibold tracking-[0.1em] uppercase text-zinc-500 mb-2">
                Belegte Zimmer
              </p>
              <p className="text-3xl font-bold text-red-600 font-heading">{occupiedCount}</p>
            </div>
          </div>

          <div className="bg-white border border-zinc-200 rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-zinc-50 border-b border-zinc-200">
                  <TableHead className="font-semibold text-zinc-950">Zimmernummer</TableHead>
                  <TableHead className="font-semibold text-zinc-950">Status</TableHead>
                  <TableHead className="font-semibold text-zinc-950">Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center py-8">
                      <div className="inline-block h-6 w-6 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
                    </TableCell>
                  </TableRow>
                ) : (
                  availability.map((room) => (
                    <TableRow key={room.room_number} data-testid={`room-row-${room.room_number}`}>
                      <TableCell className="font-medium">{room.room_number}</TableCell>
                      <TableCell>
                        {room.is_available ? (
                          <Badge className="text-emerald-700 bg-emerald-50 border-emerald-200">
                            Verfügbar
                          </Badge>
                        ) : (
                          <Badge className="text-red-700 bg-red-50 border-red-200">
                            Belegt
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {!room.is_available && room.bookings.length > 0 && (
                          <div className="text-sm">
                            {room.bookings.map((booking, idx) => (
                              <div key={idx} className="mb-1">
                                <span className="font-medium">{booking.guest_name}</span>
                                <span className="text-zinc-500 ml-2">
                                  {booking.check_in} bis {booking.check_out}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                        {room.is_available && (
                          <span className="text-zinc-500 text-sm">Keine Buchungen</span>
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