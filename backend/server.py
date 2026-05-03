from dotenv import load_dotenv
load_dotenv()

import os
import bcrypt
import jwt
import base64
import secrets
from datetime import datetime, timezone, timedelta
from typing import Optional, List
from io import BytesIO

from fastapi import FastAPI, HTTPException, Request, Response, UploadFile, File, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr, Field
from pymongo import MongoClient, ASCENDING
from bson import ObjectId
from PIL import Image

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
    guests_count: Optional[int] = None
    status: Optional[str] = None

class AccountingCreate(BaseModel):
    category: str
    description: str
    amount: float
    type: str
    date: str
    booking_id: Optional[str] = None

class AccountingUpdate(BaseModel):
    category: Optional[str] = None
    description: Optional[str] = None
    amount: Optional[float] = None
    type: Optional[str] = None
    date: Optional[str] = None

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

@app.get("/")
async def root():
    return {"message": "Hotel Management API"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)