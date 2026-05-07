import React, { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { Sidebar } from '../components/Sidebar';
import { Card } from '../components/ui/card';
import { 
  Calendar, 
  DoorOpen, 
  CurrencyDollar, 
  TrendUp,
  CheckCircle,
  Buildings,
  Bell
} from '@phosphor-icons/react';
import { toast } from 'sonner';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
  Legend
} from 'recharts';
import { PushNotificationToggle } from '../components/PushNotificationToggle';

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const [statsRes, bookingsRes] = await Promise.all([
        axios.get(`${process.env.REACT_APP_BACKEND_URL}/api/stats/dashboard`, { withCredentials: true }),
        axios.get(`${process.env.REACT_APP_BACKEND_URL}/api/bookings`, { withCredentials: true })
      ]);
      setStats(statsRes.data);
      setBookings(bookingsRes.data);
    } catch (error) {
      toast.error('Fehler beim Laden der Daten');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const statCards = [
    {
      label: 'Gesamtbuchungen',
      value: stats?.total_bookings || 0,
      icon: Calendar,
      color: 'text-gold-500',
    },
    {
      label: 'Eingecheckt',
      value: stats?.checked_in || 0,
      icon: DoorOpen,
      color: 'text-gold-400',
    },
    {
      label: 'Ausstehend',
      value: stats?.pending || 0,
      icon: CheckCircle,
      color: 'text-gold-500',
    },
    {
      label: 'Gesamteinnahmen',
      value: `€${(stats?.total_income || 0).toFixed(2)}`,
      icon: TrendUp,
      color: 'text-gold-400',
    },
    {
      label: 'Gesamtausgaben',
      value: `€${(stats?.total_expenses || 0).toFixed(2)}`,
      icon: CurrencyDollar,
      color: 'text-gold-600',
    },
    {
      label: 'Nettogewinn',
      value: `€${(stats?.net_income || 0).toFixed(2)}`,
      icon: CurrencyDollar,
      color: 'text-gold-500',
    },
  ];

  // Calculate bookings by property type
  const bookingsByType = bookings.reduce((acc, b) => {
    acc[b.room_type] = (acc[b.room_type] || 0) + 1;
    return acc;
  }, {});

  const propertyTypeData = Object.keys(bookingsByType).map(type => ({
    name: type,
    buchungen: bookingsByType[type]
  }));

  // If no data, show default categories
  if (propertyTypeData.length === 0) {
    propertyTypeData.push(
      { name: 'Villa', buchungen: 0 },
      { name: 'Ferienhaus', buchungen: 0 },
      { name: 'Appartment', buchungen: 0 },
      { name: 'Zimmer', buchungen: 0 }
    );
  }

  // Status breakdown - using exact gold hex values
  const statusData = [
    { name: 'Ausstehend', value: bookings.filter(b => b.status === 'pending').length, color: '#D4AF37' },
    { name: 'Eingecheckt', value: bookings.filter(b => b.status === 'checked_in').length, color: '#F1D279' },
    { name: 'Ausgecheckt', value: bookings.filter(b => b.status === 'checked_out').length, color: '#B8941F' }
  ];

  // Monthly revenue (last 6 months)
  const now = new Date();
  const monthlyRevenue = [];
  for (let i = 5; i >= 0; i--) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthStr = date.toLocaleDateString('de-DE', { month: 'short' });
    const monthBookings = bookings.filter(b => {
      const bDate = new Date(b.check_in_date);
      return bDate.getMonth() === date.getMonth() && bDate.getFullYear() === date.getFullYear();
    });
    const revenue = monthBookings.reduce((sum, b) => sum + (b.price || 0), 0);
    monthlyRevenue.push({ month: monthStr, einnahmen: revenue });
  }

  if (loading) {
    return (
      <div className="flex bg-zinc-950 min-h-screen">
        <Sidebar />
        <div className="flex-1 lg:ml-64 pt-16 lg:pt-0">
          <div className="p-8">
            <div className="text-center py-12">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-gold-500 border-r-transparent"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex bg-zinc-950 min-h-screen" data-testid="dashboard-page">
      <Sidebar />
      <div className="flex-1 lg:ml-64 pt-16 lg:pt-0">
        <div className="bg-zinc-950/90 backdrop-blur-xl border-b border-gold-900/30 sticky top-0 z-40">
          <div className="p-6">
            <h1 className="text-4xl font-bold tracking-tight text-gold-500 font-heading">Dashboard</h1>
            <p className="text-gold-700 mt-1">Übersicht Ihrer Immobilienverwaltung</p>
          </div>
        </div>

        <div className="p-8 space-y-8">
          {/* Stat Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {statCards.map((stat) => {
              const Icon = stat.icon;
              return (
                <Card
                  key={stat.label}
                  className="p-6 border border-gold-900/30 bg-zinc-900 hover:border-gold-500/50 transition-all duration-200 hover:shadow-lg hover:shadow-gold-500/10"
                  data-testid={`stat-card-${stat.label.toLowerCase().replace(/\s+/g, '-')}`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs font-semibold tracking-[0.1em] uppercase text-gold-700 mb-2">
                        {stat.label}
                      </p>
                      <p className="text-3xl font-bold text-gold-400 font-heading">
                        {stat.value}
                      </p>
                    </div>
                    <div className={`bg-zinc-950 ${stat.color} p-3 rounded-lg border border-gold-900/30`}>
                      <Icon size={24} weight="fill" />
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Bookings by Property Type */}
            <Card className="p-6 border border-gold-900/30 bg-zinc-900">
              <h2 className="text-xl font-bold font-heading text-gold-500 mb-4 flex items-center gap-2">
                <Buildings size={24} weight="fill" />
                Buchungen nach Kategorie
              </h2>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={propertyTypeData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" />
                  <XAxis dataKey="name" stroke="#D4AF37" />
                  <YAxis stroke="#D4AF37" />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#18181b', 
                      border: '1px solid #D4AF37',
                      borderRadius: '8px',
                      color: '#D4AF37'
                    }}
                  />
                  <Bar dataKey="buchungen" fill="#D4AF37" radius={[8, 8, 0, 0]}>
                    {propertyTypeData.map((entry, index) => (
                      <Cell key={`cell-${entry.name}`} fill={index % 2 === 0 ? '#D4AF37' : '#F1D279'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Card>

            {/* Status Distribution */}
            <Card className="p-6 border border-gold-900/30 bg-zinc-900">
              <h2 className="text-xl font-bold font-heading text-gold-500 mb-4 flex items-center gap-2">
                <CheckCircle size={24} weight="fill" />
                Buchungsstatus
              </h2>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={statusData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, value }) => `${name}: ${value}`}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {statusData.map((entry) => (
                      <Cell key={`cell-${entry.name}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#18181b', 
                      border: '1px solid #D4AF37',
                      borderRadius: '8px',
                      color: '#D4AF37'
                    }}
                  />
                  <Legend wrapperStyle={{ color: '#D4AF37' }} />
                </PieChart>
              </ResponsiveContainer>
            </Card>
          </div>

          {/* Monthly Revenue */}
          <Card className="p-6 border border-gold-900/30 bg-zinc-900">
            <h2 className="text-xl font-bold font-heading text-gold-500 mb-4 flex items-center gap-2">
              <TrendUp size={24} weight="fill" />
              Monatliche Einnahmen (Letzte 6 Monate)
            </h2>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={monthlyRevenue}>
                <CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" />
                <XAxis dataKey="month" stroke="#D4AF37" />
                <YAxis stroke="#D4AF37" />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#18181b', 
                    border: '1px solid #D4AF37',
                    borderRadius: '8px',
                    color: '#D4AF37'
                  }}
                  formatter={(value) => [`€${value.toFixed(2)}`, 'Einnahmen']}
                />
                <Bar dataKey="einnahmen" fill="url(#goldGradient)" radius={[8, 8, 0, 0]} />
                <defs>
                  <linearGradient id="goldGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#F1D279" />
                    <stop offset="100%" stopColor="#D4AF37" />
                  </linearGradient>
                </defs>
              </BarChart>
            </ResponsiveContainer>
          </Card>

          {/* Push Notifications */}
          <Card className="p-6 border border-gold-500/30 bg-gradient-to-br from-zinc-900 to-zinc-950">
            <h2 className="text-xl font-bold font-heading text-gold-400 mb-3 flex items-center gap-2">
              <Bell size={24} weight="fill" />
              Push-Benachrichtigungen
            </h2>
            <p className="text-sm text-gold-600 mb-4">
              Erhalten Sie sofort eine Benachrichtigung auf Ihrem Gerät, sobald eine neue Buchung eingeht - auch wenn die App geschlossen ist.
            </p>
            <PushNotificationToggle />
          </Card>

          {/* Contact Info Card */}
          <Card className="p-6 border border-gold-900/30 bg-gradient-to-br from-zinc-900 to-zinc-950">
            <h2 className="text-xl font-bold font-heading text-gold-500 mb-4">Kontaktdaten</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-gold-700 text-xs uppercase tracking-wider mb-1">Website</p>
                <a href="https://www.luxusvilla-ferien.de" target="_blank" rel="noopener noreferrer" className="text-gold-400 hover:text-gold-300 transition-colors">
                  www.luxusvilla-ferien.de
                </a>
              </div>
              <div>
                <p className="text-gold-700 text-xs uppercase tracking-wider mb-1">E-Mail</p>
                <a href="mailto:info@luxusvilla-ferien.de" className="text-gold-400 hover:text-gold-300 transition-colors">
                  info@luxusvilla-ferien.de
                </a>
              </div>
              <div>
                <p className="text-gold-700 text-xs uppercase tracking-wider mb-1">WhatsApp</p>
                <a href="https://wa.me/4915227072018" target="_blank" rel="noopener noreferrer" className="text-gold-400 hover:text-gold-300 transition-colors">
                  +49 1522 7072 018
                </a>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
