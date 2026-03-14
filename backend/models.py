from sqlalchemy import Column, Integer, String, Boolean, Float, ForeignKey
from database import Base  # <--- Ez oldja meg a hibát!


class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    password_hash = Column(String)
    # 'Szakember', 'Raktárvezető', 'Raktáros' [cite: 43, 52, 59]
    role = Column(String)
    is_admin = Column(Boolean, default=False)  # Az admin jogkör [cite: 68]


class Part(Base):
    __tablename__ = "parts"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String)
    price = Column(Float)
    max_per_slot = Column(Integer)  # [cite: 53]


class WarehouseSlot(Base):
    __tablename__ = "warehouse_slots"
    id = Column(Integer, primary_key=True, index=True)
    row_num = Column(Integer)  # Sor [cite: 8]
    col_num = Column(Integer)  # Oszlop [cite: 8]
    level_num = Column(Integer)  # Szint [cite: 8]
    readable_id = Column(String, unique=True)  # [cite: 8]
    part_id = Column(Integer, ForeignKey("parts.id"), nullable=True)
    current_quantity = Column(Integer, default=0)
