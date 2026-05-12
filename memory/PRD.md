# Villen Manager Pro – Product Requirements Document

## Vision
Luxuriöse SaaS-Plattform für Verwalter & Eigentümer von Villen, Ferienhäusern und Apartments – mit Buchung, Check-In (Ausweis-Scan), Buchhaltung, dynamischer Verfügbarkeit und Monats-Abo.

## Brand
- **Name:** Villen Manager Pro
- **Theme:** Edelschwarz + Metallic-Gold (`#D4AF37` Akzent, `#F1D279` Text)
- **Sprache:** Primär Deutsch; Marketing zusätzlich Englisch
- **Domain (Ziel):** villenmanager.pro / luxusvilla-ferien.de

## User Personas
1. **Eigentümer** (Solo-Vermieter, 1–10 Unterkünfte) → Starter-Tarif
2. **Vermieter-Pro** (10–20 Unterkünfte, Mittelmeer) → Pro-Tarif
3. **Property-Management-Firmen** (>20, Multi-Mitarbeiter) → Business-Tarif

## Core Requirements

### Authentifizierung
- JWT (HttpOnly Cookies), Roles: admin / rezeption / buchhaltung
- Passwort-Reset via Resend (E-Mail) – API-Key vom User benötigt
- Brute-Force-Schutz auf Login

### Immobilien (Properties)
- Kategorien: Villa, Hotel, Ferienhaus, Appartment, Zimmer
- Felder: Name, Kategorie, Adresse, Beschreibung, Standardpreis, Standardkaution, max. Gäste
- Limit je nach Abo-Tarif

### Buchungen
- "Unterkunft"-Dropdown gespeist aus Properties (statt freier Zimmernummer)
- Preis/Nacht + Kaution dynamisch
- PDF-Rechnungs-Generierung via reportlab
- Status: pending / checked_in / checked_out

### Verfügbarkeit
- Spaltennamen "Unterkunft", "Belegte Unterkünfte"
- Aus `db.properties` als Quelle der Wahrheit

### Check-In
- Webcam-basierter Ausweis-Scan (OpenAI Vision via emergentintegrations)
- Großer goldener Auslöser-Button + Kamera-Flip (Front/Rück)

### Buchhaltung
- Einnahmen/Ausgaben
- Service-Checkboxen: Garten, Heckenschneiden, Poolservice, Reinigung, Reparaturen, Wartung
- Eigene Beträge pro Service + Freitext-Add-Feld für „andere verschiedene Arbeiten"
- CSV-Export

### Abo-Modell (Stripe)
- **Starter 29 €/Monat** – bis 10 Unterkünfte
- **Pro 49 €/Monat** – bis 20 Unterkünfte (beliebteste Wahl)
- **Business 99 €/Monat** – unbegrenzt
- **7 Tage gratis ohne Kreditkarte** beim Sign-up
- Zahlung via Stripe Checkout (Karte, SEPA, Apple/Google Pay)
- Verwaltung unter `/subscription`, Übersicht öffentlich unter `/pricing`

### PWA / Mobile
- Service Worker + Manifest
- iOS-Installations-Hinweis (Share → Zum Home-Bildschirm)
- Web-Push-Benachrichtigungen für neue Buchungen (VAPID)

## API Endpoints

### Auth
- POST /api/auth/register | login | logout
- GET /api/auth/me
- POST /api/auth/forgot-password | reset-password

### Properties
- GET/POST/PATCH/DELETE /api/properties
- GET /api/public/properties

### Bookings
- GET/POST/PATCH/DELETE /api/bookings
- POST /api/bookings/{id}/check-in | check-out
- GET /api/bookings/{id}/invoice
- POST /api/public/bookings
- POST /api/scan-id

### Accounting
- GET/POST/PATCH/DELETE /api/accounting (now accepts `services: [{name, amount}]`)
- GET /api/accounting/export

### Subscription
- GET /api/subscription/plans (public)
- GET /api/subscription/me
- POST /api/subscription/checkout
- GET /api/subscription/checkout/status/{session_id}
- POST /api/subscription/cancel
- POST /api/webhook/stripe

### Push / Misc
- POST /api/push/subscribe | unsubscribe | test
- GET /api/availability
- GET /api/stats/dashboard

