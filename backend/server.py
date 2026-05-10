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

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.environ.get("FRONTEND_URL", "http://localhost:3000")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# MongoDB
client = MongoClient(os.environ.get("MONGO_URL", "mongodb://localhost:27017"))
db = client[os.environ.get("DB_NAME", "test_database")]

JWT_ALGORITHM = "HS256"

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
    price: float
    deposit: float = 0.0
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
        user.pop("password_hash", None)
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

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
    
    # Seed admin
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@hotel.com")
    admin_password = os.environ.get("ADMIN_PASSWORD", "admin123")
    existing = db.users.find_one({"email": admin_email})
    
    if existing is None:
        hashed = hash_password(admin_password)
        db.users.insert_one({
            "email": admin_email,
            "password_hash": hashed,
            "name": "Admin",
            "role": "admin",
            "created_at": datetime.now(timezone.utc)
        })
    elif not verify_password(admin_password, existing["password_hash"]):
        db.users.update_one(
            {"email": admin_email},
            {"$set": {"password_hash": hash_password(admin_password)}}
        )
    
    # Create test users
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
                "created_at": datetime.now(timezone.utc)
            })
    
    # Write test credentials
    with open("/app/memory/test_credentials.md", "w") as f:
        f.write("# Test Credentials\n\n")
        f.write("## Admin Account\n")
        f.write(f"- Email: {admin_email}\n")
        f.write(f"- Password: {admin_password}\n")
        f.write(f"- Role: admin\n\n")
        f.write("## Rezeption Account\n")
        f.write("- Email: rezeption@hotel.com\n")
        f.write("- Password: rezeption123\n")
        f.write("- Role: rezeption\n\n")
        f.write("## Buchhaltung Account\n")
        f.write("- Email: buchhaltung@hotel.com\n")
        f.write("- Password: buchhaltung123\n")
        f.write("- Role: buchhaltung\n\n")
        f.write("## Endpoints\n")
        f.write("- POST /api/auth/register\n")
        f.write("- POST /api/auth/login\n")
        f.write("- POST /api/auth/logout\n")
        f.write("- GET /api/auth/me\n")

