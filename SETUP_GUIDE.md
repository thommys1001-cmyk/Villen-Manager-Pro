# Setup Guide - E-Mail & WhatsApp Integration

## 1. Resend API Key Setup (E-Mail-Benachrichtigungen)

### Schritt 1: Resend Account erstellen
1. Gehen Sie zu: https://resend.com
2. Klicken Sie auf "Sign Up" (kostenlos)
3. Bestätigen Sie Ihre E-Mail-Adresse

### Schritt 2: API Key generieren
1. Nach dem Login: Dashboard → API Keys
2. Klicken Sie auf "Create API Key"
3. Name: `Hotel Management System`
4. Kopieren Sie den generierten Key (beginnt mit `re_...`)

### Schritt 3: API Key in die App einfügen
1. Öffnen Sie die Datei: `/app/backend/.env`
2. Ersetzen Sie diese Zeile:
   ```
   RESEND_API_KEY="re_placeholder_get_your_key_from_resend_com"
   ```
   Mit:
   ```
   RESEND_API_KEY="re_IHR_ECHTER_KEY_HIER"
   ```

### Schritt 4: Eigene E-Mail-Adresse verifizieren (Optional)
1. Resend Dashboard → Domains
2. Fügen Sie Ihre Domain hinzu (z.B. `grandhotel.com`)
3. Folgen Sie den DNS-Anweisungen
4. Ändern Sie in `/app/backend/.env`:
   ```
   SENDER_EMAIL="buchungen@grandhotel.com"
   ```

**Hinweis:** Ohne Domain-Verifizierung können Sie nur an verifizierte E-Mail-Adressen senden. Mit verifizierter Domain können Sie an alle E-Mails senden.

### Schritt 5: Backend neu starten
```bash
sudo supervisorctl restart backend
```

### Fertig! 🎉
Jetzt werden automatisch E-Mails bei jeder Buchung versendet.

---

## 2. WhatsApp Business API Setup

### Option A: Twilio WhatsApp (Empfohlen - Einfacher)

#### Schritt 1: Twilio Account erstellen
1. Gehen Sie zu: https://www.twilio.com/try-twilio
2. Registrieren Sie sich (kostenloser Trial verfügbar)
3. Verifizieren Sie Ihre Telefonnummer

#### Schritt 2: WhatsApp Sender aktivieren
1. Twilio Console → Messaging → Try it out → Send a WhatsApp message
2. Folgen Sie der Anleitung zum Aktivieren des WhatsApp Sandbox
3. Notieren Sie Ihre **WhatsApp Sandbox-Nummer** (z.B. `+1 415 523 8886`)

#### Schritt 3: API Credentials holen
1. Twilio Console → Account → API keys & tokens
2. Kopieren Sie:
   - **Account SID** (beginnt mit `AC...`)
   - **Auth Token**

#### Schritt 4: In die App integrieren
```bash
# Backend Dependencies installieren
cd /app/backend
pip install twilio
pip freeze > requirements.txt
```

Fügen Sie zu `/app/backend/.env` hinzu:
```
TWILIO_ACCOUNT_SID="AC..."
TWILIO_AUTH_TOKEN="..."
TWILIO_WHATSAPP_NUMBER="whatsapp:+14155238886"
```

#### Schritt 5: Code im Backend hinzufügen
Die WhatsApp-Funktion ist bereits vorbereitet. Sie müssen nur die Twilio-Library installieren und die Credentials einfügen.

---

### Option B: WhatsApp Business API (Offiziell - Komplex)

**Anforderungen:**
- Verifiziertes Unternehmen
- Facebook Business Manager Account
- Mindestens 1-2 Wochen für Genehmigung

**Schritte:**
1. Meta Business Suite: https://business.facebook.com
2. Erstellen Sie ein Business Manager Konto
3. WhatsApp Business API beantragen
4. Warten Sie auf Genehmigung (1-14 Tage)
5. Folgen Sie den Meta-Dokumentationen für die Integration

**Hinweis:** Dies ist deutlich komplexer als Twilio WhatsApp und nur für größere Hotels empfohlen.

---

## 3. Marketing Landing Page

Die Marketing Landing Page ist bereits implementiert unter:
**URL:** `/` (Hauptseite)

Sie können die Hotel-Details anpassen in:
- `/app/backend/.env`:
  ```
  HOTEL_NAME="Ihr Hotel Name"
  HOTEL_ADDRESS="Ihre Adresse"
  HOTEL_PHONE="+49 ..."
  HOTEL_EMAIL="info@ihr-hotel.com"
  ```

---

## 4. Testing

### E-Mail testen:
```bash
# Testbuchung erstellen (E-Mail wird automatisch gesendet)
curl -X POST "https://hotel-booking-table.preview.emergentagent.com/api/public/bookings" \
  -H "Content-Type: application/json" \
  -d '{
    "guest_name": "Test User",
    "email": "ihre-test-email@gmail.com",
    "phone": "+49 123 456789",
    "room_type": "Standard",
    "check_in_date": "2026-06-10",
    "check_out_date": "2026-06-12",
    "guests_count": 2
  }'
```

### WhatsApp testen (nach Twilio Setup):
1. Senden Sie `join [sandbox-keyword]` an die Twilio WhatsApp Nummer
2. Sie erhalten eine Bestätigung
3. Erstellen Sie eine Testbuchung
4. Sie erhalten eine WhatsApp-Nachricht

---

## Häufige Probleme

### Problem: E-Mails kommen nicht an
**Lösung:**
1. Prüfen Sie Spam-Ordner
2. Stellen Sie sicher, dass `RESEND_API_KEY` korrekt ist
3. Prüfen Sie Backend-Logs: `tail -f /var/log/supervisor/backend.err.log`

### Problem: WhatsApp funktioniert nicht
**Lösung:**
1. Stellen Sie sicher, dass Twilio Credentials korrekt sind
2. Haben Sie den WhatsApp Sandbox mit `join [keyword]` aktiviert?
3. Prüfen Sie Twilio Console für Fehler

---

## Support

Bei Fragen:
- Resend Docs: https://resend.com/docs
- Twilio WhatsApp Docs: https://www.twilio.com/docs/whatsapp
- Meta WhatsApp Business: https://developers.facebook.com/docs/whatsapp
