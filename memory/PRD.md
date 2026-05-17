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

### 2026-02-13 (Latest – Multi-Tenant)
- ✅ **MULTI-TENANT ARCHITECTURE** — `accounts` collection introduced. Properties, Bookings, Accounting, Push Subscriptions, Payment Transactions all scoped per `account_id`.
- ✅ **Self-Service Signup** — `POST /api/auth/signup` + new `/signup` page. Creates new tenant + owner user + 7-day trial automatically.
- ✅ **Account Settings** — `/settings` page (admin-only) with Firmendaten, Adresse, Steuer (Steuernummer/USt-IdNr), Bankverbindung (IBAN/BIC/Bank), Branding (Logo-URL).
- ✅ **Master Admin auf `info@luxusvilla-ferien.de`** umgezogen (Business-Tarif, unbegrenzt, 10 Jahre Laufzeit). Altes `admin@villenmanager.com` entfernt.
- ✅ **PDF-Rechnung mit Branding** — Logo, Firmenadresse, Steuernummer, USt-IdNr., Bankverbindung werden aus Account-Settings gezogen.
- ✅ **Optionale Preis-/Kaution-Felder** in Buchungen + zusätzliche `price_note` / `deposit_note` Freitextfelder.
- ✅ **Dashboard Quick-View "Nächste Check-Ins"** — sortiert nach Datum aufsteigend, max. 10 anstehende Buchungen.
- ✅ **Subscription auf Account-Level** verschoben (war vorher User-Level).
- ✅ **AuthContext.signup()** Helper für post-signup Redirect-Bug-Fix.
- ✅ **MongoClient `tz_aware=True`** (bereits aus Iteration 2).

### 2026-02-12 (Subscription System)
- ✅ Stripe Integration via emergentintegrations (StripeCheckout)
- ✅ Pricing-Page öffentlich unter `/pricing`
- ✅ Subscription Management unter `/subscription`
- ✅ TrialBanner mit Countdown
- ✅ Property-Limit-Enforcement
- ✅ Verfügbarkeit "Unterkunft" statt "Zimmernummer"
- ✅ Check-In Shutter-Button + Kamera-Flip
- ✅ Buchhaltung Service-Checkboxen
- ✅ Bookings Unterkunft-Dropdown
- ✅ Logo white halo entfernt
- ✅ MARKETING.md erstellt

### 2026-02-11 (vorher)
- Properties-Modul + Page
- PWA mit Service Worker + Manifest
- Web Push (VAPID) für neue Buchungen
- Dark-Mode überall, responsive Hamburger-Menü
- Edelschwarz+Gold Branding

## P0 / Open / Roadmap (von User-Liste sortiert)

### Phase 3 – Nächste Schritte (P0)
- [ ] **Kontaktmanagement (CRM)** — Eigene Kontakte-Collection mit Profil-Übersicht. Beim Check-In hochgeladener Ausweis-Scan automatisch im Kontakt-Profil speichern (PDF/Bild).
- [ ] **Buchhaltung Druck/PDF** — PDF-Export-Button mit Tabellen-Layout (Einnahmen/Ausgaben, Summe, Datum-Filter).
- [ ] **Kontaktdaten Export** — Drucken (Print-Layout), Per E-Mail senden (`mailto:`), Per WhatsApp (`wa.me/`).
- [ ] **Rechnungs-Branding mit Logo-Upload** — Echtes File-Upload-Endpoint (`POST /api/account/logo`) statt URL-Feld. Optional: Briefpapier-PDF als Hintergrund.

### Phase 4 – Kalender & UX (P1)
- [ ] **Gantt/Timeline-Kalender** — Zusätzliche tabellarische Balken-Ansicht mit horizontalen Booking-Balken.
- [ ] **Color Picker** für Buchungsbalken — User wählt Farbe pro Buchung oder pro Kategorie.

### Phase 5 – Onboarding & Auth (P1)
- [ ] **OTP / Einmal-Passwort** beim Sign-up nach Stripe-Zahlung — temporäres Passwort per E-Mail, muss beim ersten Login geändert werden (braucht Resend API-Key).
- [ ] **Resend API-Key** vom User für Passwort-Reset & Buchungs-Bestätigungen.
- [ ] **Mitarbeiter einladen** pro Account (Admin/Rezeption/Buchhaltung) — Stripe-Tier-abhängiges Limit.

### Phase 6 – Stripe & Recurring (P1)
- [ ] **Echte Stripe-Live-Keys** für Echtgeld-Zahlungen (User braucht Stripe-Account mit hinterlegter IBAN).
- [ ] **Stripe Webhook-Signature** aktivieren bei Live.
- [ ] **Stripe Subscriptions (recurring)** mit Price IDs statt monatliche Einzelzahlung.
- [ ] **Stripe Customer Portal** für Self-Service (Karten-Update, Abo-Wechsel, Rechnungs-Historie).

### Phase 7 – Refactoring (P2)
- [ ] **server.py refactoring** (≈ 1900 Zeilen) in Router-Module (auth, bookings, properties, accounting, subscription, account).
- [ ] **Bookings.jsx / Accounting.jsx** in kleinere Komponenten zerlegen.
- [ ] **shadcn Calendar** statt nativer `<input type="date">` für Konsistenz.
- [ ] **/api/accounting/export** echtes CSV (Content-Type text/csv).
- [ ] **/api/scan-id** Error-Klassifizierung (422 vs 502).
- [ ] **Sora 2** für Demo-Reels (Marketing).

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
