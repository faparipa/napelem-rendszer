from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, or_
from pydantic import BaseModel
from typing import List, Optional
import models
import database
import auth

router = APIRouter(prefix="/warehouse", tags=["Warehouse Management"])

# --- SÉMÁK (Pydantic Models) ---


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


class SlotUpdate(BaseModel):
    part_id: Optional[int] = None
    quantity: int


class AutoInboundRequest(BaseModel):
    part_id: int
    quantity: int

# --- JOGOSULTSÁG ELLENŐRZŐ ---


def require_warehouse_manager(current_user: models.User = Depends(auth.get_current_user)):
    """Csak Raktárvezető vagy Adminisztrátor végezheti a módosításokat."""
    if current_user.role not in ["Raktarvezeto", "Adminisztrator", "Administrator"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Ehhez a művelethez Raktárvezetői jogosultság szükséges!"
        )
    return current_user

# --- B.1: ÚJ ALKATRÉSZ FELVÉTELE ---


@router.post("/parts", response_model=PartOut, status_code=status.HTTP_201_CREATED)
def create_part(
    part_data: PartCreate,
    db: Session = Depends(database.get_db),
    manager: models.User = Depends(require_warehouse_manager)
):
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

# --- B.2: ALKATRÉSZ ÁRÁNAK MÓDOSÍTÁSA ---


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


@router.get("/reports/missing-parts")
def get_missing_parts_report(db: Session = Depends(database.get_db), manager: models.User = Depends(require_warehouse_manager)):
    """Összegzi a fizikai készletet és összeveti a MÉG KISZEDÉSRE VÁRÓ (Wait, Scheduled) projektek igényeivel."""
    physical_stock = db.query(
        models.WarehouseSlot.part_id,
        func.sum(models.WarehouseSlot.current_quantity).label("total_physical")
    ).filter(models.WarehouseSlot.part_id != None).group_by(models.WarehouseSlot.part_id).subquery()

    reserved_stock = db.query(
        models.ProjektAlkatresz.part_id,
        func.sum(models.ProjektAlkatresz.required_quantity).label(
            "total_required")
    ).join(models.Projekt, models.Projekt.id == models.ProjektAlkatresz.projekt_id)\
     .filter(models.Projekt.status.in_(["Wait", "Scheduled"]))\
     .group_by(models.ProjektAlkatresz.part_id).subquery()

    report = db.query(
        models.Part.name,
        func.coalesce(physical_stock.c.total_physical, 0).label("stock"),
        func.coalesce(reserved_stock.c.total_required, 0).label("needed")
    ).outerjoin(physical_stock, models.Part.id == physical_stock.c.part_id)\
     .outerjoin(reserved_stock, models.Part.id == reserved_stock.c.part_id)\
     .all()

    result = []
    for row in report:
        if row.needed > 0:
            diff = row.stock - row.needed
            if diff < 0:
                result.append({
                    "name": row.name,
                    "current_stock": row.stock,
                    "required_by_projects": row.needed,
                    "missing_quantity": abs(diff)
                })
            else:
                result.append({
                    "name": row.name,
                    "current_stock": row.stock,
                    "required_by_projects": row.needed,
                    "missing_quantity": 0
                })
    return result


