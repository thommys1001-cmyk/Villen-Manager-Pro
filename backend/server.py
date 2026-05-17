from dotenv import load_dotenv
load_dotenv()

import os
import bcrypt
import jwt
import base64
import secrets
import asyncio
import resend
from datetime import datetime, timezone, timedelta
from typing import Optional, List
from io import BytesIO

from fastapi import FastAPI, HTTPException, Request, Response, UploadFile, File, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, EmailStr, Field
from pymongo import MongoClient, ASCENDING
from bson import ObjectId
from PIL import Image

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.pdfgen import canvas

from pywebpush import webpush, WebPushException

from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent
from emergentintegrations.payments.stripe.checkout import StripeCheckout, CheckoutSessionRequest

# Subscription plans (server-side only - never trust frontend prices)
SUBSCRIPTION_PLANS = {
    "starter": {"name": "Starter", "price": 29.0, "currency": "eur", "property_limit": 10},
    "pro": {"name": "Pro", "price": 49.0, "currency": "eur", "property_limit": 20},
    "business": {"name": "Business", "price": 99.0, "currency": "eur", "property_limit": None},  # unlimited
}
TRIAL_DAYS = 7

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.environ.get("FRONTEND_URL", "http://localhost:3000")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# MongoDB
client = MongoClient(os.environ.get("MONGO_URL", "mongodb://localhost:27017"), tz_aware=True)
db = client[os.environ.get("DB_NAME", "test_database")]

JWT_ALGORITHM = "HS256"

# ==================== ACCOUNTS / MULTI-TENANT MODELS ====================

class AccountSettingsUpdate(BaseModel):
    company_name: Optional[str] = None
    company_email: Optional[EmailStr] = None
    phone: Optional[str] = None
    website: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    postal_code: Optional[str] = None
    country: Optional[str] = None
    tax_id: Optional[str] = None          # Steuernummer
    vat_id: Optional[str] = None          # USt-IdNr.
    iban: Optional[str] = None
    bic: Optional[str] = None
    bank_name: Optional[str] = None
    logo_url: Optional[str] = None

class SignupRequest(BaseModel):
    email: EmailStr
    password: str
    name: str                              # Owner full name
    company_name: str

# ==================== EXISTING MODELS ====================

# Pydantic Models
class UserRegister(BaseModel):
    email: EmailStr
    password: str
    name: str
    role: str = "rezeption"

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class BookingCreate(BaseModel):
    guest_name: str
    email: EmailStr
    phone: str
    room_number: str
    room_type: str
    check_in_date: str
    check_out_date: str
    price: Optional[float] = None
    deposit: Optional[float] = None
    price_note: Optional[str] = None       # Freitext, falls Preis als Text
    deposit_note: Optional[str] = None
    guests_count: int = 1

class BookingUpdate(BaseModel):
    guest_name: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    room_number: Optional[str] = None
    room_type: Optional[str] = None
    check_in_date: Optional[str] = None
    check_out_date: Optional[str] = None
    price: Optional[float] = None
    deposit: Optional[float] = None
    price_note: Optional[str] = None
    deposit_note: Optional[str] = None
    guests_count: Optional[int] = None
    status: Optional[str] = None

class ServiceItem(BaseModel):
    name: str
    amount: float

class AccountingCreate(BaseModel):
    category: str
    description: str
    amount: float
    type: str
    date: str
    booking_id: Optional[str] = None
    services: Optional[List[ServiceItem]] = None

class AccountingUpdate(BaseModel):
    category: Optional[str] = None
    description: Optional[str] = None
    amount: Optional[float] = None
    type: Optional[str] = None
    date: Optional[str] = None
    services: Optional[List[ServiceItem]] = None

class ForgotPassword(BaseModel):
    email: EmailStr

class ResetPassword(BaseModel):
    token: str
    new_password: str

class IDVerificationData(BaseModel):
    id_verified: bool
    id_data: Optional[dict] = None

# Password hashing
def hash_password(password: str) -> str:
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password.encode("utf-8"), salt)
    return hashed.decode("utf-8")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))

# JWT helpers
def get_jwt_secret() -> str:
    return os.environ["JWT_SECRET"]

def create_access_token(user_id: str, email: str, role: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(minutes=15),
        "type": "access"
    }
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)

def create_refresh_token(user_id: str) -> str:
    payload = {
        "sub": user_id,
        "exp": datetime.now(timezone.utc) + timedelta(days=7),
        "type": "refresh"
    }
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)

# Auth dependency
async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Invalid token type")
        user = db.users.find_one({"_id": ObjectId(payload["sub"])})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        user["_id"] = str(user["_id"])
        # Convert account_id to str for downstream usage; keep raw for queries via tenant_filter
        if user.get("account_id"):
            user["account_id"] = str(user["account_id"])
        user.pop("password_hash", None)
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

# ==================== MULTI-TENANT HELPERS ====================

def tenant_filter(user: dict) -> dict:
    """Returns mongo filter to scope queries to user's account."""
    acc_id = user.get("account_id")
    if not acc_id:
        # Defensive: legacy users without account get nothing
        return {"account_id": "__none__"}
    return {"account_id": ObjectId(acc_id) if isinstance(acc_id, str) else acc_id}

def get_account_oid(user: dict) -> ObjectId:
    return ObjectId(user["account_id"]) if isinstance(user["account_id"], str) else user["account_id"]

def get_active_subscription_for_account(account_id) -> dict:
    """Returns subscription dict from account doc with computed effective status."""
    oid = ObjectId(account_id) if isinstance(account_id, str) else account_id
    account = db.accounts.find_one({"_id": oid})
    if not account:
        return {"plan": "starter", "status": "expired", "trial_end": None, "subscription_end": None}
    sub = account.get("subscription") or {}
    now = datetime.now(timezone.utc)
    if sub.get("status") == "trial":
        trial_end = sub.get("trial_end")
        if trial_end and now > trial_end:
            sub["status"] = "expired"
    elif sub.get("status") == "active":
        sub_end = sub.get("subscription_end")
        if sub_end and now > sub_end:
            sub["status"] = "expired"
    return sub

# Brute force protection
async def check_brute_force(identifier: str):
    attempts = db.login_attempts.find_one({"identifier": identifier})
    if attempts and attempts.get("count", 0) >= 5:
        lockout_until = attempts.get("lockout_until")
        if lockout_until and lockout_until > datetime.now(timezone.utc):
            raise HTTPException(status_code=429, detail="Too many failed attempts. Try again later.")

async def record_failed_login(identifier: str):
    attempts = db.login_attempts.find_one({"identifier": identifier})
    if attempts:
        count = attempts.get("count", 0) + 1
        lockout_until = datetime.now(timezone.utc) + timedelta(minutes=15) if count >= 5 else None
        db.login_attempts.update_one(
            {"identifier": identifier},
            {"$set": {"count": count, "lockout_until": lockout_until}}
        )
    else:
        db.login_attempts.insert_one({"identifier": identifier, "count": 1})

async def clear_failed_attempts(identifier: str):
    db.login_attempts.delete_one({"identifier": identifier})

