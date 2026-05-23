from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func
from pydantic import BaseModel
from typing import Optional
import models
import database
from auth import get_current_user

router = APIRouter(prefix="/expert", tags=["Szakember"])

# --- Sémák ---


class ProjectCreate(BaseModel):
    location: str
    description: Optional[str] = None
    customer_name: str
    customer_phone: str


class FinalizeSchema(BaseModel):
    estimated_time: int
    price: int


# 1. Új projekt létrehozása („New”)
@router.post("/projects")
def create_project(data: ProjectCreate, db: Session = Depends(database.get_db), current_user: models.User = Depends(get_current_user)):
    try:
        full_customer_data = f"{data.customer_name} ({data.customer_phone})"

        new_project = models.Projekt(
            location=data.location,
            description=data.description,
            customer_info=full_customer_data,
            status="New"
        )

        db.add(new_project)
        db.commit()
        db.refresh(new_project)

        # FIX: Bejegyezzük a létrehozó felhasználót és a kezdő üzenetet
        db.add(models.ProjektNaplo(
            projekt_id=new_project.id,
            status="New",
            user_id=current_user.id,

        ))
        db.commit()

        return new_project
    except Exception as e:
        db.rollback()
        print(f"Hiba: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# 2. Projektek listázása
@router.get("/projects")
def get_expert_projects(status: Optional[str] = None, db: Session = Depends(database.get_db)):
    query = db.query(models.Projekt)
    if status:
        query = query.filter(models.Projekt.status == status)
    return query.all()


# 3. Alkatrészek listázása készletadatokkal
@router.get("/parts-with-stock")
def get_parts_stock(db: Session = Depends(database.get_db)):
    stock_query = db.query(
        models.Part.id,
        models.Part.name,
        models.Part.price,
        func.sum(models.WarehouseSlot.current_quantity).label("total_stock")
    ).outerjoin(models.WarehouseSlot, models.Part.id == models.WarehouseSlot.part_id)\
     .group_by(models.Part.id).all()

    return [
        {"id": p.id, "name": p.name, "price": p.price, "stock": p.total_stock or 0}
        for p in stock_query
    ]


# 4. Alkatrész hozzáadása a projekthez (Átvált „Draft”-ra)
@router.post("/projects/{p_id}/parts")
def add_or_update_project_part(p_id: int, data: dict, db: Session = Depends(database.get_db), current_user: models.User = Depends(get_current_user)):
    project = db.query(models.Projekt).filter(
        models.Projekt.id == p_id).first()

    if not project:
        raise HTTPException(status_code=404, detail="A projekt nem található!")

    if project.status in ["Completed", "Failed"]:
        raise HTTPException(
            status_code=400,
            detail="Ez a projekt már lezárult, nem módosítható!"
        )

    existing = db.query(models.ProjektAlkatresz).filter(
        models.ProjektAlkatresz.projekt_id == p_id,
        models.ProjektAlkatresz.part_id == data['part_id']
    ).first()

    if existing:
        existing.required_quantity += data['quantity']
    else:
        new_item = models.ProjektAlkatresz(
            projekt_id=p_id,
            part_id=data['part_id'],
            required_quantity=data['quantity']
        )
        db.add(new_item)

    if project.status == "New":
        project.status = "Draft"
        # FIX: user_id és message hozzáadva
        db.add(models.ProjektNaplo(
            projekt_id=p_id,
            status="Draft",
            user_id=current_user.id,

        ))

    try:
        db.commit()
        return {"message": "Sikeres mentés"}
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500, detail=f"Adatbázis hiba: {str(e)}")


