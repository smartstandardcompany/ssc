from fastapi import APIRouter, HTTPException, Depends, Request
from typing import List, Optional
from datetime import datetime, timezone, timedelta
import uuid
import secrets

from database import db, hash_password, verify_password, create_access_token, get_current_user
from models import User, UserCreate, UserUpdate, UserLogin, Token, Category, CategoryCreate, PasswordReset, ForgotPasswordRequest, ResetPasswordWithToken, ChangePassword

router = APIRouter()


# Seed admin endpoint - creates default admin if none exists
@router.post("/auth/seed-admin")
@router.get("/auth/seed-admin")
async def seed_admin():
    """Create default admin user if none exists. Safe to call multiple times."""
    try:
        # Test DB connection first
        try:
            await db.command("ping")
        except Exception as e:
            return {"error": f"MongoDB connection failed: {str(e)}", "hint": "Check MONGO_URL env var"}

        admin = await db.users.find_one({"email": "ss@ssc.com"}, {"_id": 0})
        if admin:
            if "hashed_password" in admin and "password" not in admin:
                await db.users.update_one(
                    {"email": "ss@ssc.com"},
                    {"$set": {"password": admin["hashed_password"]}, "$unset": {"hashed_password": ""}}
                )
                return {"message": "Admin user fixed (password field updated)", "email": "ss@ssc.com"}
            return {"message": "Admin user already exists", "email": "ss@ssc.com"}

        hashed = hash_password("Aa147258369Ssc@")
        admin_user = {
            "id": str(uuid.uuid4()),
            "email": "ss@ssc.com",
            "password": hashed,
            "name": "SSC Admin",
            "role": "admin",
            "is_active": True,
            "permissions": [
                "sales", "expenses", "suppliers", "customers", "employees",
                "reports", "settings", "invoices", "stock", "partners",
                "documents", "branches", "transfers", "credit_report",
                "supplier_report", "schedule", "leave", "fines", "loans",
                "users", "kitchen", "shifts"
            ],
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.users.insert_one(admin_user)
        return {"message": "Admin user created successfully", "email": "ss@ssc.com", "password_hint": "Aa147258369Ssc@"}
    except Exception as e:
        return {"error": str(e), "type": type(e).__name__}

# Auth Routes
@router.post("/auth/register", response_model=Token)
async def register(user_data: UserCreate):
    existing_user = await db.users.find_one({"email": user_data.email}, {"_id": 0})
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    user_count = await db.users.count_documents({})
    role = "admin" if user_count == 0 else user_data.role or "operator"
    if role == "admin":
        permissions = ["sales", "expenses", "reports", "branches", "customers", "suppliers", "users", "stock", "kitchen", "shifts"]
    elif role == "manager":
        permissions = ["sales", "expenses", "reports", "branches", "customers", "suppliers", "stock", "kitchen", "shifts"]
    else:
        permissions = ["sales", "expenses"]
    user = User(email=user_data.email, name=user_data.name, role=role, branch_id=user_data.branch_id, permissions=user_data.permissions or permissions)
    user_dict = user.model_dump()
    user_dict["password"] = hash_password(user_data.password)
    user_dict["created_at"] = user_dict["created_at"].isoformat()
    await db.users.insert_one(user_dict)
    access_token = create_access_token(data={"sub": user.id})
    return Token(access_token=access_token, token_type="bearer", user=user)

@router.post("/auth/login", response_model=Token)
async def login(credentials: UserLogin, request: Request):
    user_doc = await db.users.find_one({"email": {"$regex": f"^{credentials.email}$", "$options": "i"}}, {"_id": 0})
    if not user_doc:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    # Support both 'password' and legacy 'hashed_password' field names
    stored_pw = user_doc.get("password") or user_doc.get("hashed_password", "")
    if not stored_pw or not verify_password(credentials.password, stored_pw):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    # Check if user is linked to an employee with a job title → apply job title permissions
    employee = await db.employees.find_one({"user_id": user_doc["id"]}, {"_id": 0})
    if employee and employee.get("job_title_id"):
        job_title = await db.job_titles.find_one({"id": employee["job_title_id"]}, {"_id": 0})
        if job_title and job_title.get("permissions"):
            jt_perms = job_title["permissions"]
            existing_perms = set(user_doc.get("permissions", []))
            merged = list(existing_perms | set(jt_perms))
            if set(merged) != existing_perms:
                await db.users.update_one({"id": user_doc["id"]}, {"$set": {"permissions": merged}})
                user_doc["permissions"] = merged
    # Check if password change is required
    must_change = user_doc.get("must_change_password", False)
    user = User(**{k: v for k, v in user_doc.items() if k != "password"})
    access_token = create_access_token(data={"sub": user.id})
    
    # Log login activity
    from routers.activity_logs import log_activity
    await log_activity(user, "login", "auth", request=request)
    
    return Token(access_token=access_token, token_type="bearer", user=user, must_change_password=must_change)

@router.get("/auth/me", response_model=User)
async def get_me(current_user: User = Depends(get_current_user)):
    return current_user

# User Management Routes
@router.get("/users", response_model=List[User])
async def get_users(current_user: User = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    users = await db.users.find({}, {"_id": 0, "password": 0}).to_list(1000)
    for user in users:
        if isinstance(user.get('created_at'), str):
            user['created_at'] = datetime.fromisoformat(user['created_at'])
    return users

@router.post("/users", response_model=User)
async def create_user(user_data: UserCreate, current_user: User = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    existing_user = await db.users.find_one({"email": user_data.email}, {"_id": 0})
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    if user_data.role == "admin":
        permissions = ["sales", "expenses", "reports", "branches", "customers", "suppliers", "users"]
    elif user_data.role == "manager":
        permissions = ["sales", "expenses", "reports", "branches", "customers", "suppliers"]
    else:
        permissions = ["sales", "expenses"]
    user = User(email=user_data.email, name=user_data.name, role=user_data.role or "operator", branch_id=user_data.branch_id, permissions=user_data.permissions or permissions)
    user_dict = user.model_dump()
    user_dict["password"] = hash_password(user_data.password)
    user_dict["created_at"] = user_dict["created_at"].isoformat()
    await db.users.insert_one(user_dict)
    return user

@router.put("/users/{user_id}", response_model=User)
async def update_user(user_id: str, user_update: UserUpdate, current_user: User = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    result = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not result:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Protect the main admin account from being modified
    if result.get("email") == "ss@ssc.com":
        # Only allow updating non-critical fields for protected admin
        allowed_fields = {"name"}
        update_data = {k: v for k, v in user_update.model_dump().items() if v is not None and k in allowed_fields}
        if not update_data:
            raise HTTPException(status_code=403, detail="This admin account is protected. Only name can be updated.")
    else:
        update_data = {k: v for k, v in user_update.model_dump().items() if v is not None}
    
    if update_data:
        await db.users.update_one({"id": user_id}, {"$set": update_data})
    updated = await db.users.find_one({"id": user_id}, {"_id": 0, "password": 0})
    if isinstance(updated.get('created_at'), str):
        updated['created_at'] = datetime.fromisoformat(updated['created_at'])
    return User(**updated)

# Protected admin email - cannot be deleted or password changed
PROTECTED_ADMIN_EMAIL = "ss@ssc.com"

@router.delete("/users/{user_id}")
async def delete_user(user_id: str, current_user: User = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")
    
    # Check if trying to delete protected admin
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if user and user.get("email") == PROTECTED_ADMIN_EMAIL:
        raise HTTPException(status_code=403, detail="This admin account is protected and cannot be deleted")
    
    result = await db.users.delete_one({"id": user_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    return {"message": "User deleted successfully"}

# Category Management Routes
@router.get("/categories")
async def get_categories(category_type: Optional[str] = None, current_user: User = Depends(get_current_user)):
    query = {}
    if category_type:
        query["type"] = category_type
    categories = await db.categories.find(query, {"_id": 0}).to_list(1000)
    for category in categories:
        if isinstance(category.get('created_at'), str):
            category['created_at'] = datetime.fromisoformat(category['created_at'])
    return categories

@router.post("/categories", response_model=Category)
async def create_category(category_data: CategoryCreate, current_user: User = Depends(get_current_user)):
    existing = await db.categories.find_one({"name": category_data.name, "type": category_data.type}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="Category already exists")
    category = Category(**category_data.model_dump())
    category_dict = category.model_dump()
    category_dict["created_at"] = category_dict["created_at"].isoformat()
    await db.categories.insert_one(category_dict)
    return category

@router.delete("/categories/{category_id}")
async def delete_category(category_id: str, current_user: User = Depends(get_current_user)):
    result = await db.categories.delete_one({"id": category_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Category not found")
    return {"message": "Category deleted successfully"}


# ============== PASSWORD MANAGEMENT ==============

# Admin resets user password
@router.put("/users/{user_id}/reset-password")
async def admin_reset_password(user_id: str, data: PasswordReset, current_user: User = Depends(get_current_user)):
    """Admin endpoint to reset a user's password."""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Protect the main admin account
    if user.get("email") == PROTECTED_ADMIN_EMAIL:
        raise HTTPException(status_code=403, detail="This admin account's password is protected and cannot be changed")
    
    if len(data.new_password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
    
    hashed = hash_password(data.new_password)
    await db.users.update_one(
        {"id": user_id},
        {"$set": {"password": hashed, "must_change_password": data.must_change_on_login}}
    )
    return {"message": f"Password reset successfully. User {'must' if data.must_change_on_login else 'does not need to'} change password on next login."}


# User changes their own password
@router.post("/auth/change-password")
async def change_password(data: ChangePassword, current_user: User = Depends(get_current_user)):
    """Endpoint for users to change their own password."""
    user_doc = await db.users.find_one({"id": current_user.id}, {"_id": 0})
    if not user_doc:
        raise HTTPException(status_code=404, detail="User not found")
    
    # If forced change, current password is optional
    must_change = user_doc.get("must_change_password", False)
    if not must_change and data.current_password:
        stored_pw = user_doc.get("password") or user_doc.get("hashed_password", "")
        if not verify_password(data.current_password, stored_pw):
            raise HTTPException(status_code=401, detail="Current password is incorrect")
    elif not must_change and not data.current_password:
        raise HTTPException(status_code=400, detail="Current password is required")
    
    if len(data.new_password) < 6:
        raise HTTPException(status_code=400, detail="New password must be at least 6 characters")
    
    hashed = hash_password(data.new_password)
    await db.users.update_one(
        {"id": current_user.id},
        {"$set": {"password": hashed, "must_change_password": False}}
    )
    return {"message": "Password changed successfully"}


# Forgot password - send reset email
@router.post("/auth/forgot-password")
async def forgot_password(data: ForgotPasswordRequest):
    """Send password reset email to user."""
    user = await db.users.find_one({"email": {"$regex": f"^{data.email}$", "$options": "i"}}, {"_id": 0})
    # Always return success to prevent email enumeration
    if not user:
        return {"message": "If an account exists with this email, a reset link has been sent."}
    
    # Generate reset token (valid for 1 hour)
    token = secrets.token_urlsafe(32)
    expires_at = datetime.now(timezone.utc) + timedelta(hours=1)
    
    await db.password_reset_tokens.delete_many({"user_id": user["id"]})  # Remove old tokens
    await db.password_reset_tokens.insert_one({
        "token": token,
        "user_id": user["id"],
        "email": user["email"],
        "expires_at": expires_at.isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    # Send email
    try:
        import aiosmtplib
        from email.mime.text import MIMEText
        settings = await db.email_settings.find_one({}, {"_id": 0})
        if settings and settings.get("smtp_host") and settings.get("password"):
            # Get frontend URL from environment or use default
            import os
            frontend_url = os.environ.get("FRONTEND_URL", "https://ssc-track-erp-4.preview.emergentagent.com")
            reset_link = f"{frontend_url}/reset-password?token={token}"
            
            body = f"""Hello {user['name']},

You requested to reset your password for SSC Track.

Click the link below to reset your password:
{reset_link}

This link will expire in 1 hour.

If you did not request this, please ignore this email.

Best regards,
SSC Track Team"""
            
            msg = MIMEText(body)
            msg["Subject"] = "SSC Track - Password Reset Request"
            msg["From"] = settings.get("from_email", settings["username"])
            msg["To"] = user["email"]
            
            await aiosmtplib.send(
                msg,
                hostname=settings["smtp_host"],
                port=settings["smtp_port"],
                username=settings["username"],
                password=settings["password"],
                use_tls=settings.get("use_tls", True)
            )
    except Exception as e:
        # Log error but don't expose to user
        print(f"Failed to send reset email: {e}")
    
    return {"message": "If an account exists with this email, a reset link has been sent."}


# Reset password with token
@router.post("/auth/reset-password")
async def reset_password_with_token(data: ResetPasswordWithToken):
    """Reset password using token from email."""
    token_doc = await db.password_reset_tokens.find_one({"token": data.token}, {"_id": 0})
    if not token_doc:
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")
    
    expires_at = datetime.fromisoformat(token_doc["expires_at"])
    if datetime.now(timezone.utc) > expires_at:
        await db.password_reset_tokens.delete_one({"token": data.token})
        raise HTTPException(status_code=400, detail="Reset token has expired")
    
    if len(data.new_password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
    
    hashed = hash_password(data.new_password)
    await db.users.update_one(
        {"id": token_doc["user_id"]},
        {"$set": {"password": hashed, "must_change_password": False}}
    )
    
    # Delete used token
    await db.password_reset_tokens.delete_one({"token": data.token})
    
    return {"message": "Password has been reset successfully. You can now login with your new password."}


# Validate reset token (for frontend)
@router.get("/auth/validate-reset-token/{token}")
async def validate_reset_token(token: str):
    """Check if a reset token is valid."""
    token_doc = await db.password_reset_tokens.find_one({"token": token}, {"_id": 0})
    if not token_doc:
        return {"valid": False, "message": "Invalid token"}
    
    expires_at = datetime.fromisoformat(token_doc["expires_at"])
    if datetime.now(timezone.utc) > expires_at:
        await db.password_reset_tokens.delete_one({"token": token})
        return {"valid": False, "message": "Token has expired"}
    
    return {"valid": True, "email": token_doc["email"]}
