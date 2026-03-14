from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

# SQLite-ot használunk a fejlesztés elején
SQLALCHEMY_DATABASE_URL = "sqlite:///./napelem_rendszer.db"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Ez az a Base, amit hiányolt a rendszer!
Base = declarative_base()

# Függőség az adatbázis eléréséhez a végpontokon


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