# Startup event
@app.on_event("startup")
async def startup_event():
    db.users.create_index("email", unique=True)
    db.password_reset_tokens.create_index("expires_at", expireAfterSeconds=0)
    db.login_attempts.create_index("identifier")
    db.accounts.create_index("owner_email")
    db.properties.create_index("account_id")
    db.bookings.create_index("account_id")
    db.accounting.create_index("account_id")
    
    # ---------- Multi-Tenant Migration / Seed ----------
    admin_email = os.environ.get("ADMIN_EMAIL", "info@luxusvilla-ferien.de").lower()
    admin_password = os.environ.get("ADMIN_PASSWORD", "admin123")
    
    # Ensure master account exists
    master_account = db.accounts.find_one({"owner_email": admin_email})
    if not master_account:
        # First-run cleanup: remove orphaned data from prior single-tenant version
        db.properties.delete_many({"account_id": {"$exists": False}})
        db.bookings.delete_many({"account_id": {"$exists": False}})
        db.accounting.delete_many({"account_id": {"$exists": False}})
        
        now = datetime.now(timezone.utc)
        master_account_doc = {
            "owner_email": admin_email,
            "company_name": os.environ.get("COMPANY_NAME", "Luxusvilla Ferien"),
            "settings": {
                "company_email": os.environ.get("COMPANY_EMAIL", "info@luxusvilla-ferien.de"),
                "phone": os.environ.get("COMPANY_PHONE", ""),
                "website": os.environ.get("COMPANY_WEBSITE", ""),
                "address": os.environ.get("COMPANY_ADDRESS", ""),
                "city": "",
                "postal_code": "",
                "country": "Deutschland",
                "tax_id": "",
                "vat_id": "",
                "iban": "",
                "bic": "",
                "bank_name": "",
                "logo_url": "",
            },
            "subscription": {
                "plan": "business",
                "status": "active",
                "trial_start": None,
                "trial_end": None,
                "subscription_end": now + timedelta(days=3650),
                "stripe_customer_id": None,
                "cancelled_at": None,
            },
            "created_at": now,
        }
        result = db.accounts.insert_one(master_account_doc)
        master_account_id = result.inserted_id
    else:
        master_account_id = master_account["_id"]
    
    # Ensure master admin user exists, linked to master account
    existing_admin = db.users.find_one({"email": admin_email})
    if existing_admin is None:
        db.users.insert_one({
            "email": admin_email,
            "password_hash": hash_password(admin_password),
            "name": "Master Admin",
            "role": "admin",
            "account_id": master_account_id,
            "created_at": datetime.now(timezone.utc),
        })
    else:
        update = {"account_id": master_account_id}
        if not verify_password(admin_password, existing_admin["password_hash"]):
            update["password_hash"] = hash_password(admin_password)
        db.users.update_one({"email": admin_email}, {"$set": update, "$unset": {"subscription": ""}})
    
    # Optional: ensure helper test users (legacy)
    test_users = [
        {"email": "rezeption@hotel.com", "password": "rezeption123", "name": "Rezeption User", "role": "rezeption"},
        {"email": "buchhaltung@hotel.com", "password": "buchhaltung123", "name": "Buchhaltung User", "role": "buchhaltung"}
    ]
    for test_user in test_users:
        existing_test = db.users.find_one({"email": test_user["email"]})
        if not existing_test:
            db.users.insert_one({
                "email": test_user["email"],
                "password_hash": hash_password(test_user["password"]),
                "name": test_user["name"],
                "role": test_user["role"],
                "account_id": master_account_id,
                "created_at": datetime.now(timezone.utc),
            })
        else:
            db.users.update_one(
                {"email": test_user["email"]},
                {"$set": {"account_id": master_account_id}, "$unset": {"subscription": ""}}
            )
    
    # Tag any legacy orphan data with the master account (best-effort migration)
    for coll in ["properties", "bookings", "accounting", "push_subscriptions"]:
        db[coll].update_many({"account_id": {"$exists": False}}, {"$set": {"account_id": master_account_id}})
    
    # Write test credentials
    with open("/app/memory/test_credentials.md", "w") as f:
        f.write("# Test Credentials\n\n")
        f.write("## Master Admin (Owner)\n")
        f.write(f"- Email: {admin_email}\n")
        f.write(f"- Password: {admin_password}\n")
        f.write(f"- Role: admin (Owner of master account)\n\n")
        f.write("## Rezeption User (same account)\n")
        f.write("- Email: rezeption@hotel.com\n")
        f.write("- Password: rezeption123\n")
        f.write("- Role: rezeption\n\n")
        f.write("## Buchhaltung User (same account)\n")
        f.write("- Email: buchhaltung@hotel.com\n")
        f.write("- Password: buchhaltung123\n")
        f.write("- Role: buchhaltung\n\n")
        f.write("## Signup Test\n")
        f.write("- POST /api/auth/signup with {email, password, name, company_name}\n")
        f.write("- Creates new tenant account with 7-day trial automatically.\n")

# Auth routes
@app.post("/api/auth/signup")
async def signup(req: SignupRequest, response: Response):
    """Self-Service signup. Creates new tenant account + owner user with 7-day trial."""
    email = req.email.lower().strip()
    if not req.password or len(req.password) < 6:
        raise HTTPException(status_code=400, detail="Passwort muss mindestens 6 Zeichen lang sein")
    if db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="E-Mail bereits registriert")
    
    now = datetime.now(timezone.utc)
    trial_end = now + timedelta(days=TRIAL_DAYS)
    
    # Create account first
    account_doc = {
        "owner_email": email,
        "company_name": req.company_name.strip(),
        "settings": {
            "company_email": email,
            "phone": "",
            "website": "",
            "address": "",
            "city": "",
            "postal_code": "",
            "country": "Deutschland",
            "tax_id": "",
            "vat_id": "",
            "iban": "",
            "bic": "",
            "bank_name": "",
            "logo_url": "",
        },
        "subscription": {
            "plan": "pro",            # Trial unlocks Pro features
            "status": "trial",
            "trial_start": now,
            "trial_end": trial_end,
            "subscription_end": None,
            "stripe_customer_id": None,
            "cancelled_at": None,
        },
        "created_at": now,
    }
    account_result = db.accounts.insert_one(account_doc)
    account_id = account_result.inserted_id
    
    # Create owner user
    user_result = db.users.insert_one({
        "email": email,
        "password_hash": hash_password(req.password),
        "name": req.name,
        "role": "admin",
        "account_id": account_id,
        "created_at": now,
    })
    user_id = str(user_result.inserted_id)
    
    access_token = create_access_token(user_id, email, "admin")
    refresh_token = create_refresh_token(user_id)
    response.set_cookie("access_token", access_token, httponly=True, secure=False, samesite="lax", max_age=900, path="/")
    response.set_cookie("refresh_token", refresh_token, httponly=True, secure=False, samesite="lax", max_age=604800, path="/")
    
    return {
        "_id": user_id,
        "email": email,
        "name": req.name,
        "role": "admin",
        "account_id": str(account_id),
        "company_name": req.company_name,
        "trial_days": TRIAL_DAYS,
    }

@app.post("/api/auth/register")
async def register(user: UserRegister, response: Response):
    """Legacy register - now auto-creates account same as signup."""
    email = user.email.lower()
    existing = db.users.find_one({"email": email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    now = datetime.now(timezone.utc)
    trial_end = now + timedelta(days=TRIAL_DAYS)
    
    account_result = db.accounts.insert_one({
        "owner_email": email,
        "company_name": user.name,
        "settings": {
            "company_email": email, "phone": "", "website": "", "address": "",
            "city": "", "postal_code": "", "country": "Deutschland",
            "tax_id": "", "vat_id": "", "iban": "", "bic": "", "bank_name": "", "logo_url": "",
        },
        "subscription": {
            "plan": "pro", "status": "trial",
            "trial_start": now, "trial_end": trial_end,
            "subscription_end": None, "stripe_customer_id": None, "cancelled_at": None,
        },
        "created_at": now,
    })
    account_id = account_result.inserted_id
    
    result = db.users.insert_one({
        "email": email,
        "password_hash": hash_password(user.password),
        "name": user.name,
        "role": user.role if user.role in ("admin", "rezeption", "buchhaltung") else "admin",
        "account_id": account_id,
        "created_at": now,
    })
    
    user_id = str(result.inserted_id)
    access_token = create_access_token(user_id, email, user.role)
    refresh_token = create_refresh_token(user_id)
    
    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        secure=False,
        samesite="lax",
        max_age=900,
        path="/"
    )
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=False,
        samesite="lax",
        max_age=604800,
        path="/"
    )
    
    return {"_id": user_id, "email": email, "name": user.name, "role": user.role}

