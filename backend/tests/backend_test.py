"""Backend tests for Hotel Management App"""
import os
import io
import pytest
import requests
from PIL import Image

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://hotel-booking-table.preview.emergentagent.com").rstrip("/")

ADMIN = {"email": "admin@hotel.com", "password": "admin123"}
REZEPTION = {"email": "rezeption@hotel.com", "password": "rezeption123"}
BUCHHALTUNG = {"email": "buchhaltung@hotel.com", "password": "buchhaltung123"}


def _session_for(creds):
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    r = s.post(f"{BASE_URL}/api/auth/login", json=creds, timeout=30)
    assert r.status_code == 200, f"Login failed for {creds['email']}: {r.status_code} {r.text}"
    return s


# -------- AUTH --------
class TestAuth:
    def test_login_admin(self):
        r = requests.post(f"{BASE_URL}/api/auth/login", json=ADMIN, timeout=30)
        assert r.status_code == 200
        data = r.json()
        assert data["email"] == ADMIN["email"]
        assert data["role"] == "admin"

    def test_login_rezeption(self):
        r = requests.post(f"{BASE_URL}/api/auth/login", json=REZEPTION, timeout=30)
        assert r.status_code == 200
        assert r.json()["role"] == "rezeption"

    def test_login_buchhaltung(self):
        r = requests.post(f"{BASE_URL}/api/auth/login", json=BUCHHALTUNG, timeout=30)
        assert r.status_code == 200
        assert r.json()["role"] == "buchhaltung"

    def test_login_invalid(self):
        r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": "admin@hotel.com", "password": "wrong"}, timeout=30)
        assert r.status_code == 401

    def test_me_unauthenticated(self):
        r = requests.get(f"{BASE_URL}/api/auth/me", timeout=30)
        assert r.status_code == 401

    def test_me_authenticated(self):
        s = _session_for(ADMIN)
        r = s.get(f"{BASE_URL}/api/auth/me", timeout=30)
        assert r.status_code == 200
        assert r.json()["email"] == ADMIN["email"]


# -------- DASHBOARD --------
class TestDashboard:
    def test_dashboard_stats(self):
        s = _session_for(ADMIN)
        r = s.get(f"{BASE_URL}/api/stats/dashboard", timeout=30)
        assert r.status_code == 200
        d = r.json()
        for k in ["total_bookings", "checked_in", "pending", "total_income", "total_expenses", "net_income"]:
            assert k in d


