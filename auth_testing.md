# Authentication Testing Playbook

## Step 1: MongoDB Verification
```bash
mongosh
use <database_name>
db.users.find({role: "admin"}).pretty()
db.users.findOne({role: "admin"}, {password_hash: 1})
```
Verify: bcrypt hash starts with `$2b$`, indexes exist on users.email (unique), login_attempts.identifier, password_reset_tokens.expires_at (TTL).

## Step 2: API Testing
```bash
curl -c cookies.txt -X POST http://localhost:8001/api/auth/login -H "Content-Type: application/json" -d '{"email":"admin@example.com","password":"admin123"}'
cat cookies.txt
curl -b cookies.txt http://localhost:8001/api/auth/me
```

Login should return the user object and set `access_token` + `refresh_token` cookies. The `/me` call should return the same user using those cookies.

## Step 3: Role-Based Access Testing
Test that different user roles (Admin, Rezeption, Buchhaltung) have appropriate access levels.

## Step 4: Brute Force Protection
Attempt 5 failed logins, verify lockout is enforced for 15 minutes.