@router.post("/setup-warehouse")
def setup_warehouse(
    rows: int = Query(..., gt=0),
    cols: int = Query(..., gt=0),
    levels: int = Query(..., gt=0),
    slots_per_level: int = Query(..., gt=0),
    db: Session = Depends(database.get_db),
    manager: models.User = Depends(require_warehouse_manager)
):
    if db.query(models.WarehouseSlot).count() > 0:
        raise HTTPException(
            status_code=400, detail="A raktárhelyek már fel vannak véve!")

    slots_to_add = []
    rekesz_szam_global = 0

    for r in range(1, rows + 1):
        for c in range(1, cols + 1):
            for l in range(1, levels + 1):
                for s in range(1, slots_per_level + 1):
                    rekesz_szam_global += 1
                    readable = f"R{r:02d}-C{c:02d}-L{l:02d}-S{s:02d}"

                    new_slot = models.WarehouseSlot(
                        readable_id=readable,
                        row_num=r,
                        col_num=c,
                        level_num=l,
                        rekesz_num=rekesz_szam_global,
                        current_quantity=0,
                        part_id=None
                    )
                    slots_to_add.append(new_slot)

    try:
        db.add_all(slots_to_add)
        db.commit()
        return {"message": f"Sikeresen létrehozva {len(slots_to_add)} raktárhely!"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/expand-warehouse")
def expand_warehouse(
    add_rows: int = Query(0, ge=0),
    add_cols: int = Query(0, ge=0),
    levels: int = Query(..., gt=0),
    slots_per_level: int = Query(..., gt=0),
    db: Session = Depends(database.get_db),
    manager: models.User = Depends(require_warehouse_manager)
):
    current_max = db.query(
        func.max(models.WarehouseSlot.row_num).label("max_r"),
        func.max(models.WarehouseSlot.col_num).label("max_c"),
        func.max(models.WarehouseSlot.rekesz_num).label("max_n")
    ).first()

    curr_rows = current_max.max_r or 0
    curr_cols = current_max.max_c or 0
    curr_num = current_max.max_n or 0

    new_slots = []

    def create_slots(r, c):
        nonlocal curr_num
        for l in range(1, levels + 1):
            for s in range(1, slots_per_level + 1):
                curr_num += 1
                readable = f"R{r:02d}-C{c:02d}-L{l:02d}-S{s:02d}"
                new_slots.append(models.WarehouseSlot(
                    readable_id=readable,
                    row_num=r,
                    col_num=c,
                    level_num=l,
                    rekesz_num=curr_num,
                    current_quantity=0
                ))

    if add_rows > 0:
        for r in range(curr_rows + 1, curr_rows + add_rows + 1):
            for c in range(1, curr_cols + add_cols + 1):
                create_slots(r, c)

    if add_cols > 0:
        for r in range(1, curr_rows + 1):
            for c in range(curr_cols + 1, curr_cols + add_cols + 1):
                create_slots(r, c)

    if not new_slots:
        raise HTTPException(status_code=400, detail="Nincs mit hozzáadni.")

    try:
        db.add_all(new_slots)
        db.commit()
        return {"message": f"Sikeresen hozzáadva {len(new_slots)} új raktárhely!"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


# --- LISTÁZÁSOK ---

@router.get("/parts")
def list_parts(db: Session = Depends(database.get_db)):
    parts_with_stock = db.query(
        models.Part.id,
        models.Part.name,
        models.Part.price,
        models.Part.max_per_slot,
        func.sum(models.WarehouseSlot.current_quantity).label("total_stock")
    ).outerjoin(models.WarehouseSlot, models.Part.id == models.WarehouseSlot.part_id)\
     .group_by(models.Part.id).all()

    return [
        {
            "id": p.id,
            "name": p.name,
            "price": p.price,
            "max_per_slot": p.max_per_slot,
            "total_stock": p.total_stock or 0
        } for p in parts_with_stock
    ]


@router.get("/slots")
def list_slots(db: Session = Depends(database.get_db)):
    return db.query(models.WarehouseSlot).all()


# --- B.5 & B.6: BEÉRKEZŐ ANYAGOK FELVÉTELE ÉS KAPACITÁSKEZELÉS ---

@router.patch("/slots/{slot_id}/incoming")
def receive_goods(
    slot_id: int,
    part_id: int,
    quantity: int = Query(..., gt=0),
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    if current_user.role not in ["Adminisztrator", "Raktarvezeto"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Nincs jogosultsága! Az Ön rangja: {current_user.role}"
        )

    slot = db.query(models.WarehouseSlot).filter(
        models.WarehouseSlot.id == slot_id).first()
    part = db.query(models.Part).filter(models.Part.id == part_id).first()

    if not slot or not part:
        raise HTTPException(
            status_code=404, detail="Rekesz vagy alkatrész nem található")

    if slot.part_id is not None and slot.part_id != part_id:
        raise HTTPException(
            status_code=400, detail="Ebben a rekeszben már más alkatrész van!")

    new_total = slot.current_quantity + quantity
    if new_total > part.max_per_slot:
        raise HTTPException(
            status_code=400, detail=f"Max kapacitás: {part.max_per_slot}")

    slot.part_id = part_id
    slot.current_quantity = new_total

    new_log = models.KkeszletNaplo if hasattr(
        models, 'KeszletNaplo') else models.KeszletNaplo
    db.add(new_log(
        rekesz_id=slot.id,
        part_id=part_id,
        user_id=current_user.id,
        type="Bevételezés",
        quantity=quantity
    ))
    db.commit()

    return {"message": "Sikeres bevételezés", "uj_mennyiseg": slot.current_quantity}


@router.post("/auto-inbound")
def auto_receive_goods(
    adatok: AutoInboundRequest,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    if current_user.role not in ["Adminisztrator", "Raktarvezeto"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Nincs jogosultsága! Rangja: {current_user.role}"
        )

    alkatresz = db.query(models.Part).filter(
        models.Part.id == adatok.part_id).first()
    if not alkatresz:
        raise HTTPException(status_code=404, detail="Alkatrész nem található")

    maradek = adatok.quantity
    elosztas_info = []
    allocation_for_frontend = []

    rekeszek = db.query(models.WarehouseSlot).filter(
        models.WarehouseSlot.part_id == adatok.part_id,
        models.WarehouseSlot.current_quantity < alkatresz.max_per_slot
    ).all()

    for r in rekeszek:
        if maradek <= 0:
            break
        hely = alkatresz.max_per_slot - r.current_quantity
        tobb = min(maradek, hely)
        r.current_quantity += tobb
        maradek -= tobb
        elosztas_info.append({"rekesz_id": r.id, "mennyiseg": tobb})
        allocation_for_frontend.append(
            {"readable_id": r.readable_id, "allocated_quantity": tobb})

    if maradek > 0:
        ures_helyek = db.query(models.WarehouseSlot).filter(
            or_(models.WarehouseSlot.part_id == None,
                models.WarehouseSlot.current_quantity == 0)
        ).order_by(models.WarehouseSlot.id.asc()).all()

        for r in ures_helyek:
            if maradek <= 0:
                break
            tobb = min(maradek, alkatresz.max_per_slot)
            r.part_id = adatok.part_id
            r.current_quantity = tobb
            maradek -= tobb
            elosztas_info.append({"rekesz_id": r.id, "mennyiseg": tobb})
            allocation_for_frontend.append(
                {"readable_id": r.readable_id, "allocated_quantity": tobb})

    if maradek > 0:
        db.rollback()
        raise HTTPException(
            status_code=400, detail=f"Nincs elég hely! {maradek} db-nak nem jutott rekesz.")

    new_log_model = models.KeszletNaplo if hasattr(
        models, 'KkeszletNaplo') else models.KeszletNaplo
    for tetel in elosztas_info:
        db.add(new_log_model(
            rekesz_id=tetel["rekesz_id"],
            part_id=adatok.part_id,
            user_id=current_user.id,
            type="Bevételezés (Automata)",
            quantity=tetel["mennyiseg"]
        ))

    db.commit()
    return {"status": "success", "allocation": allocation_for_frontend}


@router.get("/reports/project-requirements")
def get_project_requirements(db: Session = Depends(database.get_db)):
    results = db.query(
        models.Projekt.id.label("p_id"),
        models.Projekt.location,
        models.Part.name.label("part_name"),
        models.ProjektAlkatresz.required_quantity
    ).join(models.ProjektAlkatresz, models.Projekt.id == models.ProjektAlkatresz.projekt_id)\
     .join(models.Part, models.ProjektAlkatresz.part_id == models.Part.id)\
     .filter(models.Projekt.status.in_(["Wait", "Scheduled"]))\
     .all()

    return [
        {
            "project_id": r.p_id,
            "location": r.location,
            "part_name": r.part_name,
            "qty": r.required_quantity
        } for r in results
    ]


# --- C.3: ÁRKALKULÁCIÓ VÉGLEGESÍTÉSE ÉS ÜTEMEZÉS ---
@router.post("/projects/{p_id}/finalize-and-schedule")
def finalize_and_schedule(p_id: int, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    project = db.query(models.Projekt).options(
        joinedload(models.Projekt.alkatreszek).joinedload(models.ProjektAlkatresz.alkatresz) if hasattr(
            models.Projekt, 'alkatreszek') else joinedload('*')
    ).filter(models.Projekt.id == p_id).first()

    if not project:
        raise HTTPException(status_code=404, detail="Projekt nem található")

    alkatresz_lista = project.alkatreszek if hasattr(
        project, 'alkatreszek') else []
    for item in alkatresz_lista:
        total_stock = db.query(func.sum(models.WarehouseSlot.current_quantity))\
                        .filter(models.WarehouseSlot.part_id == item.part_id).scalar() or 0

        # Ha nincs elég raktáron, nem lehet befejezni a kalkulációt -> Wait állapotba kerül
        if total_stock < item.required_quantity:
            project.status = "Wait"
            db.add(models.ProjektNaplo(
                projekt_id=p_id,
                status="Wait",
                user_id=current_user.id,
            ))
            db.commit()
            raise HTTPException(
                status_code=400, detail="Nincs elég készlet a raktárban, a projekt 'Wait' állapotba került.")

    # Ha minden megvan, az árkalkuláció elkészült -> Scheduled
    project.status = "Scheduled"

    db.add(models.ProjektNaplo(
        projekt_id=p_id,
        status="Scheduled",
        user_id=current_user.id,

    ))
    db.commit()
    return {"message": "Projekt sikeresen ütemezve (Scheduled)."}


@router.get("/projects/{p_id}/picking-list")
def get_picking_list(p_id: int, db: Session = Depends(database.get_db)):
    project = db.query(models.Projekt).filter(
        models.Projekt.id == p_id).first()

    if not project:
        raise HTTPException(status_code=404, detail="Projekt nem található")

    if project.status not in ["Wait", "Scheduled", "InProgress"]:
        raise HTTPException(
            status_code=400,
            detail=f"Ez a projekt nem kiszedhető állapotban van (Státusz: {project.status})"
        )

    project_parts = db.query(
        models.ProjektAlkatresz,
        models.Part.name.label("part_name")
    ).join(models.Part, models.ProjektAlkatresz.part_id == models.Part.id)\
     .filter(models.ProjektAlkatresz.projekt_id == p_id).all()

    all_picking_steps = []
    has_missing_item = False

    for item_row in project_parts:
        item, p_name = item_row[0], item_row[1]
        needed_qty = item.required_quantity

        slots = db.query(models.WarehouseSlot).filter(
            models.WarehouseSlot.part_id == item.part_id,
            models.WarehouseSlot.current_quantity > 0
        ).order_by(models.WarehouseSlot.rekesz_num.asc()).all()

        if not slots:
            has_missing_item = True
            all_picking_steps.append({
                "location": "NINCS RAKTÁRON",
                "part_name": p_name,
                "stock_qty": 0,
                "required_qty": needed_qty,
                "is_missing": True,
                "order_num": 999999
            })
        else:
            for slot in slots:
                if needed_qty <= 0:
                    break
                take_qty = min(slot.current_quantity, needed_qty)
                all_picking_steps.append({
                    "location": slot.readable_id,
                    "part_name": p_name,
                    "stock_qty": slot.current_quantity,
                    "required_qty": take_qty,
                    "is_missing": False,
                    "order_num": slot.rekesz_num
                })
                needed_qty -= take_qty

            if needed_qty > 0:
                has_missing_item = True

    all_picking_steps.sort(key=lambda x: x['order_num'])

    return {
        "project_info": {
            "id": project.id,
            "can_complete": not has_missing_item,
            "estimated_time": project.estimated_time,
            "labor_fee": project.price
        },
        "picking_steps": all_picking_steps
    }


@router.patch("/projects/{p_id}/send-back")
def send_back_to_expert(p_id: int, reason: str = Query(...), db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    project = db.query(models.Projekt).filter(
        models.Projekt.id == p_id).first()
    if not project:
        raise HTTPException(status_code=404)

    project.status = "Draft"

    db.add(models.ProjektNaplo(
        projekt_id=p_id,
        status="Draft",
        user_id=current_user.id,
    ))
    db.commit()
    return {"message": "Projekt visszaküldve a szakembernek (Draft)."}


@router.patch("/projects/{p_id}/fail")
def fail_project(p_id: int, reason: str = Query(...), db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    project = db.query(models.Projekt).filter(
        models.Projekt.id == p_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Projekt nem található")

    project.status = "Failed"

    db.add(models.ProjektNaplo(
        projekt_id=p_id,
        status="Failed",
        user_id=current_user.id,

    ))
    db.commit()
    return {"status": "Failed"}


@router.patch("/projects/{p_id}/complete")
def complete_project(p_id: int, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    project = db.query(models.Projekt).filter(
        models.Projekt.id == p_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Projekt nem található")

    project.status = "Completed"

    db.add(models.ProjektNaplo(
        projekt_id=p_id,
        status="Completed",
        user_id=current_user.id,

    ))
    db.commit()
    return {"status": "success"}


# --- C.1: KISZEDÉS ELINDÍTÁSA (STÁTUSZÁTMENET INPROGRESS-BE) ---
@router.patch("/projects/{p_id}/start-picking")
def start_picking(p_id: int, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    """A raktáros elindítja az alkatrészek kivételezését. Státusz: Scheduled -> InProgress"""
    if current_user.role not in ["Raktaros", "Raktarvezeto", "Adminisztrator"]:
        raise HTTPException(
            status_code=403, detail="Nincs jogosultsága a kivételezéshez!")

    project = db.query(models.Projekt).filter(
        models.Projekt.id == p_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Projekt nem található")

    if project.status != "Scheduled":
        raise HTTPException(
            status_code=400, detail="Csak 'Scheduled' állapotú projekt esetében indítható el a kivételezés!")

    # A megvalósítás megkezdődött, első lépés a raktári kivételezés -> InProgress
    project.status = "InProgress"

    db.add(models.ProjektNaplo(
        projekt_id=p_id,
        status="InProgress",
        user_id=current_user.id,

    ))
    db.commit()

    return {"status": "InProgress", "message": "A projekt állapota 'InProgress'-re módosult."}


# --- C.2: KISZEDÉS VÉGLEGESÍTÉSE (KÉSZLET LEVONÁS, STÁTUSZ MARAD INPROGRESS) ---
@router.patch("/projects/{p_id}/confirm-and-close")
def confirm_and_close(p_id: int, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    """A kiszedés tényleges befejezése, a fizikai készlet levonódik, de a projekt InProgress marad."""
    project = db.query(models.Projekt).filter(
        models.Projekt.id == p_id).first()

    if not project:
        raise HTTPException(status_code=404, detail="Projekt nem található")

    if project.status not in ["InProgress", "Scheduled"]:
        raise HTTPException(
            status_code=400, detail="A kiszedést csak 'InProgress' státuszú projektnél lehet véglegesíteni!")

    parts = db.query(models.ProjektAlkatresz).filter(
        models.ProjektAlkatresz.projekt_id == p_id).all()

    for item in parts:
        remaining = item.required_quantity
        slots = db.query(models.WarehouseSlot).filter(
            models.WarehouseSlot.part_id == item.part_id,
            models.WarehouseSlot.current_quantity > 0
        ).order_by(models.WarehouseSlot.rekesz_num.asc()).all()

        for slot in slots:
            if remaining <= 0:
                break
            take = min(slot.current_quantity, remaining)
            slot.current_quantity -= take
            remaining -= take

            if slot.current_quantity == 0:
                slot.part_id = None

    # A raktárból kikerültek a dolgok, de a projekt még folyamatban van (InProgress)
    project.status = "InProgress"

    db.add(models.ProjektNaplo(
        projekt_id=p_id,
        status="InProgress",
        user_id=current_user.id,

    ))

    try:
        db.commit()
        db.refresh(project)
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500, detail=f"Hiba a mentés során: {str(e)}")

    return {"message": "Készlet sikeresen frissítve", "new_status": project.status}


@router.get("/slots-status")
def get_slots_with_status(db: Session = Depends(database.get_db)):
    """A vizuális raktár-térképhez visszaadja a rekeszeket alkatrész névvel."""
    slots = db.query(models.WarehouseSlot).options(
        joinedload(models.WarehouseSlot.part)
    ).all()

    result = []
    for slot in slots:
        has_part = slot.part is not None
        result.append({
            "id": slot.id,
            "readable_id": slot.readable_id,
            "current_quantity": slot.current_quantity,
            "part_name": slot.part.name if has_part else "Üres rekesz",
            "max_per_slot": slot.part.max_per_slot if has_part else 0,
            "row_num": slot.row_num,
            "col_num": slot.col_num,
            "level_num": slot.level_num
        })
    return result
