import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from fastapi import HTTPException

from backend.app.database import Base
from backend.app.schemas import UserRegisterRequest, UserLoginRequest, UserResetPasswordRequest
from backend.app.routes.auth import register_user, login_user, reset_password, hash_password, verify_password

@pytest_asyncio.fixture
async def test_db():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
    SessionLocal = async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)
    async with SessionLocal() as session:
        yield session
    
    await engine.dispose()

def test_password_hashing():
    pw = "SuperSecure123"
    hashed = hash_password(pw)
    assert verify_password(hashed, pw) is True
    assert verify_password(hashed, "WrongPassword") is False
    assert verify_password("", pw) is False

@pytest.mark.asyncio
async def test_user_registration(test_db: AsyncSession):
    # 1. Successful registration
    req = UserRegisterRequest(
        name="Alex Morgan",
        age=24,
        email="alex@prills.ai",
        password="MySecretPassword123"
    )
    res = await register_user(payload=req, db=test_db)
    assert res.success is True
    assert res.user.name == "Alex Morgan"
    assert res.user.email == "alex@prills.ai"
    assert res.user.age == 24
    assert res.token.startswith("prills_sess_")

    # 2. Reject duplicate email
    with pytest.raises(HTTPException) as exc:
        await register_user(payload=req, db=test_db)
    assert exc.value.status_code == 400
    assert "already exists" in exc.value.detail

    # 3. Reject underage trader (< 18) via Pydantic or endpoint validation
    from pydantic import ValidationError
    with pytest.raises((HTTPException, ValidationError)):
        underage_req = UserRegisterRequest(
            name="Junior Trader",
            age=16,
            email="junior@prills.ai",
            password="Password123"
        )
        await register_user(payload=underage_req, db=test_db)

@pytest.mark.asyncio
async def test_user_login(test_db: AsyncSession):
    # 1. Register first
    reg = UserRegisterRequest(
        name="Sarah Connor",
        age=28,
        email="sarah@prills.ai",
        password="CorrectPassword123"
    )
    await register_user(payload=reg, db=test_db)

    # 2. Valid Login
    login_req = UserLoginRequest(
        name="Sarah Connor",
        email="sarah@prills.ai",
        password="CorrectPassword123"
    )
    login_res = await login_user(payload=login_req, db=test_db)
    assert login_res.success is True
    assert login_res.user.name == "Sarah Connor"
    assert login_res.user.email == "sarah@prills.ai"

    # 3. Invalid Password
    bad_pw_req = UserLoginRequest(
        name="Sarah Connor",
        email="sarah@prills.ai",
        password="WrongPassword999"
    )
    with pytest.raises(HTTPException) as exc:
        await login_user(payload=bad_pw_req, db=test_db)
    assert exc.value.status_code == 401
    assert "Password incorrect" in exc.value.detail or "Wrong password" in exc.value.detail

@pytest.mark.asyncio
async def test_user_reset_password(test_db: AsyncSession):
    # 1. Register user
    reg = UserRegisterRequest(
        name="James Cole",
        age=30,
        email="james@prills.ai",
        password="OldPassword123"
    )
    await register_user(payload=reg, db=test_db)

    # 2. Reset password
    reset_req = UserResetPasswordRequest(
        email="james@prills.ai",
        new_password="NewSecretPassword456"
    )
    res = await reset_password(payload=reset_req, db=test_db)
    assert res.success is True
    assert res.user.name == "James Cole"

    # 3. Old password fails
    bad_login = UserLoginRequest(
        name="James Cole",
        email="james@prills.ai",
        password="OldPassword123"
    )
    with pytest.raises(HTTPException) as exc:
        await login_user(payload=bad_login, db=test_db)
    assert exc.value.status_code == 401
    assert "Password incorrect" in exc.value.detail or "Wrong password" in exc.value.detail

    # 4. New password succeeds
    good_login = UserLoginRequest(
        name="James Cole",
        email="james@prills.ai",
        password="NewSecretPassword456"
    )
    login_res = await login_user(payload=good_login, db=test_db)
    assert login_res.success is True
    assert login_res.user.email == "james@prills.ai"
