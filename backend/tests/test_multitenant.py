"""Backend tests for Villen Manager Pro Multi-Tenant features (iteration 3)"""
import os
import time
import uuid
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://hotel-booking-table.preview.emergentagent.com").rstrip("/")

MASTER_ADMIN = {"email": "info@luxusvilla-ferien.de", "password": "admin123"}
REZEPTION = {"email": "rezeption@hotel.com", "password": "rezeption123"}
BUCHHALTUNG = {"email": "buchhaltung@hotel.com", "password": "buchhaltung123"}


def _login(creds):
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    r = s.post(f"{BASE_URL}/api/auth/login", json=creds, timeout=30)
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text}"
    return s


def _signup(company="TEST_Tenant"):
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    uniq = uuid.uuid4().hex[:8]
    email = f"test_{uniq}@example.com"
    payload = {
        "email": email,
        "password": "tenant123",
        "name": "Test Owner",
        "company_name": f"{company}_{uniq}",
    }
    r = s.post(f"{BASE_URL}/api/auth/signup", json=payload, timeout=30)
    assert r.status_code == 200, r.text
    return s, r.json(), payload


# ----------------- AUTH / MASTER ADMIN -----------------
class TestMasterAdmin:
    def test_master_admin_login(self):
        s = _login(MASTER_ADMIN)
        r = s.get(f"{BASE_URL}/api/auth/me", timeout=30)
        assert r.status_code == 200
        d = r.json()
        assert d["email"] == MASTER_ADMIN["email"]
        assert d["role"] == "admin"
        assert d.get("account_id")

    def test_master_admin_subscription_business(self):
        s = _login(MASTER_ADMIN)
        r = s.get(f"{BASE_URL}/api/subscription/me", timeout=30)
        assert r.status_code == 200
        d = r.json()
        assert d["plan"] == "business"
        assert d["status"] == "active"
        assert d["property_limit"] is None  # unlimited


# ----------------- SIGNUP / TENANT CREATION -----------------
class TestSignup:
    def test_signup_creates_account_and_user(self):
        s, data, payload = _signup("TEST_SignupA")
        assert data["email"] == payload["email"]
        assert data["role"] == "admin"
        assert "account_id" in data and data["account_id"]
        assert data["trial_days"] == 7

    def test_signup_login_works(self):
        _, _, payload = _signup("TEST_SignupB")
        # Try login with same credentials in fresh session
        s = requests.Session()
        s.headers.update({"Content-Type": "application/json"})
        r = s.post(f"{BASE_URL}/api/auth/login",
                   json={"email": payload["email"], "password": payload["password"]}, timeout=30)
        assert r.status_code == 200

    def test_signup_duplicate_rejected(self):
        _, _, payload = _signup("TEST_SignupDup")
        s = requests.Session()
        r = s.post(f"{BASE_URL}/api/auth/signup", json={
            "email": payload["email"], "password": "another1", "name": "X", "company_name": "Y"}, timeout=30)
        assert r.status_code == 400

    def test_signup_short_password_rejected(self):
        s = requests.Session()
        r = s.post(f"{BASE_URL}/api/auth/signup", json={
            "email": f"short_{uuid.uuid4().hex[:6]}@example.com",
            "password": "123", "name": "X", "company_name": "Y"}, timeout=30)
        assert r.status_code == 400

    def test_signup_subscription_is_trial(self):
        s, _, _ = _signup("TEST_SignupTrial")
        r = s.get(f"{BASE_URL}/api/subscription/me", timeout=30)
        assert r.status_code == 200
        d = r.json()
        assert d["status"] == "trial"
        assert d["plan"] == "pro"
        assert d["trial_end"] is not None