# 5 & 6. Kalkuláció mentése és küldése a raktárnak
@router.put("/projects/{p_id}/finalize")
def finalize_project(p_id: int, data: FinalizeSchema, db: Session = Depends(database.get_db), current_user: models.User = Depends(get_current_user)):
    project = db.query(models.Projekt).filter(
        models.Projekt.id == p_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Projekt nem található")

    if project.status in ["InProgress", "Completed", "Failed"]:
        raise HTTPException(
            status_code=400,
            detail=f"A projekt már {project.status} állapotban van, a kalkuláció nem módosítható!"
        )

    project_parts = db.query(models.ProjektAlkatresz).filter(
        models.ProjektAlkatresz.projekt_id == p_id).all()
    all_available = True

    for item in project_parts:
        stock = db.query(func.sum(models.WarehouseSlot.current_quantity)).filter(
            models.WarehouseSlot.part_id == item.part_id).scalar() or 0
        if stock < item.required_quantity:
            all_available = False
            break

    project.estimated_time = data.estimated_time
    project.price = data.price

    new_status = "Scheduled" if all_available else "Wait"
    project.status = new_status

    # FIX: user_id és dinamikus üzenet hozzáadva
    log_msg = "Kalkuláció véglegesítve. Alkatrészek biztosítva." if all_available else "Kalkuláció véglegesítve. Raktár visszajelzésre vár."
    db.add(models.ProjektNaplo(
        projekt_id=p_id,
        status=new_status,
        user_id=current_user.id,
    ))
    db.commit()

    return {"status": new_status, "price": project.price, "hours": project.estimated_time}


# 7. Projekt lezárása / státusz frissítése
@router.put("/projects/{p_id}/status")
def update_project_status(p_id: int, data: dict, db: Session = Depends(database.get_db), current_user: models.User = Depends(get_current_user)):
    project = db.query(models.Projekt).filter(
        models.Projekt.id == p_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Projekt nem található")

    new_status = data.get("status")
    if new_status not in ["Completed", "Failed", "InProgress"]:
        raise HTTPException(status_code=400, detail="Érvénytelen státusz")

    project.status = new_status

    # FIX: user_id és értelmes lezáró üzenet hozzáadva
    status_messages = {
        "InProgress": "A munka megkezdődött.",
        "Completed": "Projekt sikeresen lezárva.",
        "Failed": "Projekt sikertelenként lezárva."
    }

    db.add(models.ProjektNaplo(
        projekt_id=p_id,
        status=new_status,
        user_id=current_user.id,
    ))
    db.commit()
    return {"message": f"Projekt státusza: {new_status}"}


# --- Segédfunkciók ---

@router.get("/projects/{p_id}/parts")
def get_project_parts(p_id: int, db: Session = Depends(database.get_db)):
    items = db.query(
        models.ProjektAlkatresz.id,
        models.ProjektAlkatresz.required_quantity,
        models.Part.name,
        models.Part.price
    ).join(models.Part, models.ProjektAlkatresz.part_id == models.Part.id)\
     .filter(models.ProjektAlkatresz.projekt_id == p_id).all()
    return [dict(row._asdict()) for row in items]


@router.patch("/project-parts/{item_id}")
def update_project_part_quantity(item_id: int, data: dict, db: Session = Depends(database.get_db)):
    item = db.query(models.ProjektAlkatresz).filter(
        models.ProjektAlkatresz.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404)

    new_qty = data.get("quantity")
    if new_qty and new_qty > 0:
        item.required_quantity = new_qty
        db.commit()
        return {"message": "Frissítve"}
    raise HTTPException(status_code=400)


@router.delete("/project-parts/{item_id}")
def delete_project_part(item_id: int, db: Session = Depends(database.get_db)):
    item = db.query(models.ProjektAlkatresz).filter(
        models.ProjektAlkatresz.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404)
    db.delete(item)
    db.commit()
    return {"message": "Törölve"}


@router.get("/projects/{p_id}/logs")
def get_project_logs(p_id: int, db: Session = Depends(database.get_db)):
    """
    Visszaadja egy adott projekt összes állapotváltozását időrendben.
    """
    # FIX: options(joinedload(...)) beteszi a cache-be a felhasználói adatokat
    logs = db.query(models.ProjektNaplo)\
             .options(joinedload(models.ProjektNaplo.user))\
             .filter(models.ProjektNaplo.projekt_id == p_id)\
             .order_by(models.ProjektNaplo.id.desc()).all()

    if not logs:
        return []

    return [
        {
            "id": log.id,
            "status": log.status,
            "timestamp": log.timestamp.isoformat() if log.timestamp else None,
            "user_name": log.user.username if log.user else "Rendszer",
            # FIX: Visszaadjuk a message mezőt is, amit a React frontend meg akar jeleníteni
            "message": log.message if hasattr(log, 'message') else "Állapotváltozás történt."
        } for log in logs
    ]
