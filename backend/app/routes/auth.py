import hashlib
import secrets
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_

from backend.app.database import get_db
from backend.app.models import UserAccount, utcnow
from backend.app.schemas import (
    UserRegisterRequest,
    UserLoginRequest,
    AuthResponse,
    UserResponse
)

router = APIRouter(prefix="/auth", tags=["Authentication"])

def hash_password(password: str) -> str:
    """Secure PBKDF2-HMAC-SHA256 password hashing with random salt."""
    salt = secrets.token_hex(16)
    key = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), 100000)
    return f"{salt}:{key.hex()}"

def verify_password(stored_hash: str, password: str) -> bool:
    """Verifies a plaintext password against the stored salt:hash string."""
    try:
        if not stored_hash or ":" not in stored_hash:
            return False
        salt, key_hex = stored_hash.split(":", 1)
        key = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), 100000)
        return secrets.compare_digest(key.hex(), key_hex)
    except Exception:
        return False

@router.post("/register", response_model=AuthResponse)
async def register_user(payload: UserRegisterRequest, db: AsyncSession = Depends(get_db)):
    """
    Registers a new user account with Name, Age, Email, and Password.
    Returns session token and user profile.
    """
    clean_email = payload.email.strip().lower()
    clean_name = payload.name.strip()

    if not clean_email or "@" not in clean_email:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Please provide a valid email address.")

    if len(payload.password) < 6:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Password must be at least 6 characters long.")

    if payload.age is not None and payload.age < 18:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="You must be at least 18 years old to access trading terminals.")

    # Check existing user by email
    stmt = select(UserAccount).where(UserAccount.email == clean_email)
    res = await db.execute(stmt)
    existing = res.scalar_one_or_none()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An account with this email already exists. Please switch to Sign In."
        )

    # Create user
    pw_hash = hash_password(payload.password)
    user = UserAccount(
        name=clean_name,
        email=clean_email,
        password_hash=pw_hash,
        age=payload.age,
        is_active=True,
        last_login_at=utcnow()
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    token = f"prills_sess_{secrets.token_urlsafe(32)}"

    return AuthResponse(
        success=True,
        message=f"Account created successfully! Welcome to PRILLS.AI, {user.name}.",
        token=token,
        user=UserResponse(
            id=user.id,
            name=user.name,
            email=user.email,
            age=user.age,
            created_at=user.created_at
        )
    )

@router.post("/login", response_model=AuthResponse)
async def login_user(payload: UserLoginRequest, db: AsyncSession = Depends(get_db)):
    """
    Authenticates an existing user by Name, Email, and Password.
    If the account does not exist yet but valid name, email, and password are provided,
    gracefully auto-onboards the user into the terminal.
    """
    clean_email = payload.email.strip().lower()
    clean_name = (payload.name or "").strip()

    if not clean_email or "@" not in clean_email:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Please enter a valid email address.")

    if not payload.password:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Password is required.")

    # Find user by email
    stmt = select(UserAccount).where(UserAccount.email == clean_email)
    res = await db.execute(stmt)
    user = res.scalar_one_or_none()

    if user:
        if not verify_password(user.password_hash, payload.password):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect password. Please verify your credentials and try again."
            )
        # Update last login
        user.last_login_at = utcnow()
        if clean_name and clean_name != user.name:
            user.name = clean_name
        await db.commit()
        await db.refresh(user)
    else:
        # Graceful onboarding: if user entered their name, email, and password in section 1
        # auto-create their account and grant access!
        disp_name = clean_name if clean_name else clean_email.split("@")[0].capitalize()
        pw_hash = hash_password(payload.password)
        user = UserAccount(
            name=disp_name,
            email=clean_email,
            password_hash=pw_hash,
            age=21, # Default legal adult age
            is_active=True,
            last_login_at=utcnow()
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)

    token = f"prills_sess_{secrets.token_urlsafe(32)}"

    return AuthResponse(
        success=True,
        message=f"Welcome to PRILLS.AI Trading Terminal, {user.name}!",
        token=token,
        user=UserResponse(
            id=user.id,
            name=user.name,
            email=user.email,
            age=user.age,
            created_at=user.created_at
        )
    )

