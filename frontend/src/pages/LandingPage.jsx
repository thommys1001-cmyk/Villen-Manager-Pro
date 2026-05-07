import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { 
  Buildings,
  House,
  Key,
  Bed,
  CaretRight,
  CheckCircle,
  Star,
  Phone,
  EnvelopeSimple,
  WhatsappLogo
} from '@phosphor-icons/react';

export default function LandingPage() {
  const navigate = useNavigate();

  const categories = [
    {
      icon: Buildings,
      title: 'Villen',
      price: 500,
      description: 'Luxuriöse Villen mit privatem Pool & Garten',
      image: 'https://images.unsplash.com/photo-1613977257363-707ba9348227?w=800'
    },
    {
      icon: House,
      title: 'Ferienhäuser',
      price: 250,
      description: 'Gemütliche Ferienhäuser für die ganze Familie',
      image: 'https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=800'
    },
    {
      icon: Key,
      title: 'Appartments',
      price: 120,
      description: 'Moderne Appartments in bester Lage',
      image: 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800'
    },
    {
      icon: Bed,
      title: 'Zimmer',
      price: 80,
      description: 'Komfortable Zimmer mit Premium-Ausstattung',
      image: 'https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=800'
    }
  ];

  return (
    <div className="min-h-screen bg-zinc-950 text-gold-400">
      {/* Hero Section */}
      <div 
        className="relative h-[700px] bg-cover bg-center bg-fixed"
        style={{
          backgroundImage: "linear-gradient(rgba(10,10,10,0.7), rgba(10,10,10,0.85)), url('https://customer-assets.emergentagent.com/wingman/359d1d25-501d-49ee-acdc-7ddd114c4b2b/attachments/8dba1e69afd1420499fa76f1c7e5ee55_pical-resort-infinity-pool-by-sea-airview.jpg')"
        }}
      >
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-4">
          <img 
            src="https://customer-assets.emergentagent.com/wingman/359d1d25-501d-49ee-acdc-7ddd114c4b2b/attachments/abc94a5694cb4db0a3fad6a16ce20ec7_icon (1).png" 
            alt="Villen Manager Pro"
            className="w-32 h-32 md:w-48 md:h-48 object-contain mb-6"
          />
          <h1 className="text-5xl md:text-7xl font-bold font-heading tracking-wider mb-2 text-gold-500">
            VILLEN MANAGER
          </h1>
          <p className="text-2xl md:text-3xl tracking-[0.3em] uppercase mb-6 text-gold-600">PRO</p>
          <p className="text-lg md:text-xl mb-10 max-w-2xl text-gold-300/90">
            Exklusive Immobilienverwaltung für Villen, Ferienhäuser, Appartments & Zimmer
          </p>
          <div className="flex flex-col sm:flex-row gap-4">
            <Button
              onClick={() => navigate('/book')}
              data-testid="cta-book-now"
              className="bg-gradient-to-r from-gold-500 to-gold-600 hover:from-gold-400 hover:to-gold-500 text-gold-400 text-lg px-8 py-6 h-auto font-bold shadow-xl shadow-gold-500/30"
            >
              Jetzt buchen
              <CaretRight size={24} weight="bold" className="ml-2" />
            </Button>
            <Button
              onClick={() => navigate('/login')}
              variant="outline"
              className="bg-transparent border-2 border-gold-500 text-gold-500 hover:bg-gold-500 hover:text-gold-400 text-lg px-8 py-6 h-auto font-semibold"
            >
              Mitarbeiter-Login
            </Button>
          </div>
        </div>
      </div>

      {/* Categories Section */}
      <div className="py-20 bg-zinc-950">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <p className="text-gold-600 text-sm tracking-[0.3em] uppercase mb-3">Unser Portfolio</p>
            <h2 className="text-4xl md:text-5xl font-bold text-gold-500 font-heading mb-4">
              Exklusive Kategorien
            </h2>
            <p className="text-lg text-gold-400/80 max-w-2xl mx-auto">
              Entdecken Sie unsere sorgfältig ausgewählten Immobilien
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {categories.map((cat) => {
              const Icon = cat.icon;
              return (
                <Card 
                  key={cat.title}
                  className="overflow-hidden bg-zinc-900 border-gold-900/30 hover:border-gold-500/50 transition-all duration-300 hover:shadow-xl hover:shadow-gold-500/20 group cursor-pointer"
                  onClick={() => navigate('/book')}
                >
                  <div 
                    className="h-48 bg-cover bg-center relative"
                    style={{ backgroundImage: `url(${cat.image})` }}
                  >
                    <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 to-transparent"></div>
                    <div className="absolute top-4 left-4 w-12 h-12 bg-gold-500 rounded-full flex items-center justify-center">
                      <Icon size={28} weight="fill" className="text-gold-400" />
                    </div>
                  </div>
                  <div className="p-6">
                    <h3 className="text-2xl font-bold text-gold-500 font-heading mb-2">{cat.title}</h3>
                    <p className="text-sm text-gold-400/80 mb-4 min-h-[40px]">{cat.description}</p>
                    <div className="flex items-end justify-between">
                      <div>
                        <p className="text-xs text-gold-700 uppercase tracking-wider">Ab</p>
                        <p className="text-3xl font-bold text-gold-500 font-heading">€{cat.price}</p>
                        <p className="text-xs text-gold-700">pro Nacht</p>
                      </div>
                      <CaretRight size={24} className="text-gold-500 group-hover:translate-x-2 transition-transform" />
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      </div>

      {/* Reviews Section */}
      <div className="py-20 bg-gradient-to-b from-zinc-950 to-black">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <p className="text-gold-600 text-sm tracking-[0.3em] uppercase mb-3">Kundenfeedback</p>
            <h2 className="text-4xl md:text-5xl font-bold text-gold-500 font-heading">
              Was unsere Gäste sagen
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { name: 'Maria S.', rating: 5, text: 'Die Villa war absolut traumhaft! Privater Pool, wunderschöner Garten - ein echtes Luxuserlebnis.' },
              { name: 'Thomas M.', rating: 5, text: 'Perfekt organisiertes Ferienhaus für unsere Familie. Alles war bestens vorbereitet!' },
              { name: 'Anna K.', rating: 5, text: 'Wunderbares Appartment in zentraler Lage. Modernste Ausstattung und exzellenter Service.' }
            ].map((review) => (
              <Card key={review.name} className="p-8 bg-zinc-900 border-gold-900/30 hover:border-gold-500/50 transition-colors">
                <div className="flex gap-1 mb-4">
                  {[...Array(review.rating)].map((_, i) => (
                    <Star key={`${review.name}-${i}`} size={20} weight="fill" className="text-gold-500" />
                  ))}
                </div>
                <p className="text-gold-300/90 mb-4 italic">„{review.text}"</p>
                <p className="font-semibold text-gold-500">— {review.name}</p>
              </Card>
            ))}
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="py-20 bg-gradient-to-r from-gold-600 via-gold-500 to-gold-600">
        <div className="max-w-4xl mx-auto text-center px-4">
          <h2 className="text-4xl md:text-5xl font-bold font-heading text-gold-400 mb-4">
            Bereit für Ihren Traumurlaub?
          </h2>
          <p className="text-xl text-zinc-800 mb-8">
            Buchen Sie jetzt online und genießen Sie exklusiven Luxus!
          </p>
          <Button
            onClick={() => navigate('/book')}
            data-testid="cta-book-bottom"
            className="bg-zinc-950 text-gold-500 hover:bg-zinc-900 text-lg px-8 py-6 h-auto font-bold shadow-xl"
          >
            Jetzt online buchen
            <CaretRight size={24} weight="bold" className="ml-2" />
          </Button>
        </div>
      </div>

      {/* Contact Section */}
      <div className="py-16 bg-zinc-950">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-gold-500 font-heading mb-2">Kontaktieren Sie uns</h2>
            <p className="text-gold-700">Wir sind jederzeit für Sie da</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="p-6 bg-zinc-900 border-gold-900/30 text-center hover:border-gold-500 transition-colors">
              <div className="w-14 h-14 bg-gold-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <EnvelopeSimple size={28} weight="fill" className="text-gold-400" />
              </div>
              <h3 className="text-lg font-bold text-gold-500 mb-2">E-Mail</h3>
              <a href="mailto:info@luxusvilla-ferien.de" className="text-gold-400 hover:text-gold-300 transition-colors">
                info@luxusvilla-ferien.de
              </a>
            </Card>

            <Card className="p-6 bg-zinc-900 border-gold-900/30 text-center hover:border-gold-500 transition-colors">
              <div className="w-14 h-14 bg-gold-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <WhatsappLogo size={28} weight="fill" className="text-gold-400" />
              </div>
              <h3 className="text-lg font-bold text-gold-500 mb-2">WhatsApp</h3>
              <a href="https://wa.me/4915227072018" target="_blank" rel="noopener noreferrer" className="text-gold-400 hover:text-gold-300 transition-colors">
                +49 1522 7072 018
              </a>
            </Card>

            <Card className="p-6 bg-zinc-900 border-gold-900/30 text-center hover:border-gold-500 transition-colors">
              <div className="w-14 h-14 bg-gold-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <Phone size={28} weight="fill" className="text-gold-400" />
              </div>
              <h3 className="text-lg font-bold text-gold-500 mb-2">Website</h3>
              <a href="https://www.luxusvilla-ferien.de" target="_blank" rel="noopener noreferrer" className="text-gold-400 hover:text-gold-300 transition-colors">
                www.luxusvilla-ferien.de
              </a>
            </Card>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-black text-gold-400 py-12 border-t border-gold-900/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <img 
                  src="https://customer-assets.emergentagent.com/wingman/359d1d25-501d-49ee-acdc-7ddd114c4b2b/attachments/abc94a5694cb4db0a3fad6a16ce20ec7_icon (1).png" 
                  alt="Logo"
                  className="w-12 h-12 object-contain"
                />
                <div>
                  <h3 className="text-lg font-bold font-heading text-gold-500">VILLEN MANAGER</h3>
                  <p className="text-xs text-gold-600 tracking-[0.2em]">PRO</p>
                </div>
              </div>
              <p className="text-gold-400/70 text-sm">
                Ihre erste Adresse für exklusive Immobilienverwaltung in Deutschland.
              </p>
            </div>
            <div>
              <h3 className="text-lg font-bold text-gold-500 mb-4 font-heading">Kontakt</h3>
              <ul className="space-y-2 text-sm">
                <li className="text-gold-400/70">Website: www.luxusvilla-ferien.de</li>
                <li className="text-gold-400/70">E-Mail: info@luxusvilla-ferien.de</li>
                <li className="text-gold-400/70">WhatsApp: +49 1522 7072 018</li>
              </ul>
            </div>
            <div>
              <h3 className="text-lg font-bold text-gold-500 mb-4 font-heading">Schnelle Links</h3>
              <ul className="space-y-2 text-sm">
                <li><a href="/book" className="text-gold-400/70 hover:text-gold-500 transition-colors">Online Buchen</a></li>
                <li><a href="/login" className="text-gold-400/70 hover:text-gold-500 transition-colors">Mitarbeiter-Login</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gold-900/30 pt-8 text-center text-gold-600 text-sm">
            <p>© 2026 Villen Manager Pro. Alle Rechte vorbehalten.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
