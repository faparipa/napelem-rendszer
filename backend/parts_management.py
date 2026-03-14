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
    if current_user.role != "Raktárvezető" and not current_user.is_admin:
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


@router.post("/warehouse/generate")
def generate_warehouse(
    rows: int,
    cols: int,
    levels: int,
    db: Session = Depends(database.get_db),
    admin: models.User = Depends(auth.require_admin)
):
    """
    Legenerálja a raktárhelyeket (pl. 5 sor, 10 oszlop, 3 szint).
    Csak Admin hívhatja meg.
    """
    # Ellenőrizzük, van-e már adat (hogy ne duplikáljunk véletlenül)
    existing = db.query(models.WarehouseSlot).first()
    if existing:
        raise HTTPException(
            status_code=400, detail="A raktár már fel van töltve helyekkel!")

    slots_created = 0
    for r in range(1, rows + 1):
        for c in range(1, cols + 1):
            for l in range(1, levels + 1):
                # Egyedi azonosító, pl: "S01-O02-SZ03"
                readable_id = f"S{r:02d}-O{c:02d}-SZ{l:02d}"

                new_slot = models.WarehouseSlot(
                    row_num=r,
                    col_num=c,
                    level_num=l,
                    readable_id=readable_id,
                    current_quantity=0
                )
                db.add(new_slot)
                slots_created += 1

    db.commit()
    return {"message": f"Sikeresen legenerálva {slots_created} raktárhely."}


@router.get("/warehouse/slots", response_model=List[dict])
def get_warehouse_slots(db: Session = Depends(database.get_db)):
    """Kilistázza az összes raktárhelyet és azok tartalmát."""
    return db.query(models.WarehouseSlot).all()