# ----------------- ACCOUNT ENDPOINTS -----------------
class TestAccount:
    def test_account_me_returns_settings(self):
        s, signup_data, _ = _signup("TEST_AcctMe")
        r = s.get(f"{BASE_URL}/api/account/me", timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        assert "company_name" in d
        assert "settings" in d
        assert isinstance(d["settings"], dict)

    def test_account_settings_patch_persists(self):
        s, _, _ = _signup("TEST_AcctPatch")
        body = {
            "company_name": "TEST_Updated GmbH",
            "address": "Hauptstraße 12",
            "tax_id": "DE123/456/789",
            "vat_id": "DE999888777",
            "iban": "DE89370400440532013000",
            "bank_name": "Sparkasse Test",
        }
        r = s.patch(f"{BASE_URL}/api/account/settings", json=body, timeout=30)
        assert r.status_code == 200, r.text
        # verify persistence
        r2 = s.get(f"{BASE_URL}/api/account/me", timeout=30)
        d = r2.json()
        assert d["company_name"] == "TEST_Updated GmbH"
        s_set = d["settings"]
        assert s_set.get("tax_id") == "DE123/456/789"
        assert s_set.get("iban") == "DE89370400440532013000"
        assert s_set.get("bank_name") == "Sparkasse Test"

    def test_account_settings_non_admin_forbidden(self):
        s = _login(REZEPTION)
        r = s.patch(f"{BASE_URL}/api/account/settings", json={"company_name": "Hack"}, timeout=30)
        assert r.status_code == 403, r.text

    def test_account_settings_buchhaltung_forbidden(self):
        s = _login(BUCHHALTUNG)
        r = s.patch(f"{BASE_URL}/api/account/settings", json={"company_name": "Hack"}, timeout=30)
        assert r.status_code == 403, r.text


# ----------------- TENANT ISOLATION -----------------
class TestTenantIsolation:
    def test_properties_isolated_between_tenants(self):
        s_a, _, _ = _signup("TEST_IsoA")
        s_b, _, _ = _signup("TEST_IsoB")

        # Tenant A: empty initially
        r = s_a.get(f"{BASE_URL}/api/properties", timeout=30)
        assert r.status_code == 200
        assert r.json() == []

        # Tenant A creates a property
        r = s_a.post(f"{BASE_URL}/api/properties", json={
            "name": "TEST_Iso_Villa_A", "category": "Villa", "max_guests": 4}, timeout=30)
        assert r.status_code == 200, r.text

        # Tenant A sees 1
        r = s_a.get(f"{BASE_URL}/api/properties", timeout=30)
        assert len(r.json()) == 1
        assert r.json()[0]["name"] == "TEST_Iso_Villa_A"

        # Tenant B sees 0
        r = s_b.get(f"{BASE_URL}/api/properties", timeout=30)
        assert r.status_code == 200
        names = [p["name"] for p in r.json()]
        assert "TEST_Iso_Villa_A" not in names
        assert r.json() == []

    def test_bookings_isolated_between_tenants(self):
        s_a, _, _ = _signup("TEST_IsoBkA")
        s_b, _, _ = _signup("TEST_IsoBkB")

        booking = {
            "guest_name": "TEST_IsoGuest", "email": "iso@example.com", "phone": "+49000",
            "room_number": "T1", "room_type": "Villa",
            "check_in_date": "2026-03-01", "check_out_date": "2026-03-03",
            "price": 100.0, "guests_count": 1
        }
        r = s_a.post(f"{BASE_URL}/api/bookings", json=booking, timeout=30)
        assert r.status_code == 200, r.text
        a_id = r.json()["_id"]

        # A sees it
        r = s_a.get(f"{BASE_URL}/api/bookings", timeout=30)
        assert any(b["_id"] == a_id for b in r.json())

        # B does not
        r = s_b.get(f"{BASE_URL}/api/bookings", timeout=30)
        ids = [b["_id"] for b in r.json()]
        assert a_id not in ids

        # B cannot fetch by id
        r = s_b.get(f"{BASE_URL}/api/bookings/{a_id}", timeout=30)
        assert r.status_code == 404

    def test_dashboard_stats_isolated(self):
        s_new, _, _ = _signup("TEST_IsoStats")
        r = s_new.get(f"{BASE_URL}/api/stats/dashboard", timeout=30)
        assert r.status_code == 200
        d = r.json()
        # Fresh tenant should have 0 bookings
        assert d["total_bookings"] == 0
        assert d["pending"] == 0
        assert d["total_income"] == 0


# ----------------- OPTIONAL PRICE/DEPOSIT -----------------
class TestOptionalPrice:
    def test_create_booking_without_price(self):
        s, _, _ = _signup("TEST_NoPrice")
        booking = {
            "guest_name": "TEST_NoPriceGuest", "email": "np@example.com", "phone": "+49",
            "room_number": "X1", "room_type": "Zimmer",
            "check_in_date": "2026-04-01", "check_out_date": "2026-04-02",
            "price_note": "auf Anfrage", "deposit_note": "nach Absprache",
            "guests_count": 1
        }
        r = s.post(f"{BASE_URL}/api/bookings", json=booking, timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d.get("price") is None
        assert d.get("price_note") == "auf Anfrage"
        assert d.get("deposit_note") == "nach Absprache"


# ----------------- UPCOMING CHECK-INS -----------------
class TestUpcomingCheckins:
    def test_upcoming_endpoint_exists_and_sorted(self):
        s, _, _ = _signup("TEST_Upcoming")
        # Create 3 pending bookings with descending dates
        dates = ["2026-12-01", "2026-06-01", "2026-08-01"]
        for d in dates:
            r = s.post(f"{BASE_URL}/api/bookings", json={
                "guest_name": f"TEST_UP_{d}", "email": "u@example.com", "phone": "+49",
                "room_number": "U1", "room_type": "Villa",
                "check_in_date": d, "check_out_date": "2026-12-31",
                "price": 100.0, "guests_count": 1}, timeout=30)
            assert r.status_code == 200, r.text
        r = s.get(f"{BASE_URL}/api/dashboard/upcoming-checkins", timeout=30)
        assert r.status_code == 200, r.text
        items = r.json()
        assert isinstance(items, list)
        assert len(items) >= 3
        # Verify ascending order
        in_dates = [it["check_in_date"] for it in items[:3]]
        assert in_dates == sorted(in_dates)
        # Verify all are pending
        assert all(it.get("status") == "pending" for it in items)


# ----------------- PDF INVOICE WITH BRANDING -----------------
class TestInvoicePdf:
    def test_invoice_pdf_generated(self):
        s, _, _ = _signup("TEST_Invoice")
        # Set branding
        s.patch(f"{BASE_URL}/api/account/settings", json={
            "tax_id": "DE111", "iban": "DE89000", "bank_name": "TestBank"}, timeout=30)
        # Create booking
        r = s.post(f"{BASE_URL}/api/bookings", json={
            "guest_name": "TEST_InvGuest", "email": "i@example.com", "phone": "+49",
            "room_number": "INV1", "room_type": "Villa",
            "check_in_date": "2026-05-01", "check_out_date": "2026-05-05",
            "price": 500.0, "deposit": 100.0, "guests_count": 1}, timeout=30)
        bid = r.json()["_id"]
        r = s.get(f"{BASE_URL}/api/bookings/{bid}/invoice", timeout=30)
        assert r.status_code == 200, r.text
        assert r.headers.get("content-type", "").startswith("application/pdf")
        assert len(r.content) > 500  # non-empty PDF

    def test_invoice_with_null_price_uses_note(self):
        s, _, _ = _signup("TEST_InvNull")
        r = s.post(f"{BASE_URL}/api/bookings", json={
            "guest_name": "TEST_NoPriceInv", "email": "n@example.com", "phone": "+49",
            "room_number": "NP1", "room_type": "Zimmer",
            "check_in_date": "2026-05-10", "check_out_date": "2026-05-11",
            "price_note": "auf Anfrage", "guests_count": 1}, timeout=30)
        bid = r.json()["_id"]
        r = s.get(f"{BASE_URL}/api/bookings/{bid}/invoice", timeout=30)
        assert r.status_code == 200


# ----------------- PROPERTY LIMIT (master = unlimited) -----------------
class TestPropertyLimits:
    def test_master_admin_unlimited(self):
        s = _login(MASTER_ADMIN)
        # Get count
        r = s.get(f"{BASE_URL}/api/subscription/me", timeout=30)
        assert r.json()["property_limit"] is None
        # Create several properties (should not be blocked)
        created = []
        for i in range(3):
            r = s.post(f"{BASE_URL}/api/properties", json={
                "name": f"TEST_UNL_{uuid.uuid4().hex[:6]}", "category": "Villa"}, timeout=30)
            assert r.status_code == 200, r.text
            created.append(r.json()["_id"])
        # cleanup
        for cid in created:
            s.delete(f"{BASE_URL}/api/properties/{cid}", timeout=30)