## DB Collections
- `users` (with `subscription` subdocument)
- `bookings`
- `accounting` (with optional `services` list)
- `properties`
- `payment_transactions` (Stripe sessions)
- `push_subscriptions`
- `password_reset_tokens`
- `login_attempts`

## CHANGELOG

### 2026-02-12 (Latest)
- ✅ **Subscription System** — 3 Tarife (29/49/99 €) + 7-Tage-Trial ohne CC
- ✅ **Stripe Integration** via emergentintegrations (StripeCheckout)
- ✅ **`/pricing`** öffentliche Preisseite
- ✅ **`/subscription`** Abo-Verwaltung für eingeloggte Admins
- ✅ **TrialBanner** mit Countdown auf Dashboard
- ✅ **Property-Limit-Enforcement** beim Anlegen neuer Immobilien
- ✅ **Verfügbarkeit umbenannt** — "Unterkunft" statt "Zimmernummer", aus Properties
- ✅ **Check-In Shutter-Button** — großer goldener Auslöser-Knopf + Kamera-Flip funktionsfähig
- ✅ **Buchhaltung Services** — 6 Preset-Checkboxen (Garten/Hecke/Pool/Reinigung/Reparatur/Wartung) mit individuellem €-Betrag + Custom-Add-Feld
- ✅ **Bookings "Unterkunft" Dropdown** — gespeist aus Properties API mit Auto-Fill von Preis/Kaution
- ✅ **Logo white halo entfernt** via `mix-blend-mode: screen`
- ✅ **MongoClient `tz_aware=True`** Fix für Datetime-Vergleiche
- ✅ **MARKETING.md** — komplettes FB/Insta-Werbepaket (DE+EN, 5 Ads, 5 Bilder, Targeting, Budget)

### 2026-02-11 (vorher)
- Properties-Modul + Page
- PWA mit Service Worker + Manifest
- Web Push (VAPID) für neue Buchungen
- Dark-Mode überall, responsive Hamburger-Menü
- Edelschwarz+Gold Branding

## P0 / Open / Roadmap
- [ ] **Stripe Webhook absichern** — Signature-Verification aktivieren wenn Produktiv-Keys da
- [ ] **Stripe-Subscriptions (recurring) statt Einzelzahlung** — aktuell verlängert jede Zahlung um 30 Tage manuell; ideal wäre `mode='subscription'` mit Stripe Price IDs
- [ ] **Resend API-Key** vom User für Passwort-Reset & Booking-Bestätigungen
- [ ] **iOS-PWA-Push UX** — Anleitungs-Modal verfeinern (Screenshots, Video)
- [ ] **Refactoring** — server.py (≈ 1560 Zeilen) in Router aufteilen (auth/booking/accounting/property/subscription)
- [ ] **Accounting & Bookings Komponenten** in kleinere Dateien zerlegen
- [ ] **DialogDescription** für Accessibility hinzufügen
- [ ] **shadcn Calendar** statt nativer `<input type="date">` auf Availability
- [ ] **ObjectId Try/Except** in PATCH/DELETE Endpoints (vermeidet 500 bei invalid id)
- [ ] **Rate-Limit** auf POST /api/subscription/checkout
- [ ] **Sora 2** für Demo-Reels (Marketing)
- [ ] **/api/scan-id** Error-Klassifizierung (422 vs 502)
- [ ] **/api/accounting/export** echtes CSV (content-type + attachment)
- [ ] **Testimonials & Demo-Video** auf Pricing-Seite

## Marketing
- Komplette Strategie in `/app/MARKETING.md`
- 5 Anzeigen DE+EN
- Targeting Mallorca/Kroatien/Italien
- Budget-Plan 15€ → 100€/Tag in 3 Phasen
- Reel-Ideen für Instagram

## Test Accounts
Siehe `/app/memory/test_credentials.md`:
- Admin: `admin@villenmanager.com` / `admin123` (Business-Plan, lebenslang)
- Rezeption: `rezeption@hotel.com` / `rezeption123`
- Buchhaltung: `buchhaltung@hotel.com` / `buchhaltung123`

## Environment Keys
- `STRIPE_API_KEY=sk_test_emergent` (Emergent Test-Key, in `.env`)
- `EMERGENT_LLM_KEY` (für Vision/ID-Scan)
- `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` (Web Push)
- `RESEND_API_KEY` (Placeholder — User muss eigenen Key einsetzen)
