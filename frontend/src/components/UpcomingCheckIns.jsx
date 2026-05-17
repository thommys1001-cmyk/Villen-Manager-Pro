import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { CalendarCheck, ArrowRight, User } from '@phosphor-icons/react';

export const UpcomingCheckIns = () => {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    axios.get(`${process.env.REACT_APP_BACKEND_URL}/api/dashboard/upcoming-checkins`, { withCredentials: true })
      .then(({ data }) => setBookings(data))
      .catch(() => setBookings([]))
      .finally(() => setLoading(false));
  }, []);

  const formatDate = (s) => {
    if (!s) return '-';
    try {
      const d = new Date(s);
      return d.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: 'short' });
    } catch {
      return s;
    }
  };

  const categoryColor = (cat) => ({
    Villa: 'bg-amber-500/15 text-amber-400 border-amber-500/40',
    Hotel: 'bg-blue-500/15 text-blue-400 border-blue-500/40',
    Ferienhaus: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/40',
    Appartment: 'bg-purple-500/15 text-purple-400 border-purple-500/40',
    Zimmer: 'bg-pink-500/15 text-pink-400 border-pink-500/40',
  }[cat] || 'bg-gold-500/15 text-gold-400 border-gold-500/40');

  return (
    <Card className="p-5 lg:p-6 bg-zinc-900 border-gold-500/30" data-testid="upcoming-checkins-widget">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <CalendarCheck size={26} weight="fill" className="text-gold-500" />
          <h2 className="text-xl lg:text-2xl font-bold text-gold-400 font-heading">Nächste Check-Ins</h2>
        </div>
        <button
          onClick={() => navigate('/check-in')}
          data-testid="goto-checkin-button"
          className="text-xs text-gold-500 hover:text-gold-400 flex items-center gap-1 font-semibold"
        >
          Alle anzeigen <ArrowRight size={14} weight="bold" />
        </button>
      </div>

      {loading ? (
        <div className="py-8 text-center">
          <div className="inline-block h-6 w-6 animate-spin rounded-full border-4 border-gold-500 border-r-transparent" />
        </div>
      ) : bookings.length === 0 ? (
        <div className="py-8 text-center text-gold-600 text-sm">
          Keine bevorstehenden Check-Ins
        </div>
      ) : (
        <div className="space-y-2">
          {bookings.map((b) => (
            <div
              key={b._id}
              data-testid={`upcoming-checkin-${b._id}`}
              className="flex items-center gap-3 p-3 bg-zinc-950 border border-gold-500/20 rounded-lg hover:border-gold-500/50 transition-colors"
            >
              <div className="text-center flex-shrink-0 px-3 py-2 bg-gold-500/10 rounded-md border border-gold-500/30 min-w-[72px]">
                <div className="text-xs text-gold-600 uppercase tracking-wider font-semibold">
                  {formatDate(b.check_in_date).split(' ')[0]}
                </div>
                <div className="text-lg font-bold text-gold-400 font-heading leading-none mt-1">
                  {b.check_in_date ? new Date(b.check_in_date).getDate() : '?'}
                </div>
                <div className="text-[10px] text-gold-600 uppercase">
                  {b.check_in_date ? new Date(b.check_in_date).toLocaleDateString('de-DE', { month: 'short' }) : ''}
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold text-gold-300 truncate">{b.room_number || '—'}</span>
                  <Badge className={`text-[10px] ${categoryColor(b.room_type)}`}>{b.room_type || '—'}</Badge>
                </div>
                <div className="flex items-center gap-1 text-sm text-gold-500">
                  <User size={14} weight="fill" />
                  <span className="truncate">{b.guest_name}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
};