@app.post("/api/auth/login")
async def login(credentials: UserLogin, request: Request, response: Response):
    email = credentials.email.lower()
    identifier = f"{request.client.host}:{email}"
    
    await check_brute_force(identifier)
    
    user = db.users.find_one({"email": email})
    if not user or not verify_password(credentials.password, user["password_hash"]):
        await record_failed_login(identifier)
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    await clear_failed_attempts(identifier)
    
    user_id = str(user["_id"])
    access_token = create_access_token(user_id, email, user["role"])
    refresh_token = create_refresh_token(user_id)
    
    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        secure=False,
        samesite="lax",
        max_age=900,
        path="/"
    )
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=False,
        samesite="lax",
        max_age=604800,
        path="/"
    )
    
    return {
        "_id": user_id,
        "email": user["email"],
        "name": user["name"],
        "role": user["role"]
    }

@app.post("/api/auth/logout")
async def logout(response: Response, user: dict = Depends(get_current_user)):
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("refresh_token", path="/")
    return {"message": "Logged out successfully"}

@app.get("/api/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return user

@app.post("/api/auth/refresh")
async def refresh(request: Request, response: Response):
    token = request.cookies.get("refresh_token")
    if not token:
        raise HTTPException(status_code=401, detail="No refresh token")
    
    try:
        payload = jwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "refresh":
            raise HTTPException(status_code=401, detail="Invalid token type")
        
        user = db.users.find_one({"_id": ObjectId(payload["sub"])})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        
        user_id = str(user["_id"])
        access_token = create_access_token(user_id, user["email"], user["role"])
        
        response.set_cookie(
            key="access_token",
            value=access_token,
            httponly=True,
            secure=False,
            samesite="lax",
            max_age=900,
            path="/"
        )
        
        return {"message": "Token refreshed"}
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

@app.post("/api/auth/forgot-password")
async def forgot_password(data: ForgotPassword):
    email = data.email.lower()
    user = db.users.find_one({"email": email})
    if not user:
        return {"message": "If email exists, reset link will be sent"}
    
    token = secrets.token_urlsafe(32)
    db.password_reset_tokens.insert_one({
        "token": token,
        "user_id": user["_id"],
        "expires_at": datetime.now(timezone.utc) + timedelta(hours=1),
        "used": False
    })
    
    print(f"Password reset link: /reset-password?token={token}")
    return {"message": "If email exists, reset link will be sent"}

@app.post("/api/auth/reset-password")
async def reset_password(data: ResetPassword):
    token_doc = db.password_reset_tokens.find_one({"token": data.token})
    if not token_doc or token_doc.get("used") or token_doc.get("expires_at") < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="Invalid or expired token")
    
    db.users.update_one(
        {"_id": token_doc["user_id"]},
        {"$set": {"password_hash": hash_password(data.new_password)}}
    )
    
    db.password_reset_tokens.update_one(
        {"token": data.token},
        {"$set": {"used": True}}
    )
    
    return {"message": "Password reset successfully"}

# Booking routes
@app.get("/api/bookings")
async def get_bookings(user: dict = Depends(get_current_user)):
    bookings = list(db.bookings.find(tenant_filter(user)))
    for booking in bookings:
        booking["_id"] = str(booking["_id"])
        booking.pop("account_id", None)
    return bookings

@app.post("/api/bookings")
async def create_booking(booking: BookingCreate, user: dict = Depends(get_current_user)):
    booking_data = booking.dict()
    booking_data["status"] = "pending"
    booking_data["id_verified"] = False
    booking_data["id_data"] = None
    booking_data["created_at"] = datetime.now(timezone.utc)
    booking_data["created_by"] = user["_id"]
    booking_data["account_id"] = get_account_oid(user)
    
    result = db.bookings.insert_one(booking_data)
    booking_data["_id"] = str(result.inserted_id)
    account_oid_for_push = booking_data.pop("account_id", None)
    
    # Send confirmation email
    await send_booking_confirmation_email(booking_data, booking.email)
    
    # Send push notifications to account staff
    await send_push_to_all(booking_data, account_id=account_oid_for_push)
    
    return booking_data

@app.get("/api/bookings/{booking_id}")
async def get_booking(booking_id: str, user: dict = Depends(get_current_user)):
    booking = db.bookings.find_one({"_id": ObjectId(booking_id), **tenant_filter(user)})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    booking["_id"] = str(booking["_id"])
    booking.pop("account_id", None)
    return booking