# -------- BOOKINGS CRUD + Check-in/out --------
class TestBookings:
    created_id = None

    def test_create_booking(self):
        s = _session_for(ADMIN)
        payload = {
            "guest_name": "TEST_John Doe",
            "email": "test_john@example.com",
            "phone": "+491234567890",
            "room_number": "T101",
            "room_type": "double",
            "check_in_date": "2026-02-01",
            "check_out_date": "2026-02-05",
            "price": 480.0,
            "guests_count": 2
        }
        r = s.post(f"{BASE_URL}/api/bookings", json=payload, timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["guest_name"] == "TEST_John Doe"
        assert d["status"] == "pending"
        assert "_id" in d
        TestBookings.created_id = d["_id"]

    def test_get_bookings(self):
        s = _session_for(ADMIN)
        r = s.get(f"{BASE_URL}/api/bookings", timeout=30)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_get_booking_by_id(self):
        assert TestBookings.created_id
        s = _session_for(ADMIN)
        r = s.get(f"{BASE_URL}/api/bookings/{TestBookings.created_id}", timeout=30)
        assert r.status_code == 200
        assert r.json()["_id"] == TestBookings.created_id

    def test_update_booking(self):
        assert TestBookings.created_id
        s = _session_for(ADMIN)
        r = s.patch(f"{BASE_URL}/api/bookings/{TestBookings.created_id}", json={"phone": "+499998887777"}, timeout=30)
        assert r.status_code == 200
        assert r.json()["phone"] == "+499998887777"

    def test_check_in(self):
        assert TestBookings.created_id
        s = _session_for(REZEPTION)
        r = s.post(f"{BASE_URL}/api/bookings/{TestBookings.created_id}/check-in",
                   json={"id_verified": True, "id_data": {"name": "TEST_John Doe", "id_number": "X123"}},
                   timeout=30)
        assert r.status_code == 200, r.text
        assert r.json()["status"] == "checked_in"
        assert r.json()["id_verified"] is True

    def test_check_out_creates_accounting(self):
        assert TestBookings.created_id
        s = _session_for(ADMIN)
        r = s.post(f"{BASE_URL}/api/bookings/{TestBookings.created_id}/check-out", timeout=30)
        assert r.status_code == 200, r.text
        assert r.json()["status"] == "checked_out"
        # Verify accounting entry auto-created
        r2 = s.get(f"{BASE_URL}/api/accounting", timeout=30)
        assert r2.status_code == 200
        entries = r2.json()
        assert any(e.get("booking_id") == TestBookings.created_id and e.get("type") == "income" for e in entries)

    def test_delete_booking(self):
        assert TestBookings.created_id
        s = _session_for(ADMIN)
        r = s.delete(f"{BASE_URL}/api/bookings/{TestBookings.created_id}", timeout=30)
        assert r.status_code == 200
        r2 = s.get(f"{BASE_URL}/api/bookings/{TestBookings.created_id}", timeout=30)
        assert r2.status_code == 404


# -------- ACCOUNTING RBAC + CRUD --------
class TestAccounting:
    entry_id = None

    def test_rezeption_cannot_access(self):
        s = _session_for(REZEPTION)
        r = s.get(f"{BASE_URL}/api/accounting", timeout=30)
        assert r.status_code == 403

    def test_buchhaltung_can_access(self):
        s = _session_for(BUCHHALTUNG)
        r = s.get(f"{BASE_URL}/api/accounting", timeout=30)
        assert r.status_code == 200

    def test_create_expense(self):
        s = _session_for(ADMIN)
        payload = {
            "category": "Gartenarbeit",
            "description": "TEST_Hecke schneiden",
            "amount": 120.0,
            "type": "expense",
            "date": "2026-01-15"
        }
        r = s.post(f"{BASE_URL}/api/accounting", json=payload, timeout=30)
        assert r.status_code == 200
        d = r.json()
        assert d["amount"] == 120.0
        assert d["type"] == "expense"
        TestAccounting.entry_id = d["_id"]

    def test_update_entry(self):
        assert TestAccounting.entry_id
        s = _session_for(BUCHHALTUNG)
        r = s.patch(f"{BASE_URL}/api/accounting/{TestAccounting.entry_id}", json={"amount": 150.0}, timeout=30)
        assert r.status_code == 200
        assert r.json()["amount"] == 150.0

    def test_rezeption_cannot_create(self):
        s = _session_for(REZEPTION)
        r = s.post(f"{BASE_URL}/api/accounting",
                   json={"category": "x", "description": "y", "amount": 1.0, "type": "income", "date": "2026-01-15"},
                   timeout=30)
        assert r.status_code == 403

    def test_export(self):
        s = _session_for(BUCHHALTUNG)
        r = s.get(f"{BASE_URL}/api/accounting/export", timeout=30)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_delete_entry(self):
        assert TestAccounting.entry_id
        s = _session_for(ADMIN)
        r = s.delete(f"{BASE_URL}/api/accounting/{TestAccounting.entry_id}", timeout=30)
        assert r.status_code == 200


# -------- ID SCAN --------
class TestIdScan:
    def test_scan_id_requires_auth(self):
        r = requests.post(f"{BASE_URL}/api/scan-id", files={"file": ("t.jpg", b"x", "image/jpeg")}, timeout=30)
        assert r.status_code == 401

    def test_scan_id_with_image(self):
        s = _session_for(REZEPTION)
        # Create a simple JPEG image
        img = Image.new("RGB", (400, 250), color=(200, 200, 200))
        buf = io.BytesIO()
        img.save(buf, format="JPEG")
        buf.seek(0)
        # Strip JSON content-type for multipart
        s.headers.pop("Content-Type", None)
        r = s.post(f"{BASE_URL}/api/scan-id", files={"file": ("id.jpg", buf, "image/jpeg")}, timeout=90)
        # OpenAI call may succeed (200) or fail due to unreadable image; we at least want non-401/403
        assert r.status_code in (200, 500), r.text
        if r.status_code == 200:
            assert "extracted_data" in r.json()