# Auth routes
@app.post("/api/auth/register")
async def register(user: UserRegister, response: Response):
    email = user.email.lower()
    existing = db.users.find_one({"email": email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    hashed = hash_password(user.password)
    result = db.users.insert_one({
        "email": email,
        "password_hash": hashed,
        "name": user.name,
        "role": user.role,
        "created_at": datetime.now(timezone.utc)
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
    bookings = list(db.bookings.find())
    for booking in bookings:
        booking["_id"] = str(booking["_id"])
    return bookings

@app.post("/api/bookings")
async def create_booking(booking: BookingCreate, user: dict = Depends(get_current_user)):
    booking_data = booking.dict()
    booking_data["status"] = "pending"
    booking_data["id_verified"] = False
    booking_data["id_data"] = None
    booking_data["created_at"] = datetime.now(timezone.utc)
    booking_data["created_by"] = user["_id"]
    
    result = db.bookings.insert_one(booking_data)
    booking_data["_id"] = str(result.inserted_id)
    
    # Send confirmation email
    await send_booking_confirmation_email(booking_data, booking.email)
    
    return booking_data

@app.get("/api/bookings/{booking_id}")
async def get_booking(booking_id: str, user: dict = Depends(get_current_user)):
    booking = db.bookings.find_one({"_id": ObjectId(booking_id)})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    booking["_id"] = str(booking["_id"])
    return booking

@app.patch("/api/bookings/{booking_id}")
async def update_booking(booking_id: str, update: BookingUpdate, user: dict = Depends(get_current_user)):
    update_data = {k: v for k, v in update.dict().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")
    
    result = db.bookings.update_one({"_id": ObjectId(booking_id)}, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    booking = db.bookings.find_one({"_id": ObjectId(booking_id)})
    booking["_id"] = str(booking["_id"])
    return booking

@app.delete("/api/bookings/{booking_id}")
async def delete_booking(booking_id: str, user: dict = Depends(get_current_user)):
    result = db.bookings.delete_one({"_id": ObjectId(booking_id)})
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
    
    result = db.bookings.update_one({"_id": ObjectId(booking_id)}, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    booking = db.bookings.find_one({"_id": ObjectId(booking_id)})
    booking["_id"] = str(booking["_id"])
    return booking

@app.post("/api/bookings/{booking_id}/check-out")
async def check_out(booking_id: str, user: dict = Depends(get_current_user)):
    booking = db.bookings.find_one({"_id": ObjectId(booking_id)})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    update_data = {
        "status": "checked_out",
        "check_out_time": datetime.now(timezone.utc)
    }
    
    db.bookings.update_one({"_id": ObjectId(booking_id)}, {"$set": update_data})
    
    # Create income entry
    db.accounting.insert_one({
        "category": "Buchung",
        "description": f"Check-out: {booking['guest_name']} - Zimmer {booking['room_number']}",
        "amount": booking["price"],
        "type": "income",
        "date": datetime.now(timezone.utc).isoformat(),
        "booking_id": str(booking["_id"]),
        "created_by": user["_id"],
        "created_at": datetime.now(timezone.utc)
    })
    
    booking["_id"] = str(booking["_id"])
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
    
    entries = list(db.accounting.find())
    for entry in entries:
        entry["_id"] = str(entry["_id"])
        if entry.get("booking_id"):
            entry["booking_id"] = str(entry["booking_id"])
    return entries

@app.post("/api/accounting")
async def create_accounting(entry: AccountingCreate, user: dict = Depends(get_current_user)):
    if user["role"] not in ["admin", "buchhaltung"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    entry_data = entry.dict()
    entry_data["created_by"] = user["_id"]
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
    
    result = db.accounting.update_one({"_id": ObjectId(entry_id)}, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Entry not found")
    
    entry = db.accounting.find_one({"_id": ObjectId(entry_id)})
    entry["_id"] = str(entry["_id"])
    return entry

@app.delete("/api/accounting/{entry_id}")
async def delete_accounting(entry_id: str, user: dict = Depends(get_current_user)):
    if user["role"] not in ["admin", "buchhaltung"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    result = db.accounting.delete_one({"_id": ObjectId(entry_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Entry not found")
    return {"message": "Entry deleted"}

@app.get("/api/accounting/export")
async def export_accounting(user: dict = Depends(get_current_user)):
    if user["role"] not in ["admin", "buchhaltung"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    entries = list(db.accounting.find({}, {"_id": 0}))
    return entries

# Dashboard stats
@app.get("/api/stats/dashboard")
async def dashboard_stats(user: dict = Depends(get_current_user)):
    total_bookings = db.bookings.count_documents({})
    checked_in = db.bookings.count_documents({"status": "checked_in"})
    pending = db.bookings.count_documents({"status": "pending"})
    
    # Revenue calculation
    income_pipeline = [
        {"$match": {"type": "income"}},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
    ]
    income_result = list(db.accounting.aggregate(income_pipeline))
    total_income = income_result[0]["total"] if income_result else 0
    
    expense_pipeline = [
        {"$match": {"type": "expense"}},
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
def generate_invoice_pdf(booking: dict) -> BytesIO:
    """Generate PDF invoice for a booking"""
    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4)
    elements = []
    styles = getSampleStyleSheet()
    
    # Hotel Info
    hotel_name = os.getenv("HOTEL_NAME", "Grand Hotel")
    hotel_address = os.getenv("HOTEL_ADDRESS", "Hauptstraße 123, 10115 Berlin")
    hotel_phone = os.getenv("HOTEL_PHONE", "+49 30 12345678")
    hotel_email = os.getenv("HOTEL_EMAIL", "info@hotel.com")
    
    # Title
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Heading1'],
        fontSize=24,
        textColor=colors.HexColor('#3b82f6'),
        spaceAfter=12
    )
    elements.append(Paragraph(hotel_name, title_style))
    elements.append(Paragraph(f"{hotel_address}<br/>{hotel_phone}<br/>{hotel_email}", styles['Normal']))
    elements.append(Spacer(1, 20))
    
    # Invoice Title
    elements.append(Paragraph("RECHNUNG", styles['Heading1']))
    elements.append(Spacer(1, 12))
    
    # Guest Info
    elements.append(Paragraph(f"<b>Gast:</b> {booking.get('guest_name', 'N/A')}", styles['Normal']))
    elements.append(Paragraph(f"<b>E-Mail:</b> {booking.get('email', 'N/A')}", styles['Normal']))
    elements.append(Paragraph(f"<b>Telefon:</b> {booking.get('phone', 'N/A')}", styles['Normal']))
    elements.append(Spacer(1, 20))
    
    # Booking Details Table
    data = [
        ['Beschreibung', 'Details', 'Betrag'],
        ['Zimmernummer', booking.get('room_number', 'N/A'), ''],
        ['Kategorie', booking.get('room_type', 'N/A'), ''],
        ['Check-In', booking.get('check_in_date', 'N/A'), ''],
        ['Check-Out', booking.get('check_out_date', 'N/A'), ''],
        ['Anzahl Gäste', str(booking.get('guests_count', 1)), ''],
        ['', '', ''],
        ['Übernachtungspreis', '', f"€{booking.get('price', 0):.2f}"],
    ]
    
    # Add deposit if exists
    deposit = booking.get('deposit', 0) or 0
    if deposit > 0:
        data.append(['Kaution (Sicherheitsleistung)', '', f"€{deposit:.2f}"])
        data.append(['', '', ''])
        data.append(['GESAMTBETRAG', '', f"€{(booking.get('price', 0) + deposit):.2f}"])
    else:
        data.append(['', '', ''])
        data.append(['GESAMTBETRAG', '', f"€{booking.get('price', 0):.2f}"])
    
    table = Table(data, colWidths=[60*mm, 70*mm, 40*mm])
    table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#3b82f6')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('ALIGN', (2, 0), (2, -1), 'RIGHT'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 12),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
        ('BACKGROUND', (0, -1), (-1, -1), colors.HexColor('#e5e7eb')),
        ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
        ('GRID', (0, 0), (-1, -2), 1, colors.grey),
        ('BOX', (0, -1), (-1, -1), 2, colors.black),
    ]))
    
    elements.append(table)
    elements.append(Spacer(1, 30))
    
    # Footer
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

async def send_push_to_all(booking_data: dict):
    """Send push notification about new booking to all subscribed users"""
    import json as json_lib
    
    payload = json_lib.dumps({
        "title": "🏨 Neue Buchung eingegangen!",
        "body": f"{booking_data.get('guest_name')} - {booking_data.get('room_type')} - €{booking_data.get('price', 0):.2f}",
        "icon": "https://customer-assets.emergentagent.com/wingman/359d1d25-501d-49ee-acdc-7ddd114c4b2b/attachments/abc94a5694cb4db0a3fad6a16ce20ec7_icon (1).png",
        "badge": "https://customer-assets.emergentagent.com/wingman/359d1d25-501d-49ee-acdc-7ddd114c4b2b/attachments/abc94a5694cb4db0a3fad6a16ce20ec7_icon (1).png",
        "tag": "new-booking",
        "data": {
            "url": "/bookings",
            "booking_id": booking_data.get("_id")
        }
    })
    
    subscriptions = list(db.push_subscriptions.find())
    for sub in subscriptions:
        subscription_info = {"endpoint": sub["endpoint"], "keys": sub["keys"]}
        try:
            success = await asyncio.to_thread(_send_push_sync, subscription_info, payload)
            if not success:
                db.push_subscriptions.delete_one({"_id": sub["_id"]})
        except Exception as e:
            print(f"Push failed: {str(e)}")

async def notify_new_booking(booking_data: dict):
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
    await send_push_to_all(booking_data)

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
    properties = list(db.properties.find())
    for p in properties:
        p["_id"] = str(p["_id"])
    return properties

@app.get("/api/public/properties")
async def get_public_properties():
    """Public endpoint to list properties for booking"""
    properties = list(db.properties.find({}, {"_id": 0, "created_by": 0}))
    return properties

@app.post("/api/properties")
async def create_property(prop: PropertyCreate, user: dict = Depends(get_current_user)):
    prop_data = prop.dict()
    prop_data["created_at"] = datetime.now(timezone.utc)
    prop_data["created_by"] = user["_id"]
    
    result = db.properties.insert_one(prop_data)
    prop_data["_id"] = str(result.inserted_id)
    return prop_data

@app.patch("/api/properties/{property_id}")
async def update_property(property_id: str, update: PropertyUpdate, user: dict = Depends(get_current_user)):
    update_data = {k: v for k, v in update.dict().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")
    
    result = db.properties.update_one({"_id": ObjectId(property_id)}, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Property not found")
    
    prop = db.properties.find_one({"_id": ObjectId(property_id)})
    prop["_id"] = str(prop["_id"])
    return prop

@app.delete("/api/properties/{property_id}")
async def delete_property(property_id: str, user: dict = Depends(get_current_user)):
    result = db.properties.delete_one({"_id": ObjectId(property_id)})
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
    """Get room availability for a date range"""
    try:
        # Get all bookings in the date range
        bookings = list(db.bookings.find({
            "$or": [
                {
                    "check_in_date": {"$lte": end_date},
                    "check_out_date": {"$gte": start_date}
                }
            ],
            "status": {"$in": ["pending", "checked_in"]}
        }))
        
        # Get occupied rooms
        occupied_rooms = {}
        for booking in bookings:
            room = booking["room_number"]
            if room not in occupied_rooms:
                occupied_rooms[room] = []
            occupied_rooms[room].append({
                "guest_name": booking["guest_name"],
                "check_in": booking["check_in_date"],
                "check_out": booking["check_out_date"],
                "status": booking["status"]
            })
        
        # Define available rooms (you can make this dynamic from a rooms collection)
        all_rooms = [f"{floor}{num:02d}" for floor in range(1, 4) for num in range(1, 11)]
        
        availability = []
        for room in all_rooms:
            availability.append({
                "room_number": room,
                "is_available": room not in occupied_rooms,
                "bookings": occupied_rooms.get(room, [])
            })
        
        return availability
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Invoice Download
@app.get("/api/bookings/{booking_id}/invoice")
async def download_invoice(booking_id: str, user: dict = Depends(get_current_user)):
    """Download PDF invoice for a booking"""
    try:
        booking = db.bookings.find_one({"_id": ObjectId(booking_id)})
        if not booking:
            raise HTTPException(status_code=404, detail="Booking not found")
        
        # Generate PDF
        pdf_buffer = generate_invoice_pdf(booking)
        
        return StreamingResponse(
            pdf_buffer,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f"attachment; filename=rechnung_{booking['room_number']}_{booking_id}.pdf"
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
    """Public endpoint for online bookings (no authentication required)"""
    try:
        # Check availability for the room type
        existing_bookings = db.bookings.count_documents({
            "room_type": booking.room_type,
            "$or": [
                {
                    "check_in_date": {"$lte": booking.check_out_date},
                    "check_out_date": {"$gte": booking.check_in_date}
                }
            ],
            "status": {"$in": ["pending", "checked_in"]}
        })
        
        # Get all rooms of this type (simplified: assume 5 rooms per type)
        max_rooms_per_type = 5
        if existing_bookings >= max_rooms_per_type:
            raise HTTPException(status_code=400, detail="Keine Zimmer verfügbar für diese Daten")
        
        # Assign a room number (simplified logic)
        room_number = f"{booking.room_type[0]}{existing_bookings + 1:02d}"
        
        # Calculate price based on input or defaults
        from datetime import datetime
        check_in = datetime.strptime(booking.check_in_date, "%Y-%m-%d")
        check_out = datetime.strptime(booking.check_out_date, "%Y-%m-%d")
        nights = (check_out - check_in).days
        
        # Use custom price if provided, otherwise use defaults
        if booking.price_per_night is not None and booking.price_per_night > 0:
            total_price = booking.price_per_night * nights
        else:
            price_per_night = {
                "Villa": 500,
                "Ferienhaus": 250,
                "Appartment": 120,
                "Zimmer": 80
            }
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
            "created_at": datetime.now(timezone.utc),
            "booking_source": "online"
        }
        
        result = db.bookings.insert_one(booking_data)
        booking_data["_id"] = str(result.inserted_id)
        
        # Send confirmation email
        await send_booking_confirmation_email(booking_data, booking.email)
        
        # Send WhatsApp notification to hotel staff
        await notify_new_booking(booking_data)
        
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

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)