from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Text
from sqlalchemy.orm import relationship
from database import Base
import datetime


class User(Base):
    __tablename__ = "felhasznalo"  # Kisbetűvel, ahogy az SQL-ben van

    id = Column("Felhasznalo_ID", Integer, primary_key=True, index=True)
    username = Column("Felhasznalonev", String(30),
                      unique=True, nullable=False)
    password_hash = Column("Jelszo", String(
        255), nullable=False)  # Bcrypt-nek kell a 255
    role = Column("Pozicio", String(30))


class Part(Base):
    __tablename__ = "alkatresz"  # Kisbetűvel
    id = Column("Alkatresz_ID", Integer, primary_key=True, index=True)
    name = Column("Nev", String(100), nullable=False)
    price = Column("Ar", Integer, nullable=False)
    max_per_slot = Column("Rekesz_Max_Mennyiseg", Integer, nullable=False)


class WarehouseSlot(Base):
    __tablename__ = "rekesz"  # Kisbetűvel
    id = Column("Rekesz_ID", Integer, primary_key=True, index=True)
    readable_id = Column("Readable_ID", String(20),
                         unique=True, nullable=False)
    row_num = Column("Sor", Integer, nullable=False)
    col_num = Column("Oszlop", Integer, nullable=False)
    level_num = Column("Szint", Integer, nullable=False)
    rekesz_num = Column("Rekesz_Szam", Integer, nullable=False)
    # A ForeignKey-ben a táblanév.oszlopnév formátumot használjuk:
    part_id = Column("Alkatresz_ID", Integer, ForeignKey(
        "alkatresz.Alkatresz_ID"), nullable=True)
    current_quantity = Column("Mennyiseg", Integer, default=0)

    part = relationship("Part")


class KeszletNaplo(Base):
    __tablename__ = "keszlet_naplo"  # Kisbetűvel
    id = Column("Naplo_ID", Integer, primary_key=True, index=True)
    rekesz_id = Column("Rekesz_ID", Integer, ForeignKey("rekesz.Rekesz_ID"))
    part_id = Column("Alkatresz_ID", Integer,
                     ForeignKey("alkatresz.Alkatresz_ID"))
    user_id = Column("Felhasznalo_ID", Integer,
                     ForeignKey("felhasznalo.Felhasznalo_ID"))
    type = Column("Tipus", String(30))
    quantity = Column("Mennyiseg", Integer)
    timestamp = Column("Datum", DateTime, default=datetime.datetime.utcnow)


class Projekt(Base):
    __tablename__ = "projekt"
    id = Column("Projekt_ID", Integer, primary_key=True, index=True)
    customer_info = Column("Megrendelo_Adatok", String(100), nullable=False)
    location = Column("Helyszin", String(150), nullable=False)
    description = Column("Leiras", Text)
    status = Column("Statusz", String(20), default="New")
    estimated_time = Column("Becsult_ido", Integer)
    price = Column("Ar", Integer)


class ProjektNaplo(Base):
    __tablename__ = "projekt_naplo"
    id = Column("Naplo_ID", Integer, primary_key=True, index=True)
    projekt_id = Column("Projekt_ID", Integer,
                        ForeignKey("projekt.Projekt_ID"))
    status = Column("Statusz", String(20))
    timestamp = Column("Datum", DateTime, default=datetime.datetime.utcnow)


class ProjektAlkatresz(Base):
    __tablename__ = "projekt_alkatresz"
    id = Column("Foglalas_ID", Integer, primary_key=True, index=True)
    projekt_id = Column("Projekt_ID", Integer,
                        ForeignKey("projekt.Projekt_ID"))
    part_id = Column("Alkatresz_ID", Integer,
                     ForeignKey("alkatresz.Alkatresz_ID"))
    required_quantity = Column("Szukseges_Mennyiseg", Integer, default=0)
    reserved_quantity = Column("Lefoglalt_Mennyiseg", Integer, default=0)
    preorder_quantity = Column("Elofoglalt_Mennyiseg", Integer, default=0)
    fixed_price = Column("Egysegar_Rogzitve", Integer)
