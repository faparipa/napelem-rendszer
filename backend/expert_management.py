from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
import models
import database

router = APIRouter(prefix="/expert", tags=["Szakember"])

# A.2: Projektek listázása a szakember számára


@router.get("/projects")
def get_expert_projects(db: Session = Depends(database.get_db)):
    return db.query(models.Projekt).all()

# A.3: Alkatrészek listázása készletadatokkal


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

# A.4: Alkatrész hozzáadása/módosítása a projekthez


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

# A.5, A.6 & Megrendelés: Kalkuláció mentése és küldése a raktárnak


@router.put("/projects/{p_id}/finalize")
def finalize_project_calculation(p_id: int, data: dict, db: Session = Depends(database.get_db)):
    try:
        project = db.query(models.Projekt).filter(
            models.Projekt.id == p_id).first()
        if not project:
            raise HTTPException(
                status_code=404, detail="Projekt nem található")

        project.estimated_time = data.get("estimated_hours")
        project.price = data.get("total_price")

        # Készletellenőrzés az automatikus státuszhoz
        project_parts = db.query(models.ProjektAlkatresz).filter(
            models.ProjektAlkatresz.projekt_id == p_id).all()
        all_available = True
        for p_part in project_parts:
            total_stock = db.query(func.sum(models.WarehouseSlot.current_quantity))\
                            .filter(models.WarehouseSlot.part_id == p_part.part_id).scalar() or 0
            if total_stock < p_part.required_quantity:
                all_available = False
                break

        # Státusz beállítása (küldés a raktárnak)
        new_status = "Scheduled" if all_available else "Wait"
        project.status = new_status
        db.add(models.ProjektNaplo(projekt_id=p_id, status=new_status))

        db.commit()
        return {"status": new_status, "message": "Megrendelés sikeresen továbbítva!"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

# Segédfunkció: Projekt alkatrészeinek lekérése


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

# Alkatrész mennyiségének módosítása a projektben (A meglévő tétel szerkesztése)


@router.patch("/project-parts/{item_id}")
def update_project_part_quantity(item_id: int, data: dict, db: Session = Depends(database.get_db)):
    item = db.query(models.ProjektAlkatresz).filter(
        models.ProjektAlkatresz.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Tétel nem található")

    new_qty = data.get("quantity")
    if new_qty is not None and new_qty > 0:
        item.required_quantity = new_qty
        db.commit()
        return {"message": "Mennyiség frissítve"}
    else:
        raise HTTPException(status_code=400, detail="Érvénytelen mennyiség")

# A törlés már benne van a kódodban, de itt a biztonság kedvéért:


@router.delete("/project-parts/{item_id}")
def delete_project_part(item_id: int, db: Session = Depends(database.get_db)):
    item = db.query(models.ProjektAlkatresz).filter(
        models.ProjektAlkatresz.id == item_id).first()
    if not item:
        raise HTTPException(404)
    db.delete(item)
    db.commit()
    return {"message": "Törölve"}


@router.put("/projects/{p_id}/finalize")
def finalize_project_calculation(p_id: int, data: dict, db: Session = Depends(database.get_db)):
    project = db.query(models.Projekt).filter(
        models.Projekt.id == p_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Projekt nem található")

    # Csak az adatokat mentjük el, amit a szakember megadott
    project.estimated_time = data.get("estimated_hours")
    project.price = data.get("total_price")

    # A státusz Wait lesz, mert a raktárnak még ki kell gyűjtenie
    # (Az árkalkuláció PDF gomb a frontenden így még inaktív marad)
    project.status = "Wait"

    db.add(models.ProjektNaplo(projekt_id=p_id, status="Wait",
           message="Szakember beküldte az igényt."))
    db.commit()
    return {"status": "Wait", "message": "Igény továbbítva a raktárnak."}

# ÚJ: Általános státuszváltó végpont a Completed és Failed állapothoz


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
