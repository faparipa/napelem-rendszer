from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List
import models
import database
import auth

router = APIRouter(tags=["Parts Management"])

# --- SÉMÁK ---


class PartCreate(BaseModel):
    name: str
    price: float
    max_per_slot: int


class PartUpdate(BaseModel):
    price: float


class PartOut(BaseModel):
    id: int
    name: str
    price: float
    max_per_slot: int

    class Config:
        from_attributes = True

# --- JOGOSULTSÁG ELLENŐRZŐ ---


def require_warehouse_manager(current_user: models.User = Depends(auth.get_current_user)):
    # Csak Raktárvezető vagy Admin végezheti
    if current_user.role != "Raktárvezető" and current_user.role != "Adminisztrator":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Ehhez a művelethez Raktárvezetői jogosultság szükséges!"
        )
    return current_user

# --- VÉGPONTOK ---

# B.1: Új alkatrész felvétele


@router.post("/parts", response_model=PartOut, status_code=status.HTTP_201_CREATED)
def create_part(
    part_data: PartCreate,
    db: Session = Depends(database.get_db),
    manager: models.User = Depends(require_warehouse_manager)
):
    # Ellenőrizzük, létezik-e már ilyen nevű alkatrész
    existing_part = db.query(models.Part).filter(
        models.Part.name == part_data.name).first()
    if existing_part:
        raise HTTPException(
            status_code=400, detail="Ez az alkatrész már szerepel a rendszerben.")

    new_part = models.Part(
        name=part_data.name,
        price=part_data.price,
        max_per_slot=part_data.max_per_slot
    )
    db.add(new_part)
    db.commit()
    db.refresh(new_part)
    return new_part

# B.2: Alkatrész árának módosítása


@router.patch("/parts/{part_id}")
def update_part_price(
    part_id: int,
    part_update: PartUpdate,
    db: Session = Depends(database.get_db),
    manager: models.User = Depends(require_warehouse_manager)
):
    part = db.query(models.Part).filter(models.Part.id == part_id).first()
    if not part:
        raise HTTPException(status_code=404, detail="Alkatrész nem található.")

    part.price = part_update.price
    db.commit()
    return {"message": "Ár sikeresen frissítve", "new_price": part.price}

# Alkatrészek listázása (mindenkinek, aki be van jelentkezve)


@router.get("/parts", response_model=List[PartOut])
def list_parts(
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    return db.query(models.Part).all()
