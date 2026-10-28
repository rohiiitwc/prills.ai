import os
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import declarative_base
from backend.app.config import settings

# Ensure data directory exists if using local sqlite
db_url = settings.DATABASE_URL
if db_url.startswith("sqlite"):
    raw_path = db_url.replace("sqlite+aiosqlite:///", "")
    if raw_path.startswith("./"):
        project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
        db_file_path = os.path.normpath(os.path.join(project_root, raw_path[2:]))
        db_url = f"sqlite+aiosqlite:///{db_file_path.replace(os.sep, '/')}"
    else:
        db_file_path = os.path.abspath(raw_path)
    os.makedirs(os.path.dirname(db_file_path), exist_ok=True)

engine = create_async_engine(
    db_url,
    echo=False,
    future=True,
    # SQLite connection pooling configuration
    connect_args={"check_same_thread": False} if "sqlite" in db_url else {}
)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False
)

Base = declarative_base()

async def get_db():
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()

async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