@app.patch("/api/bookings/{booking_id}")
async def update_booking(booking_id: str, update: BookingUpdate, user: dict = Depends(get_current_user)):
    update_data = {k: v for k, v in update.dict().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")
    
    result = db.bookings.update_one(
        {"_id": ObjectId(booking_id), **tenant_filter(user)},
        {"$set": update_data}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    booking = db.bookings.find_one({"_id": ObjectId(booking_id)})
    booking["_id"] = str(booking["_id"])
    booking.pop("account_id", None)
    return booking

@app.delete("/api/bookings/{booking_id}")
async def delete_booking(booking_id: str, user: dict = Depends(get_current_user)):
    result = db.bookings.delete_one({"_id": ObjectId(booking_id), **tenant_filter(user)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Booking not found")
    return {"message": "Booking deleted"}

@app.post("/api/bookings/{booking_id}/check-in")
async def check_in(booking_id: str, verification: IDVerificationData, user: dict = Depends(get_current_user)):
    update_data = {
        "status": "checked_in",
        "check_in_time": datetime.now(timezone.utc),
        "id_verified": verification.id_verified,
        "id_data": verification.id_data
    }
    
    result = db.bookings.update_one(
        {"_id": ObjectId(booking_id), **tenant_filter(user)},
        {"$set": update_data}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    booking = db.bookings.find_one({"_id": ObjectId(booking_id)})
    booking["_id"] = str(booking["_id"])
    booking.pop("account_id", None)
    return booking

@app.post("/api/bookings/{booking_id}/check-out")
async def check_out(booking_id: str, user: dict = Depends(get_current_user)):
    booking = db.bookings.find_one({"_id": ObjectId(booking_id), **tenant_filter(user)})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    update_data = {
        "status": "checked_out",
        "check_out_time": datetime.now(timezone.utc)
    }
    
    db.bookings.update_one({"_id": ObjectId(booking_id), **tenant_filter(user)}, {"$set": update_data})
    
    # Create income entry (price might be None now)
    income_amount = float(booking.get("price") or 0)
    db.accounting.insert_one({
        "category": "Buchung",
        "description": f"Check-out: {booking['guest_name']} - Unterkunft {booking.get('room_number','')}",
        "amount": income_amount,
        "type": "income",
        "date": datetime.now(timezone.utc).isoformat(),
        "booking_id": str(booking["_id"]),
        "created_by": user["_id"],
        "account_id": get_account_oid(user),
        "created_at": datetime.now(timezone.utc)
    })
    
    booking["_id"] = str(booking["_id"])
    booking.pop("account_id", None)
    booking["status"] = "checked_out"
    booking["check_out_time"] = update_data["check_out_time"]
    return booking

# ID Scanning
@app.post("/api/scan-id")
async def scan_id(file: UploadFile = File(...), user: dict = Depends(get_current_user)):
    try:
        image_bytes = await file.read()
        image = Image.open(BytesIO(image_bytes))
        
        # Convert to JPEG if needed
        if image.format not in ["JPEG", "PNG", "WEBP"]:
            buffered = BytesIO()
            image.save(buffered, format="JPEG")
            image_bytes = buffered.getvalue()
        
        # Encode to base64
        image_base64 = base64.b64encode(image_bytes).decode('utf-8')
        
        # Use OpenAI Vision
        api_key = os.getenv("EMERGENT_LLM_KEY")
        if not api_key:
            raise HTTPException(status_code=500, detail="API key not configured")
        
        chat = LlmChat(
            api_key=api_key,
            session_id=f"id_scan_{user['_id']}",
            system_message="You are an ID document scanner. Extract all visible information from ID cards and passports."
        )
        chat.with_model("openai", "gpt-4o")
        
        msg = UserMessage(
            text="Extract the following information from this ID document: Full Name, Date of Birth, ID Number, Nationality, Expiry Date, Address (if visible). Return as JSON format.",
            file_contents=[ImageContent(image_base64)]
        )
        
        response = await chat.send_message(msg)
        
        return {
            "success": True,
            "extracted_data": response,
            "raw_text": response
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"ID scanning failed: {str(e)}")

# Accounting routes
@app.get("/api/accounting")
async def get_accounting(user: dict = Depends(get_current_user)):
    if user["role"] not in ["admin", "buchhaltung"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    entries = list(db.accounting.find(tenant_filter(user)))
    for entry in entries:
        entry["_id"] = str(entry["_id"])
        entry.pop("account_id", None)
        if entry.get("booking_id"):
            entry["booking_id"] = str(entry["booking_id"])
    return entries

@app.post("/api/accounting")
async def create_accounting(entry: AccountingCreate, user: dict = Depends(get_current_user)):
    if user["role"] not in ["admin", "buchhaltung"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    entry_data = entry.dict()
    entry_data["created_by"] = user["_id"]
    entry_data["account_id"] = get_account_oid(user)
    entry_data["created_at"] = datetime.now(timezone.utc)
    
    result = db.accounting.insert_one(entry_data)
    entry_data["_id"] = str(result.inserted_id)
    return entry_data

@app.patch("/api/accounting/{entry_id}")
async def update_accounting(entry_id: str, update: AccountingUpdate, user: dict = Depends(get_current_user)):
    if user["role"] not in ["admin", "buchhaltung"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    update_data = {k: v for k, v in update.dict().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")
    
    result = db.accounting.update_one(
        {"_id": ObjectId(entry_id), **tenant_filter(user)},
        {"$set": update_data}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Entry not found")
    
    entry = db.accounting.find_one({"_id": ObjectId(entry_id)})
    entry["_id"] = str(entry["_id"])
    entry.pop("account_id", None)
    return entry

@app.delete("/api/accounting/{entry_id}")
async def delete_accounting(entry_id: str, user: dict = Depends(get_current_user)):
    if user["role"] not in ["admin", "buchhaltung"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    result = db.accounting.delete_one({"_id": ObjectId(entry_id), **tenant_filter(user)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Entry not found")
    return {"message": "Entry deleted"}

@app.get("/api/accounting/export")
async def export_accounting(user: dict = Depends(get_current_user)):
    if user["role"] not in ["admin", "buchhaltung"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    entries = list(db.accounting.find(tenant_filter(user), {"_id": 0, "account_id": 0}))
    return entries

# Dashboard stats
@app.get("/api/stats/dashboard")
async def dashboard_stats(user: dict = Depends(get_current_user)):
    tf = tenant_filter(user)
    total_bookings = db.bookings.count_documents(tf)
    checked_in = db.bookings.count_documents({**tf, "status": "checked_in"})
    pending = db.bookings.count_documents({**tf, "status": "pending"})
    
    # Revenue calculation
    income_pipeline = [
        {"$match": {**tf, "type": "income"}},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
    ]
    income_result = list(db.accounting.aggregate(income_pipeline))
    total_income = income_result[0]["total"] if income_result else 0
    
    expense_pipeline = [
        {"$match": {**tf, "type": "expense"}},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
    ]
    expense_result = list(db.accounting.aggregate(expense_pipeline))
    total_expenses = expense_result[0]["total"] if expense_result else 0
    
    return {
        "total_bookings": total_bookings,
        "checked_in": checked_in,
        "pending": pending,
        "total_income": total_income,
        "total_expenses": total_expenses,
        "net_income": total_income - total_expenses
    }

# Email Service
async def send_booking_confirmation_email(booking_data: dict, guest_email: str):
    """Send booking confirmation email using Resend"""
    try:
        resend.api_key = os.getenv("RESEND_API_KEY")
        sender_email = os.getenv("SENDER_EMAIL", "onboarding@resend.dev")
        hotel_name = os.getenv("HOTEL_NAME", "Grand Hotel")
        
        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
                .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
                .header {{ background: #3b82f6; color: white; padding: 20px; text-align: center; }}
                .content {{ padding: 20px; background: #f9fafb; }}
                .booking-details {{ background: white; padding: 15px; margin: 15px 0; border-left: 4px solid #3b82f6; }}
                .footer {{ text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }}
                .detail-row {{ padding: 8px 0; border-bottom: 1px solid #e5e7eb; }}
                .detail-label {{ font-weight: bold; color: #374151; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>{hotel_name}</h1>
                    <p>Buchungsbestätigung</p>
                </div>
                <div class="content">
                    <p>Sehr geehrte/r {booking_data.get('guest_name', 'Gast')},</p>
                    <p>vielen Dank für Ihre Buchung! Wir freuen uns, Sie bei uns begrüßen zu dürfen.</p>
                    
                    <div class="booking-details">
                        <h3>Ihre Buchungsdetails:</h3>
                        <div class="detail-row">
                            <span class="detail-label">Zimmernummer:</span> {booking_data.get('room_number', 'N/A')}
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Kategorie:</span> {booking_data.get('room_type', 'N/A')}
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Check-In:</span> {booking_data.get('check_in_date', 'N/A')}
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Check-Out:</span> {booking_data.get('check_out_date', 'N/A')}
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Anzahl Gäste:</span> {booking_data.get('guests_count', 1)}
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Übernachtungspreis:</span> €{booking_data.get('price', 0):.2f}
                        </div>
                        {f'<div class="detail-row"><span class="detail-label">Kaution:</span> €{booking_data.get("deposit", 0):.2f}</div>' if booking_data.get('deposit', 0) > 0 else ''}
                        <div class="detail-row" style="background: #f0f9ff; font-weight: bold;">
                            <span class="detail-label">Gesamtbetrag:</span> €{(booking_data.get('price', 0) + (booking_data.get('deposit', 0) or 0)):.2f}
                        </div>
                    </div>
                    
                    <p>Bei Fragen stehen wir Ihnen gerne zur Verfügung.</p>
                    <p>Wir freuen uns auf Ihren Besuch!</p>
                </div>
                <div class="footer">
                    <p>{hotel_name}<br>
                    {os.getenv('HOTEL_ADDRESS', 'Hauptstraße 123, 10115 Berlin')}<br>
                    Tel: {os.getenv('HOTEL_PHONE', '+49 30 12345678')}<br>
                    E-Mail: {os.getenv('HOTEL_EMAIL', 'info@hotel.com')}</p>
                </div>
            </div>
        </body>
        </html>
        """
        
        params = {
            "from": sender_email,
            "to": [guest_email],
            "subject": f"Buchungsbestätigung - {hotel_name}",
            "html": html_content
        }
        
        # Non-blocking email send
        await asyncio.to_thread(resend.Emails.send, params)
        return True
    except Exception as e:
        print(f"Email sending failed: {str(e)}")
        return False

# PDF Invoice Generation
def generate_invoice_pdf(booking: dict, account_info: dict = None) -> BytesIO:
    """Generate PDF invoice for a booking with account branding."""
    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4)
    elements = []
    styles = getSampleStyleSheet()
    account_info = account_info or {}
    
    # Branding (from account settings)
    company_name = account_info.get("company_name") or "Villen Manager"
    company_address = account_info.get("address") or ""
    company_city = account_info.get("city") or ""
    company_postal = account_info.get("postal_code") or ""
    company_country = account_info.get("country") or ""
    company_phone = account_info.get("phone") or ""
    company_email = account_info.get("company_email") or ""
    company_website = account_info.get("website") or ""
    tax_id = account_info.get("tax_id") or ""
    vat_id = account_info.get("vat_id") or ""
    iban = account_info.get("iban") or ""
    bic = account_info.get("bic") or ""
    bank_name = account_info.get("bank_name") or ""
    
    # Title
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Heading1'],
        fontSize=24,
        textColor=colors.HexColor('#D4AF37'),
        spaceAfter=12
    )
    elements.append(Paragraph(company_name, title_style))
    address_lines = []
    if company_address:
        address_lines.append(company_address)
    if company_postal or company_city:
        address_lines.append(f"{company_postal} {company_city}".strip())
    if company_country:
        address_lines.append(company_country)
    if company_phone:
        address_lines.append(f"Tel: {company_phone}")
    if company_email:
        address_lines.append(f"E-Mail: {company_email}")
    if company_website:
        address_lines.append(f"Web: {company_website}")
    if address_lines:
        elements.append(Paragraph("<br/>".join(address_lines), styles['Normal']))
    elements.append(Spacer(1, 20))
    
    # Invoice Title
    elements.append(Paragraph("RECHNUNG", styles['Heading1']))
    elements.append(Spacer(1, 12))
    
    # Guest Info
    elements.append(Paragraph(f"<b>Gast:</b> {booking.get('guest_name', 'N/A')}", styles['Normal']))
    elements.append(Paragraph(f"<b>E-Mail:</b> {booking.get('email', 'N/A')}", styles['Normal']))
    elements.append(Paragraph(f"<b>Telefon:</b> {booking.get('phone', 'N/A')}", styles['Normal']))
    elements.append(Spacer(1, 20))
    
    # Compute totals (handle None prices)
    price = booking.get('price')
    deposit = booking.get('deposit') or 0
    price_str = f"€{price:.2f}" if isinstance(price, (int, float)) else (booking.get('price_note') or '—')
    deposit_str = f"€{deposit:.2f}" if isinstance(deposit, (int, float)) and deposit > 0 else (booking.get('deposit_note') or '')
    
    total_value = 0
    if isinstance(price, (int, float)):
        total_value += float(price)
    if isinstance(deposit, (int, float)):
        total_value += float(deposit)
    
    # Booking Details Table
    data = [
        ['Beschreibung', 'Details', 'Betrag'],
        ['Unterkunft', booking.get('room_number', 'N/A'), ''],
        ['Kategorie', booking.get('room_type', 'N/A'), ''],
        ['Check-In', booking.get('check_in_date', 'N/A'), ''],
        ['Check-Out', booking.get('check_out_date', 'N/A'), ''],
        ['Anzahl Gäste', str(booking.get('guests_count', 1)), ''],
        ['', '', ''],
        ['Übernachtungspreis', '', price_str],
    ]
    
    if deposit_str:
        data.append(['Kaution (Sicherheitsleistung)', '', deposit_str])
    data.append(['', '', ''])
    if total_value > 0:
        data.append(['GESAMTBETRAG', '', f"€{total_value:.2f}"])
    else:
        data.append(['GESAMTBETRAG', '', booking.get('price_note') or '—'])
    
    table = Table(data, colWidths=[60*mm, 70*mm, 40*mm])
    table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#D4AF37')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.HexColor('#0a0a0a')),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('ALIGN', (2, 0), (2, -1), 'RIGHT'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 12),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
        ('BACKGROUND', (0, -1), (-1, -1), colors.HexColor('#F1D279')),
        ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
        ('GRID', (0, 0), (-1, -2), 1, colors.grey),
        ('BOX', (0, -1), (-1, -1), 2, colors.black),
    ]))
    
    elements.append(table)
    elements.append(Spacer(1, 30))
    
    # Payment / Tax footer
    tax_lines = []
    if tax_id:
        tax_lines.append(f"Steuernummer: {tax_id}")
    if vat_id:
        tax_lines.append(f"USt-IdNr.: {vat_id}")
    if tax_lines:
        elements.append(Paragraph(" · ".join(tax_lines), styles['Normal']))
    
    if iban or bank_name:
        bank_parts = []
        if bank_name:
            bank_parts.append(f"Bank: {bank_name}")
        if iban:
            bank_parts.append(f"IBAN: {iban}")
        if bic:
            bank_parts.append(f"BIC: {bic}")
        elements.append(Paragraph("Bankverbindung: " + " · ".join(bank_parts), styles['Normal']))
    elements.append(Spacer(1, 12))
    elements.append(Paragraph(f"Rechnungsdatum: {datetime.now().strftime('%d.%m.%Y')}", styles['Normal']))
    elements.append(Paragraph("Vielen Dank für Ihren Aufenthalt!", styles['Normal']))
    
    doc.build(elements)
    buffer.seek(0)
    return buffer

# WhatsApp Notification (Optional)
async def send_whatsapp_notification(phone_number: str, message: str):
    """Send WhatsApp notification using Twilio (optional)"""
    try:
        account_sid = os.getenv("TWILIO_ACCOUNT_SID")
        auth_token = os.getenv("TWILIO_AUTH_TOKEN")
        
        if not account_sid or not auth_token or account_sid == "placeholder_get_from_twilio":
            print("WhatsApp not configured")
            return False
        
        try:
            from twilio.rest import Client
            client = Client(account_sid, auth_token)
            
            from_whatsapp = os.getenv("TWILIO_WHATSAPP_NUMBER", "whatsapp:+14155238886")
            to_whatsapp = f"whatsapp:{phone_number}" if not phone_number.startswith("whatsapp:") else phone_number
            
            msg = client.messages.create(from_=from_whatsapp, body=message, to=to_whatsapp)
            return True
        except ImportError:
            print("Twilio library not installed")
            return False
    except Exception as e:
        print(f"WhatsApp notification failed: {str(e)}")
        return False

# Web Push Notifications
def _send_push_sync(subscription_info: dict, payload: str):
    """Synchronous push send (runs in thread pool)"""
    try:
        vapid_private_key = os.getenv("VAPID_PRIVATE_KEY")
        vapid_claims_email = os.getenv("VAPID_CLAIMS_EMAIL", "mailto:info@luxusvilla-ferien.de")
        
        if not vapid_private_key:
            return False
        
        webpush(
            subscription_info=subscription_info,
            data=payload,
            vapid_private_key=vapid_private_key,
            vapid_claims={"sub": vapid_claims_email}
        )
        return True
    except WebPushException as e:
        print(f"Push failed: {str(e)}")
        return False
    except Exception as e:
        print(f"Push error: {str(e)}")
        return False

async def send_push_to_all(booking_data: dict, account_id=None):
    """Send push notification about new booking to all subscribed users of an account."""
    import json as json_lib
    price = booking_data.get('price')
    price_str = f"€{price:.2f}" if isinstance(price, (int, float)) else (booking_data.get('price_note') or '')
    
    payload = json_lib.dumps({
        "title": "🏨 Neue Buchung eingegangen!",
        "body": f"{booking_data.get('guest_name')} - {booking_data.get('room_type')} - {price_str}".strip(' -'),
        "icon": "https://customer-assets.emergentagent.com/wingman/359d1d25-501d-49ee-acdc-7ddd114c4b2b/attachments/abc94a5694cb4db0a3fad6a16ce20ec7_icon (1).png",
        "badge": "https://customer-assets.emergentagent.com/wingman/359d1d25-501d-49ee-acdc-7ddd114c4b2b/attachments/abc94a5694cb4db0a3fad6a16ce20ec7_icon (1).png",
        "tag": "new-booking",
        "data": {
            "url": "/bookings",
            "booking_id": booking_data.get("_id")
        }
    })
    
    query = {"account_id": account_id} if account_id else {}
    subscriptions = list(db.push_subscriptions.find(query))
    for sub in subscriptions:
        subscription_info = {"endpoint": sub["endpoint"], "keys": sub["keys"]}
        try:
            success = await asyncio.to_thread(_send_push_sync, subscription_info, payload)
            if not success:
                db.push_subscriptions.delete_one({"_id": sub["_id"]})
        except Exception as e:
            print(f"Push failed: {str(e)}")

async def notify_new_booking(booking_data: dict, account_id=None):
    """Send notifications for new booking - WhatsApp + Web Push"""
    hotel_phone = os.getenv("COMPANY_WHATSAPP_NUMBER") or os.getenv("HOTEL_WHATSAPP_NUMBER")
    if hotel_phone:
        message = f"""🏨 Neue Buchung!

Gast: {booking_data.get('guest_name')}
Zimmer: {booking_data.get('room_number')} ({booking_data.get('room_type')})
Check-In: {booking_data.get('check_in_date')}
Check-Out: {booking_data.get('check_out_date')}
Gäste: {booking_data.get('guests_count')}
Preis: €{booking_data.get('price', 0):.2f}

Kontakt: {booking_data.get('email')} / {booking_data.get('phone')}"""
        await send_whatsapp_notification(hotel_phone, message)
    
    # Send Web Push notifications
    await send_push_to_all(booking_data, account_id=account_id)

# Push Subscription Model
class PushSubscriptionData(BaseModel):
    endpoint: str
    keys: dict

class PropertyCreate(BaseModel):
    name: str
    category: str  # Villa, Hotel, Ferienhaus, Appartment, Zimmer
    description: Optional[str] = None
    address: Optional[str] = None
    default_price: Optional[float] = None
    default_deposit: Optional[float] = None
    max_guests: Optional[int] = 2

class PropertyUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    description: Optional[str] = None
    address: Optional[str] = None
    default_price: Optional[float] = None
    default_deposit: Optional[float] = None
    max_guests: Optional[int] = None

# Properties (Immobilien) Endpoints
@app.get("/api/properties")
async def get_properties(user: dict = Depends(get_current_user)):
    properties = list(db.properties.find(tenant_filter(user)))
    for p in properties:
        p["_id"] = str(p["_id"])
        p.pop("account_id", None)
    return properties

@app.get("/api/public/properties")
async def get_public_properties():
    """Public endpoint - returns properties of MASTER account only (legacy)."""
    master = db.accounts.find_one({"owner_email": os.environ.get("ADMIN_EMAIL", "info@luxusvilla-ferien.de").lower()})
    if not master:
        return []
    properties = list(db.properties.find({"account_id": master["_id"]}, {"_id": 0, "created_by": 0, "account_id": 0}))
    return properties

@app.post("/api/properties")
async def create_property(prop: PropertyCreate, user: dict = Depends(get_current_user)):
    # Enforce subscription property limit (per-account)
    sub = get_active_subscription_for_account(user["account_id"])
    limit = SUBSCRIPTION_PLANS.get(sub.get("plan", "starter"), {}).get("property_limit")
    if limit is not None:
        current_count = db.properties.count_documents(tenant_filter(user))
        if current_count >= limit:
            raise HTTPException(
                status_code=403,
                detail=f"Limit erreicht: Ihr {SUBSCRIPTION_PLANS[sub['plan']]['name']}-Tarif erlaubt max. {limit} Unterkünfte. Upgraden Sie für mehr."
            )
    prop_data = prop.dict()
    prop_data["created_at"] = datetime.now(timezone.utc)
    prop_data["created_by"] = user["_id"]
    prop_data["account_id"] = get_account_oid(user)
    
    result = db.properties.insert_one(prop_data)
    prop_data["_id"] = str(result.inserted_id)
    prop_data.pop("account_id", None)
    return prop_data

@app.patch("/api/properties/{property_id}")
async def update_property(property_id: str, update: PropertyUpdate, user: dict = Depends(get_current_user)):
    update_data = {k: v for k, v in update.dict().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")
    
    result = db.properties.update_one(
        {"_id": ObjectId(property_id), **tenant_filter(user)},
        {"$set": update_data}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Property not found")
    
    prop = db.properties.find_one({"_id": ObjectId(property_id)})
    prop["_id"] = str(prop["_id"])
    prop.pop("account_id", None)
    return prop

@app.delete("/api/properties/{property_id}")
async def delete_property(property_id: str, user: dict = Depends(get_current_user)):
    result = db.properties.delete_one({"_id": ObjectId(property_id), **tenant_filter(user)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Property not found")
    return {"message": "Property deleted"}

# Push Subscription Endpoints
@app.get("/api/push/vapid-public-key")
async def get_vapid_public_key():
    return {"public_key": os.getenv("VAPID_PUBLIC_KEY", "")}

@app.post("/api/push/subscribe")
async def subscribe_push(subscription: PushSubscriptionData, user: dict = Depends(get_current_user)):
    existing = db.push_subscriptions.find_one({"endpoint": subscription.endpoint})
    
    sub_data = {
        "endpoint": subscription.endpoint,
        "keys": subscription.keys,
        "user_id": user["_id"],
        "user_email": user["email"],
        "role": user["role"],
        "account_id": get_account_oid(user),
        "created_at": datetime.now(timezone.utc)
    }
    
    if existing:
        db.push_subscriptions.update_one({"endpoint": subscription.endpoint}, {"$set": sub_data})
    else:
        db.push_subscriptions.insert_one(sub_data)
    
    return {"success": True, "message": "Subscription saved"}

@app.post("/api/push/unsubscribe")
async def unsubscribe_push(data: dict, user: dict = Depends(get_current_user)):
    endpoint = data.get("endpoint")
    if endpoint:
        db.push_subscriptions.delete_one({"endpoint": endpoint, "user_id": user["_id"]})
    return {"success": True}

@app.post("/api/push/test")
async def test_push(user: dict = Depends(get_current_user)):
    import json as json_lib
    
    subscriptions = list(db.push_subscriptions.find({"user_id": user["_id"]}))
    if not subscriptions:
        return {"success": False, "message": "Keine aktiven Abonnements. Aktivieren Sie Push-Benachrichtigungen zuerst."}
    
    payload = json_lib.dumps({
        "title": "🔔 Test-Benachrichtigung",
        "body": "Push-Benachrichtigungen funktionieren! Villen Manager Pro",
        "icon": "https://customer-assets.emergentagent.com/wingman/359d1d25-501d-49ee-acdc-7ddd114c4b2b/attachments/abc94a5694cb4db0a3fad6a16ce20ec7_icon (1).png",
        "tag": "test",
        "data": {"url": "/dashboard"}
    })
    
    sent_count = 0
    for sub in subscriptions:
        subscription_info = {"endpoint": sub["endpoint"], "keys": sub["keys"]}
        try:
            success = await asyncio.to_thread(_send_push_sync, subscription_info, payload)
            if success:
                sent_count += 1
        except Exception as e:
            print(f"Test push failed: {str(e)}")
    
    return {"success": True, "sent_count": sent_count, "message": f"{sent_count} Benachrichtigung(en) gesendet"}

# Availability API
@app.get("/api/availability")
async def get_availability(start_date: str, end_date: str, user: dict = Depends(get_current_user)):
    """Get accommodation availability for a date range"""
    try:
        tf = tenant_filter(user)
        # Get all bookings in the date range (tenant scoped)
        bookings = list(db.bookings.find({
            **tf,
            "check_in_date": {"$lte": end_date},
            "check_out_date": {"$gte": start_date},
            "status": {"$in": ["pending", "checked_in"]}
        }))
        
        # Get occupied accommodations
        occupied = {}
        for booking in bookings:
            name = booking.get("room_number", "")
            if not name:
                continue
            if name not in occupied:
                occupied[name] = []
            occupied[name].append({
                "guest_name": booking["guest_name"],
                "check_in": booking["check_in_date"],
                "check_out": booking["check_out_date"],
                "status": booking["status"]
            })
        
        # Use properties collection (tenant scoped) as source of truth
        properties = list(db.properties.find(tf, {"name": 1, "category": 1, "_id": 0}))
        all_accommodations = [{"name": p["name"], "category": p.get("category", "")} for p in properties]
        
        existing_names = {a["name"] for a in all_accommodations}
        for name in occupied.keys():
            if name not in existing_names:
                all_accommodations.append({"name": name, "category": ""})
        
        availability = []
        for acc in all_accommodations:
            availability.append({
                "room_number": acc["name"],
                "category": acc["category"],
                "is_available": acc["name"] not in occupied,
                "bookings": occupied.get(acc["name"], [])
            })
        
        return availability
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Invoice Download
@app.get("/api/bookings/{booking_id}/invoice")
async def download_invoice(booking_id: str, user: dict = Depends(get_current_user)):
    """Download PDF invoice for a booking"""
    try:
        booking = db.bookings.find_one({"_id": ObjectId(booking_id), **tenant_filter(user)})
        if not booking:
            raise HTTPException(status_code=404, detail="Booking not found")
        
        # Load account branding
        account = db.accounts.find_one({"_id": get_account_oid(user)})
        account_info = {
            "company_name": account.get("company_name", "") if account else "",
            **(account.get("settings", {}) if account else {}),
        }
        
        # Generate PDF (now with account branding)
        pdf_buffer = generate_invoice_pdf(booking, account_info)
        
        room_num = booking.get('room_number','rechnung')
        return StreamingResponse(
            pdf_buffer,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f"attachment; filename=rechnung_{room_num}_{booking_id}.pdf"
            }
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Public Booking API (No Auth Required)
class PublicBookingCreate(BaseModel):
    guest_name: str
    email: EmailStr
    phone: str
    room_type: str
    check_in_date: str
    check_out_date: str
    guests_count: int = 1
    price_per_night: Optional[float] = None
    deposit: Optional[float] = 0.0
    special_requests: Optional[str] = None

@app.post("/api/public/bookings")
async def create_public_booking(booking: PublicBookingCreate):
    """Public endpoint for online bookings (no auth) - attaches to MASTER tenant."""
    try:
        master_email = os.environ.get("ADMIN_EMAIL", "info@luxusvilla-ferien.de").lower()
        master_account = db.accounts.find_one({"owner_email": master_email})
        if not master_account:
            raise HTTPException(status_code=503, detail="Service not configured")
        master_account_id = master_account["_id"]
        
        # Check availability for the room type within master account
        existing_bookings = db.bookings.count_documents({
            "account_id": master_account_id,
            "room_type": booking.room_type,
            "check_in_date": {"$lte": booking.check_out_date},
            "check_out_date": {"$gte": booking.check_in_date},
            "status": {"$in": ["pending", "checked_in"]}
        })
        
        # Get all rooms of this type (simplified: assume 5 rooms per type)
        max_rooms_per_type = 5
        if existing_bookings >= max_rooms_per_type:
            raise HTTPException(status_code=400, detail="Keine Unterkünfte verfügbar für diese Daten")
        
        room_number = f"{booking.room_type[0]}{existing_bookings + 1:02d}"
        
        check_in = datetime.strptime(booking.check_in_date, "%Y-%m-%d")
        check_out = datetime.strptime(booking.check_out_date, "%Y-%m-%d")
        nights = (check_out - check_in).days
        
        if booking.price_per_night is not None and booking.price_per_night > 0:
            total_price = booking.price_per_night * nights
        else:
            price_per_night = {"Villa": 500, "Ferienhaus": 250, "Appartment": 120, "Zimmer": 80}
            total_price = price_per_night.get(booking.room_type, 100) * nights
        
        booking_data = {
            "guest_name": booking.guest_name,
            "email": booking.email,
            "phone": booking.phone,
            "room_number": room_number,
            "room_type": booking.room_type,
            "check_in_date": booking.check_in_date,
            "check_out_date": booking.check_out_date,
            "guests_count": booking.guests_count,
            "price": total_price,
            "deposit": booking.deposit or 0.0,
            "status": "pending",
            "id_verified": False,
            "id_data": None,
            "special_requests": booking.special_requests,
            "account_id": master_account_id,
            "created_at": datetime.now(timezone.utc),
            "booking_source": "online"
        }
        
        result = db.bookings.insert_one(booking_data)
        booking_data["_id"] = str(result.inserted_id)
        booking_data.pop("account_id", None)
        
        # Send confirmation email
        await send_booking_confirmation_email(booking_data, booking.email)
        
        # Send WhatsApp + Web Push notifications to master account
        await notify_new_booking(booking_data, account_id=master_account_id)
        
        return {
            "message": "Buchung erfolgreich erstellt!",
            "booking_id": booking_data["_id"],
            "room_number": room_number,
            "total_price": total_price,
            "confirmation_sent": True
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/public/room-types")
async def get_room_types():
    """Get available property types with pricing"""
    return [
        {
            "type": "Villa",
            "price_per_night": 500,
            "description": "Luxuriöse Villa mit privatem Pool und Garten",
            "features": ["Privater Pool", "Großer Garten", "5+ Schlafzimmer", "Vollausstattung", "Parkplätze"]
        },
        {
            "type": "Ferienhaus",
            "price_per_night": 250,
            "description": "Gemütliches Ferienhaus für die ganze Familie",
            "features": ["3-4 Schlafzimmer", "Garten", "Voll ausgestattete Küche", "Terrasse"]
        },
        {
            "type": "Appartment",
            "price_per_night": 120,
            "description": "Modernes Appartment in bester Lage",
            "features": ["1-2 Schlafzimmer", "Balkon", "Moderne Ausstattung", "Zentrale Lage"]
        },
        {
            "type": "Zimmer",
            "price_per_night": 80,
            "description": "Komfortables Zimmer mit allen Annehmlichkeiten",
            "features": ["Privates Bad", "WLAN", "Klimaanlage", "TV"]
        }
    ]

@app.get("/")
async def root():
    return {"message": "Hotel Management API"}

# ==================== SUBSCRIPTION & STRIPE ====================

def get_active_subscription(email: str) -> dict:
    """DEPRECATED: kept as fallback. Use get_active_subscription_for_account instead."""
    user = db.users.find_one({"email": email})
    if not user or not user.get("account_id"):
        return {"plan": "starter", "status": "expired"}
    return get_active_subscription_for_account(user["account_id"])

@app.get("/api/subscription/plans")
async def get_plans():
    """Public endpoint for pricing display."""
    return {
        "plans": [
            {"id": k, **v} for k, v in SUBSCRIPTION_PLANS.items()
        ],
        "trial_days": TRIAL_DAYS
    }

@app.get("/api/subscription/me")
async def get_my_subscription(user: dict = Depends(get_current_user)):
    sub = get_active_subscription_for_account(user["account_id"])
    plan_info = SUBSCRIPTION_PLANS.get(sub.get("plan", "starter"), SUBSCRIPTION_PLANS["starter"])
    now = datetime.now(timezone.utc)
    days_left = 0
    if sub.get("status") == "trial" and sub.get("trial_end"):
        days_left = max(0, (sub["trial_end"] - now).days)
    elif sub.get("status") == "active" and sub.get("subscription_end"):
        days_left = max(0, (sub["subscription_end"] - now).days)
    # Count current properties for limit display (per-account)
    property_count = db.properties.count_documents(tenant_filter(user))
    return {
        "plan": sub.get("plan"),
        "plan_name": plan_info["name"],
        "price": plan_info["price"],
        "currency": plan_info["currency"],
        "property_limit": plan_info["property_limit"],
        "property_count": property_count,
        "status": sub.get("status"),
        "trial_end": sub.get("trial_end").isoformat() if sub.get("trial_end") else None,
        "subscription_end": sub.get("subscription_end").isoformat() if sub.get("subscription_end") else None,
        "days_left": days_left,
        "trial_days": TRIAL_DAYS,
    }

class CheckoutCreateRequest(BaseModel):
    plan: str  # starter, pro, business
    origin_url: str

@app.post("/api/subscription/checkout")
async def create_subscription_checkout(req: CheckoutCreateRequest, user: dict = Depends(get_current_user)):
    if req.plan not in SUBSCRIPTION_PLANS:
        raise HTTPException(status_code=400, detail="Invalid plan")
    plan_info = SUBSCRIPTION_PLANS[req.plan]
    
    stripe_api_key = os.environ.get("STRIPE_API_KEY")
    if not stripe_api_key:
        raise HTTPException(status_code=500, detail="Stripe not configured")
    
    host_url = req.origin_url.rstrip("/")
    webhook_url = f"{host_url}/api/webhook/stripe"
    stripe_checkout = StripeCheckout(api_key=stripe_api_key, webhook_url=webhook_url)
    
    success_url = f"{host_url}/subscription/success?session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{host_url}/pricing"
    
    metadata = {
        "user_email": user["email"],
        "user_id": user["_id"],
        "account_id": user["account_id"],
        "plan": req.plan,
        "source": "villen_manager_pro",
    }
    
    checkout_request = CheckoutSessionRequest(
        amount=float(plan_info["price"]),
        currency=plan_info["currency"],
        success_url=success_url,
        cancel_url=cancel_url,
        metadata=metadata,
    )
    
    try:
        session = await stripe_checkout.create_checkout_session(checkout_request)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Stripe error: {str(e)}")
    
    # Create payment_transactions record (MANDATORY per playbook)
    db.payment_transactions.insert_one({
        "session_id": session.session_id,
        "user_email": user["email"],
        "user_id": user["_id"],
        "account_id": get_account_oid(user),
        "plan": req.plan,
        "amount": float(plan_info["price"]),
        "currency": plan_info["currency"],
        "metadata": metadata,
        "payment_status": "pending",
        "status": "initiated",
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
    })
    
    return {"url": session.url, "session_id": session.session_id}

@app.get("/api/subscription/checkout/status/{session_id}")
async def get_checkout_status(session_id: str, user: dict = Depends(get_current_user)):
    stripe_api_key = os.environ.get("STRIPE_API_KEY")
    if not stripe_api_key:
        raise HTTPException(status_code=500, detail="Stripe not configured")
    
    # Find transaction
    tx = db.payment_transactions.find_one({"session_id": session_id})
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")
    if tx["user_email"] != user["email"]:
        raise HTTPException(status_code=403, detail="Forbidden")
    
    stripe_checkout = StripeCheckout(api_key=stripe_api_key, webhook_url="")
    try:
        checkout_status = await stripe_checkout.get_checkout_status(session_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Stripe error: {str(e)}")
    
    # If already processed, return current status (idempotent)
    if tx.get("payment_status") == "paid":
        return {
            "status": checkout_status.status,
            "payment_status": checkout_status.payment_status,
            "plan": tx.get("plan"),
            "already_processed": True,
        }
    
    # Update transaction
    db.payment_transactions.update_one(
        {"session_id": session_id},
        {"$set": {
            "payment_status": checkout_status.payment_status,
            "status": checkout_status.status,
            "updated_at": datetime.now(timezone.utc),
        }}
    )
    
    # If paid → activate subscription on ACCOUNT (only once)
    if checkout_status.payment_status == "paid":
        plan = tx.get("plan")
        now = datetime.now(timezone.utc)
        account_oid = tx.get("account_id") or get_account_oid(user)
        current_account = db.accounts.find_one({"_id": account_oid})
        existing_sub = (current_account or {}).get("subscription", {})
        existing_end = existing_sub.get("subscription_end")
        if existing_sub.get("status") == "active" and existing_end and existing_end > now:
            new_end = existing_end + timedelta(days=30)
        else:
            new_end = now + timedelta(days=30)
        
        db.accounts.update_one(
            {"_id": account_oid},
            {"$set": {
                "subscription.plan": plan,
                "subscription.status": "active",
                "subscription.subscription_end": new_end,
                "subscription.cancelled_at": None,
            }}
        )
    
    return {
        "status": checkout_status.status,
        "payment_status": checkout_status.payment_status,
        "plan": tx.get("plan"),
        "already_processed": False,
    }

@app.post("/api/webhook/stripe")
async def stripe_webhook(request: Request):
    stripe_api_key = os.environ.get("STRIPE_API_KEY")
    if not stripe_api_key:
        return {"status": "ignored"}
    body = await request.body()
    sig = request.headers.get("Stripe-Signature", "")
    stripe_checkout = StripeCheckout(api_key=stripe_api_key, webhook_url="")
    try:
        evt = await stripe_checkout.handle_webhook(body, sig)
    except Exception as e:
        print(f"Webhook error: {e}")
        return {"status": "error", "detail": str(e)}
    
    # Process paid sessions
    if evt.payment_status == "paid" and evt.session_id:
        tx = db.payment_transactions.find_one({"session_id": evt.session_id})
        if tx and tx.get("payment_status") != "paid":
            db.payment_transactions.update_one(
                {"session_id": evt.session_id},
                {"$set": {"payment_status": "paid", "updated_at": datetime.now(timezone.utc)}}
            )
            plan = tx.get("plan")
            account_oid = tx.get("account_id")
            now = datetime.now(timezone.utc)
            if account_oid:
                current_account = db.accounts.find_one({"_id": account_oid})
                if current_account:
                    existing_sub = current_account.get("subscription", {})
                    existing_end = existing_sub.get("subscription_end")
                    if existing_sub.get("status") == "active" and existing_end and existing_end > now:
                        new_end = existing_end + timedelta(days=30)
                    else:
                        new_end = now + timedelta(days=30)
                    db.accounts.update_one(
                        {"_id": account_oid},
                        {"$set": {
                            "subscription.plan": plan,
                            "subscription.status": "active",
                            "subscription.subscription_end": new_end,
                            "subscription.cancelled_at": None,
                        }}
                    )
    return {"status": "ok"}

@app.post("/api/subscription/cancel")
async def cancel_subscription(user: dict = Depends(get_current_user)):
    db.accounts.update_one(
        {"_id": get_account_oid(user)},
        {"$set": {"subscription.cancelled_at": datetime.now(timezone.utc)}}
    )
    return {"message": "Abo wird zum Ende der Laufzeit beendet"}

# ==================== ACCOUNT (TENANT SETTINGS) ENDPOINTS ====================

@app.get("/api/account/me")
async def get_account_me(user: dict = Depends(get_current_user)):
    account = db.accounts.find_one({"_id": get_account_oid(user)})
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    return {
        "_id": str(account["_id"]),
        "company_name": account.get("company_name", ""),
        "owner_email": account.get("owner_email", ""),
        "settings": account.get("settings", {}),
    }

@app.patch("/api/account/settings")
async def update_account_settings(update: AccountSettingsUpdate, user: dict = Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Nur Account-Inhaber kann Einstellungen ändern")
    
    data = update.dict()
    set_data = {}
    # Top-level fields
    if data.get("company_name") is not None:
        set_data["company_name"] = data["company_name"]
    # Settings sub-fields
    settings_keys = ["company_email", "phone", "website", "address", "city", "postal_code",
                     "country", "tax_id", "vat_id", "iban", "bic", "bank_name", "logo_url"]
    for k in settings_keys:
        if data.get(k) is not None:
            set_data[f"settings.{k}"] = data[k]
    if not set_data:
        raise HTTPException(status_code=400, detail="Keine Änderungen")
    
    db.accounts.update_one({"_id": get_account_oid(user)}, {"$set": set_data})
    account = db.accounts.find_one({"_id": get_account_oid(user)})
    return {
        "_id": str(account["_id"]),
        "company_name": account.get("company_name", ""),
        "owner_email": account.get("owner_email", ""),
        "settings": account.get("settings", {}),
    }

# ==================== DASHBOARD QUICK VIEW ====================

@app.get("/api/dashboard/upcoming-checkins")
async def upcoming_checkins(user: dict = Depends(get_current_user)):
    """Returns next upcoming check-ins (pending status) sorted by date."""
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    bookings = list(db.bookings.find({
        **tenant_filter(user),
        "status": "pending",
        "check_in_date": {"$gte": today}
    }).sort("check_in_date", ASCENDING).limit(10))
    
    for b in bookings:
        b["_id"] = str(b["_id"])
        b.pop("account_id", None)
    return bookings

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)