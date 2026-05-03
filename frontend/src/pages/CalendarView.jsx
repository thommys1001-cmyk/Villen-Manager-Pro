import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Sidebar } from '../components/Sidebar';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Calendar as CalendarIcon, DotsSixVertical } from '@phosphor-icons/react';
import { toast } from 'sonner';

function SortableBookingItem({ booking }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: booking._id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const getStatusColor = (status) => {
    const colors = {
      pending: 'bg-gold-50 border-gold-200 text-gold-700',
      checked_in: 'bg-emerald-50 border-emerald-200 text-emerald-700',
      checked_out: 'bg-zinc-50 border-zinc-200 text-zinc-700',
    };
    return colors[status] || colors.pending;
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="bg-white border border-zinc-200 rounded-lg p-4 mb-2 hover:shadow-md transition-shadow"
    >
      <div className="flex items-start gap-3">
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing mt-1 text-zinc-400 hover:text-zinc-600"
        >
          <DotsSixVertical size={20} weight="bold" />
        </button>
        <div className="flex-1">
          <div className="flex justify-between items-start mb-2">
            <div>
              <h3 className="font-semibold text-zinc-900">{booking.guest_name}</h3>
              <p className="text-sm text-zinc-600">Zimmer {booking.room_number}</p>
            </div>
            <Badge className={getStatusColor(booking.status)}>
              {booking.status === 'pending' ? 'Ausstehend' : 
               booking.status === 'checked_in' ? 'Eingecheckt' : 'Ausgecheckt'}
            </Badge>
          </div>
          <div className="grid grid-cols-2 gap-2 text-sm text-zinc-600">
            <div>
              <span className="font-medium">Check-In:</span> {booking.check_in_date}
            </div>
            <div>
              <span className="font-medium">Check-Out:</span> {booking.check_out_date}
            </div>
            <div>
              <span className="font-medium">Typ:</span> {booking.room_type}
            </div>
            <div>
              <span className="font-medium">Preis:</span> €{booking.price.toFixed(2)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CalendarView() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewDate, setViewDate] = useState(new Date().toISOString().split('T')[0]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    fetchBookings();
  }, [viewDate]);

  const fetchBookings = async () => {
    setLoading(true);
    try {
      const { data } = await axios.get(
        `${process.env.REACT_APP_BACKEND_URL}/api/bookings`,
        { withCredentials: true }
      );
      // Sort by check-in date
      const sorted = data.sort((a, b) => 
        new Date(a.check_in_date) - new Date(b.check_in_date)
      );
      setBookings(sorted);
    } catch (error) {
      toast.error('Fehler beim Laden der Buchungen');
    } finally {
      setLoading(false);
    }
  };

  const handleDragEnd = (event) => {
    const { active, over } = event;

    if (active.id !== over.id) {
      setBookings((items) => {
        const oldIndex = items.findIndex(item => item._id === active.id);
        const newIndex = items.findIndex(item => item._id === over.id);
        
        toast.success('Reihenfolge aktualisiert');
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const groupedBookings = bookings.reduce((acc, booking) => {
    const date = booking.check_in_date;
    if (!acc[date]) {
      acc[date] = [];
    }
    acc[date].push(booking);
    return acc;
  }, {});

  const dates = Object.keys(groupedBookings).sort();

  return (
    <div className="flex" data-testid="calendar-view-page">
      <Sidebar />
      <div className="flex-1 ml-64">
        <div className="bg-white/80 backdrop-blur-xl border-b border-zinc-200 sticky top-0 z-40">
          <div className="p-6">
            <h1 className="text-4xl font-bold tracking-tight text-zinc-950 font-heading">
              Kalenderansicht
            </h1>
            <p className="text-zinc-600 mt-1">
              Drag & Drop zum Neuordnen der Buchungen
            </p>
          </div>
        </div>

        <div className="p-8">
          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
            </div>
          ) : bookings.length === 0 ? (
            <div className="text-center py-12">
              <CalendarIcon size={64} className="mx-auto text-zinc-300 mb-4" />
              <p className="text-zinc-600">Keine Buchungen gefunden</p>
            </div>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <div className="space-y-8">
                {dates.map(date => (
                  <div key={date} className="bg-zinc-50 rounded-lg p-6">
                    <h2 className="text-xl font-semibold text-zinc-900 mb-4 flex items-center gap-2">
                      <CalendarIcon size={24} weight="fill" className="text-blue-600" />
                      {new Date(date).toLocaleDateString('de-DE', { 
                        weekday: 'long', 
                        year: 'numeric', 
                        month: 'long', 
                        day: 'numeric' 
                      })}
                      <Badge className="ml-2">{groupedBookings[date].length} Buchungen</Badge>
                    </h2>
                    <SortableContext
                      items={groupedBookings[date].map(b => b._id)}
                      strategy={verticalListSortingStrategy}
                    >
                      {groupedBookings[date].map(booking => (
                        <SortableBookingItem key={booking._id} booking={booking} />
                      ))}
                    </SortableContext>
                  </div>
                ))}
              </div>
            </DndContext>
          )}
        </div>
      </div>
    </div>
  );
}
