from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from pydantic import BaseModel
from typing import Optional
import models
import database

router = APIRouter(prefix="/expert", tags=["Szakember"])

# --- Séma az új projekt létrehozásához ---


class ProjectCreate(BaseModel):
    location: str
    description: Optional[str] = None
    customer_name: str
    customer_phone: str

# 1. Új projekt létrehozása („New”)


@router.post("/projects")
def create_project(data: ProjectCreate, db: Session = Depends(database.get_db)):
    try:
        # Mivel a modellben csak 'customer_info' van, összefűzzük a két adatot
        full_customer_data = f"{data.customer_name} ({data.customer_phone})"

        new_project = models.Projekt(
            location=data.location,
            description=data.description,
            customer_info=full_customer_data,  # <--- Ezt használjuk a modell szerint!
            status="New"
        )

        db.add(new_project)
        db.commit()
        db.refresh(new_project)

        # Naplózás
        db.add(models.ProjektNaplo(
            projekt_id=new_project.id,
            status="New"
        ))
        db.commit()

        return new_project
    except Exception as e:
        db.rollback()
        # Itt kiíratjuk a pontos hibát a konzolra, ha mégis lenne valami
        print(f"Hiba: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
# 2. Projektek listázása


@router.get("/projects")
def get_expert_projects(db: Session = Depends(database.get_db)):
    return db.query(models.Projekt).all()

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
def add_or_update_project_part(p_id: int, data: dict, db: Session = Depends(database.get_db)):
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

    project = db.query(models.Projekt).filter(
        models.Projekt.id == p_id).first()
    if project and project.status == "New":
        project.status = "Draft"

    db.commit()
    return {"message": "Sikeres mentés"}

# 5 & 6. Kalkuláció mentése és küldése a raktárnak (Átvált „Wait”-re)


@router.put("/projects/{p_id}/finalize")
def finalize_project_calculation(p_id: int, data: dict, db: Session = Depends(database.get_db)):
    project = db.query(models.Projekt).filter(
        models.Projekt.id == p_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Projekt nem található")

    project.estimated_time = data.get("estimated_hours")
    project.price = data.get("total_price")
    project.status = "Wait"

    db.add(models.ProjektNaplo(projekt_id=p_id, status="Wait",
           message="Szakember beküldte az igényt."))
    db.commit()
    return {"status": "Wait", "message": "Igény továbbítva a raktárnak."}

# 7. Projekt lezárása (Completed / Failed)


@router.put("/projects/{p_id}/status")
def update_project_status(p_id: int, data: dict, db: Session = Depends(database.get_db)):
    project = db.query(models.Projekt).filter(
        models.Projekt.id == p_id).first()
    if not project:
        raise HTTPException(404)

    new_status = data.get("status")
    if new_status not in ["Completed", "Failed", "InProgress"]:
        raise HTTPException(status_code=400, detail="Érvénytelen státusz")

    project.status = new_status
    db.add(models.ProjektNaplo(projekt_id=p_id, status=new_status))
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
        raise HTTPException(404)
    db.delete(item)
    db.commit()
    return {"message": "Törölve"}
