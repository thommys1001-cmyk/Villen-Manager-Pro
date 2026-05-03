import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { 
  Bed, 
  WifiHigh, 
  Snowflake, 
  Coffee,
  CaretRight,
  CheckCircle,
  Star
} from '@phosphor-icons/react';

export default function LandingPage() {
  const navigate = useNavigate();

  const features = [
    { icon: WifiHigh, title: 'Kostenfreies WLAN', desc: 'Highspeed-Internet in allen Bereichen' },
    { icon: Snowflake, title: 'Klimatisiert', desc: 'Perfekte Temperatur das ganze Jahr' },
    { icon: Coffee, title: 'Frühstück', desc: 'Reichhaltiges Buffet inklusive' },
    { icon: Bed, title: 'Komfort', desc: 'Premium-Matratzen & hochwertige Ausstattung' }
  ];

  const roomTypes = [
    {
      type: 'Standard',
      price: 80,
      image: 'https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=600',
      features: ['22 m²', 'Einzelbett/Doppelbett', 'Badezimmer mit Dusche', 'WLAN']
    },
    {
      type: 'Deluxe',
      price: 120,
      image: 'https://images.unsplash.com/photo-1618773928121-c32242e63f39?w=600',
      features: ['32 m²', 'Kingsize-Bett', 'Badewanne', 'Balkon', 'Minibar']
    },
    {
      type: 'Suite',
      price: 200,
      image: 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=600',
      features: ['50 m²', 'Separater Wohnbereich', 'Whirlpool', 'Panoramablick']
    }
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* Hero Section */}
      <div 
        className="relative h-[600px] bg-cover bg-center"
        style={{
          backgroundImage: "linear-gradient(rgba(0,0,0,0.4), rgba(0,0,0,0.4)), url('https://images.unsplash.com/photo-1566073771259-6a8506099945?w=1920')"
        }}
      >
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center text-white px-4">
          <h1 className="text-5xl md:text-7xl font-bold font-heading tracking-tight mb-4">
            Grand Hotel
          </h1>
          <p className="text-xl md:text-2xl mb-8 max-w-2xl">
            Erleben Sie Luxus und Komfort im Herzen der Stadt
          </p>
          <div className="flex gap-4">
            <Button
              onClick={() => navigate('/book')}
              data-testid="cta-book-now"
              className="bg-blue-600 hover:bg-blue-700 text-white text-lg px-8 py-6 h-auto"
            >
              Jetzt buchen
              <CaretRight size={24} weight="bold" className="ml-2" />
            </Button>
            <Button
              onClick={() => navigate('/login')}
              variant="outline"
              className="bg-white/10 backdrop-blur-sm border-white text-white hover:bg-white/20 text-lg px-8 py-6 h-auto"
            >
              Mitarbeiter-Login
            </Button>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-zinc-950 font-heading mb-4">
            Ihre Vorteile
          </h2>
          <p className="text-lg text-zinc-600">
            Alles, was Sie für einen perfekten Aufenthalt benötigen
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {features.map((feature, idx) => {
            const Icon = feature.icon;
            return (
              <Card key={idx} className="p-6 text-center hover:shadow-lg transition-shadow">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Icon size={32} weight="fill" className="text-blue-600" />
                </div>
                <h3 className="text-lg font-semibold text-zinc-900 mb-2">{feature.title}</h3>
                <p className="text-sm text-zinc-600">{feature.desc}</p>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Rooms Section */}
      <div className="bg-zinc-50 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-zinc-950 font-heading mb-4">
              Unsere Zimmer
            </h2>
            <p className="text-lg text-zinc-600">
              Wählen Sie aus verschiedenen Kategorien
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {roomTypes.map((room, idx) => (
              <Card key={idx} className="overflow-hidden hover:shadow-xl transition-shadow">
                <div 
                  className="h-48 bg-cover bg-center"
                  style={{ backgroundImage: `url(${room.image})` }}
                />
                <div className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <h3 className="text-2xl font-bold text-zinc-950 font-heading">{room.type}</h3>
                    <div className="text-right">
                      <p className="text-xs text-zinc-500">Ab</p>
                      <p className="text-2xl font-bold text-blue-600">€{room.price}</p>
                      <p className="text-xs text-zinc-500">pro Nacht</p>
                    </div>
                  </div>
                  <ul className="space-y-2 mb-6">
                    {room.features.map((feature, fidx) => (
                      <li key={fidx} className="flex items-center gap-2 text-sm text-zinc-700">
                        <CheckCircle size={16} weight="fill" className="text-emerald-600" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                  <Button
                    onClick={() => navigate('/book')}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    Buchen
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </div>

      {/* Reviews Section */}
      <div className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-zinc-950 font-heading mb-4">
              Was unsere Gäste sagen
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { name: 'Maria S.', rating: 5, text: 'Hervorragendes Hotel! Die Zimmer sind modern und sauber. Das Personal ist sehr freundlich.' },
              { name: 'Thomas M.', rating: 5, text: 'Perfekte Lage und exzellenter Service. Wir haben uns sehr wohlgefühlt.' },
              { name: 'Anna K.', rating: 5, text: 'Das Frühstücksbuffet ist fantastisch. Absolute Empfehlung!' }
            ].map((review, idx) => (
              <Card key={idx} className="p-6">
                <div className="flex gap-1 mb-3">
                  {[...Array(review.rating)].map((_, i) => (
                    <Star key={i} size={20} weight="fill" className="text-amber-400" />
                  ))}
                </div>
                <p className="text-zinc-700 mb-4">„{review.text}“</p>
                <p className="font-semibold text-zinc-900">- {review.name}</p>
              </Card>
            ))}
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="bg-blue-600 text-white py-16">
        <div className="max-w-4xl mx-auto text-center px-4">
          <h2 className="text-4xl font-bold font-heading mb-4">
            Bereit für Ihren Traumurlaub?
          </h2>
          <p className="text-xl mb-8">
            Buchen Sie jetzt online und sichern Sie sich die besten Preise!
          </p>
          <Button
            onClick={() => navigate('/book')}
            data-testid="cta-book-bottom"
            className="bg-white text-blue-600 hover:bg-zinc-100 text-lg px-8 py-6 h-auto"
          >
            Online buchen
            <CaretRight size={24} weight="bold" className="ml-2" />
          </Button>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-zinc-950 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div>
              <h3 className="text-xl font-bold font-heading mb-4">Grand Hotel</h3>
              <p className="text-zinc-400 text-sm">
                Hauptstraße 123<br />
                10115 Berlin<br />
                Deutschland
              </p>
            </div>
            <div>
              <h3 className="text-xl font-bold font-heading mb-4">Kontakt</h3>
              <p className="text-zinc-400 text-sm">
                Tel: +49 30 12345678<br />
                E-Mail: info@grandhotel.com
              </p>
            </div>
            <div>
              <h3 className="text-xl font-bold font-heading mb-4">Links</h3>
              <ul className="space-y-2 text-sm">
                <li><a href="/book" className="text-zinc-400 hover:text-white transition-colors">Online Buchen</a></li>
                <li><a href="/login" className="text-zinc-400 hover:text-white transition-colors">Mitarbeiter-Login</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-zinc-800 mt-8 pt-8 text-center text-zinc-400 text-sm">
            <p>© 2026 Grand Hotel. Alle Rechte vorbehalten.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}