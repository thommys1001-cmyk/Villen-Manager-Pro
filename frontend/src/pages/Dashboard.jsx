import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Sidebar } from '../components/Sidebar';
import { Card } from '../components/ui/card';
import { 
  Calendar, 
  DoorOpen, 
  CurrencyDollar, 
  TrendUp,
  Users,
  CheckCircle
} from '@phosphor-icons/react';
import { toast } from 'sonner';

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const { data } = await axios.get(
        `${process.env.REACT_APP_BACKEND_URL}/api/stats/dashboard`,
        { withCredentials: true }
      );
      setStats(data);
    } catch (error) {
      toast.error('Fehler beim Laden der Statistiken');
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    {
      label: 'Gesamtbuchungen',
      value: stats?.total_bookings || 0,
      icon: Calendar,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
    },
    {
      label: 'Eingecheckt',
      value: stats?.checked_in || 0,
      icon: DoorOpen,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
    },
    {
      label: 'Ausstehend',
      value: stats?.pending || 0,
      icon: CheckCircle,
      color: 'text-amber-600',
      bg: 'bg-amber-50',
    },
    {
      label: 'Gesamteinnahmen',
      value: `€${(stats?.total_income || 0).toFixed(2)}`,
      icon: TrendUp,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
    },
    {
      label: 'Gesamtausgaben',
      value: `€${(stats?.total_expenses || 0).toFixed(2)}`,
      icon: CurrencyDollar,
      color: 'text-red-600',
      bg: 'bg-red-50',
    },
    {
      label: 'Nettogewinn',
      value: `€${(stats?.net_income || 0).toFixed(2)}`,
      icon: CurrencyDollar,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
    },
  ];

  if (loading) {
    return (
      <div className="flex">
        <Sidebar />
        <div className="flex-1 ml-64">
          <div className="p-8">
            <div className="text-center py-12">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex" data-testid="dashboard-page">
      <Sidebar />
      <div className="flex-1 ml-64">
        <div className="bg-white/80 backdrop-blur-xl border-b border-zinc-200 sticky top-0 z-40">
          <div className="p-6">
            <h1 className="text-4xl font-bold tracking-tight text-zinc-950 font-heading">Dashboard</h1>
            <p className="text-zinc-600 mt-1">Übersicht über Ihr Hotel</p>
          </div>
        </div>

        <div className="p-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {statCards.map((stat, index) => {
              const Icon = stat.icon;
              return (
                <Card
                  key={index}
                  className="p-6 border border-zinc-200 bg-white hover:shadow-lg transition-shadow duration-200"
                  data-testid={`stat-card-${stat.label.toLowerCase().replace(/\s+/g, '-')}`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs font-semibold tracking-[0.1em] uppercase text-zinc-500 mb-2">
                        {stat.label}
                      </p>
                      <p className="text-3xl font-bold text-zinc-950 font-heading">
                        {stat.value}
                      </p>
                    </div>
                    <div className={`${stat.bg} ${stat.color} p-3 rounded-lg`}>
                      <Icon size={24} weight="fill" />
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}