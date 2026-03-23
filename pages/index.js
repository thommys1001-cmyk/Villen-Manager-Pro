import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

// DATENBANK-VERBINDUNG (Hier kommen deine Keys von Supabase rein)
const supabase = createClient('https://trlascshalvpwqxmfrfg.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...');
export default function VillenManagerPro() {
  const [session, setSession] = useState(null);
  const [view, setView] = useState('dashboard');
  const [bookings, setBookings] = useState([]);
  const [finances, setFinances] = useState([]);
  const [loading, setLoading] = useState(true);

  // 1. DATEN-LADEN & SYNC
  useEffect(() => {
    fetchAppData();
    // Realtime-Abo: Aktualisiert PC & Handy gleichzeitig bei Änderungen
    const channel = supabase.channel('realtime_villas').on('postgres_changes', 
      { event: '*', schema: 'public' }, () => fetchAppData()).subscribe();
    return () => supabase.removeChannel(channel);
  }, []);

  async function fetchAppData() {
    const { data: b } = await supabase.from('bookings').select('*').order('check_in', { ascending: true });
    const { data: f } = await supabase.from('finances').select('*').order('date', { descending: true });
    setBookings(b || []);
    setFinances(f || []);
    setLoading(false);
  }

  // 2. FINANZ-LOGIK (Rechnet alles zusammen)
  const stats = finances.reduce((acc, item) => {
    if (item.type === 'income') acc.revenue += item.amount;
    else acc.expenses += item.amount;
    return acc;
  }, { revenue: 0, expenses: 0 });

  // 3. UI DESIGN (LUXUS SCHWARZ/GOLD)
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white font-sans pb-20">
      
      {/* NAVIGATION OBEN */}
      <header className="p-6 border-b border-[#D4AF37] bg-black flex justify-between items-center sticky top-0 z-50">
        <div>
          <h1 className="text-[#D4AF37] text-2xl font-black tracking-tighter">VILLENMANAGER PRO</h1>
          <p className="text-[10px] text-gray-500 uppercase tracking-widest">Premium Sync Edition</p>
        </div>
        <div className="hidden md:flex gap-6 text-sm uppercase font-bold text-gray-400">
          <button onClick={() => setView('dashboard')} className={view === 'dashboard' ? 'text-[#D4AF37]' : ''}>Dashboard</button>
          <button onClick={() => setView('finance')} className={view === 'finance' ? 'text-[#D4AF37]' : ''}>Buchhaltung</button>
          <button onClick={() => setView('guests')} className={view === 'guests' ? 'text-[#D4AF37]' : ''}>Gäste</button>
        </div>
      </header>

      <main className="p-4 max-w-6xl mx-auto">
        
        {/* DASHBOARD ANSICHT */}
        {view === 'dashboard' && (
          <div className="space-y-6 animate-fade-in">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-[#1a1a1a] p-6 rounded-2xl border border-gray-800 shadow-xl">
                <p className="text-gray-500 text-xs mb-1">MONATS-UMSATZ</p>
                <h2 className="text-3xl font-bold text-green-500">{stats.revenue.toLocaleString()} €</h2>
              </div>
              <div className="bg-[#1a1a1a] p-6 rounded-2xl border border-gray-800">
                <p className="text-gray-500 text-xs mb-1">AUSGABEN (POOL/GARTEN)</p>
                <h2 className="text-3xl font-bold text-red-500">-{stats.expenses.toLocaleString()} €</h2>
              </div>
              <div className="bg-[#1a1a1a] p-6 rounded-2xl border border-[#D4AF37]/30 bg-gradient-to-br from-[#1a1a1a] to-[#000]">
                <p className="text-[#D4AF37] text-xs mb-1">REINGEWINN</p>
                <h2 className="text-3xl font-bold">{(stats.revenue - stats.expenses).toLocaleString()} €</h2>
              </div>
            </div>

            <button className="w-full bg-[#D4AF37] text-black font-black py-4 rounded-xl shadow-[0_0_20px_rgba(212,175,55,0.3)] active:scale-95 transition">
              📱 GAST-FOTOLINK GENERIEREN (AUSWEIS)
            </button>

            <h3 className="text-xl font-bold border-l-4 border-[#D4AF37] pl-4">Nächste Anreisen</h3>
            <div className="space-y-3">
              {bookings.map(book => (
                <div key={book.id} className="bg-[#111] p-4 rounded-xl border border-gray-900 flex justify-between items-center">
                  <div>
                    <p className="font-bold text-lg">{book.guest_name}</p>
                    <p className="text-xs text-gray-500">{book.villa_name} • {book.check_in}</p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-[10px] font-bold ${book.status === 'Paid' ? 'bg-green-900 text-green-400' : 'bg-yellow-900 text-yellow-400'}`}>
                    {book.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* BUCHHALTUNGS ANSICHT */}
        {view === 'finance' && (
          <div className="space-y-4">
             <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold">Finanz-Journal</h2>
                <button className="bg-white/10 px-4 py-2 rounded-lg text-xs">+ Neue Buchung</button>
             </div>
             <div className="bg-[#111] rounded-2xl overflow-hidden border border-gray-800">
                <table className="w-full text-left text-sm">
                  <thead className="bg-black text-gray-400 uppercase text-[10px]">
                    <tr>
                      <th className="p-4">Kategorie</th>
                      <th className="p-4">Datum</th>
                      <th className="p-4 text-right">Betrag</th>
                    </tr>
                  </thead>
                  <tbody>
                    {finances.map(item => (
                      <tr key={item.id} className="border-t border-gray-900">
                        <td className="p-4 font-medium">{item.category}</td>
                        <td className="p-4 text-gray-500">{item.date}</td>
                        <td className={`p-4 text-right font-bold ${item.type === 'income' ? 'text-green-500' : 'text-red-500'}`}>
                          {item.type === 'income' ? '+' : '-'}{item.amount} €
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
             </div>
          </div>
        )}

      </main>

      {/* MOBILE NAVIGATION UNTEN */}
      <nav className="md:hidden fixed bottom-0 w-full bg-black/90 backdrop-blur-md border-t border-[#D4AF37]/50 flex justify-around p-4 z-50">
        <button onClick={() => setView('dashboard')} className={view === 'dashboard' ? 'text-[#D4AF37]' : 'text-gray-600'}>
          <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path></svg>
        </button>
        <button onClick={() => setView('finance')} className={view === 'finance' ? 'text-[#D4AF37]' : 'text-gray-600'}>
          <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>
        </button>
        <button onClick={() => setView('guests')} className={view === 'guests' ? 'text-[#D4AF37]' : 'text-gray-600'}>
          <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle></svg>
        </button>
      </nav>
    </div>
  );
}