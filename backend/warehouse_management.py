
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy.orm import joinedload
from sqlalchemy import func
from sqlalchemy import or_, func
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

# --- JOGOSULTSÁG ELLENŐRZŐ (Require Warehouse Manager) ---


def require_warehouse_manager(current_user: models.User = Depends(auth.get_current_user)):
    """
    Csak Raktárvezető vagy Adminisztrátor végezheti a módosításokat.
    """
    if current_user.role not in ["Raktarvezeto", "Adminisztrator", "Administrator"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Ehhez a művelethez Raktárvezetői jogosultság szükséges!"
        )
    return current_user

# --- B.1: ÚJ ALKATRÉSZ FELVÉTELE (Törzsadat) ---


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
    """
    Összegzi a fizikai készletet és összeveti a MÉG KISZEDÉSRE VÁRÓ projektek igényeivel.
    """

    # 1. Fizikai készlet összesítése (ami jelenleg a polcokon van)
    physical_stock = db.query(
        models.WarehouseSlot.part_id,
        func.sum(models.WarehouseSlot.current_quantity).label("total_physical")
    ).filter(models.WarehouseSlot.part_id != None).group_by(models.WarehouseSlot.part_id).subquery()

    # 2. JAVÍTOTT RÉSZ: Csak a 'Wait' és 'Scheduled' projektek igényeit adjuk össze!
    # Az 'InProgress' már ki lett szedve, a fizikai készletből már levontuk,
    # így nem szabad újra "igényként" számolni, különben duplázódik a hiány.
    reserved_stock = db.query(
        models.ProjektAlkatresz.part_id,
        func.sum(models.ProjektAlkatresz.required_quantity).label(
            "total_required")
    ).join(models.Projekt, models.Projekt.id == models.ProjektAlkatresz.projekt_id)\
     .filter(models.Projekt.status.in_(["Wait", "Scheduled"]))\
     .group_by(models.ProjektAlkatresz.part_id).subquery()

    # 3. Összevonás az Alkatresz törzzsel
    report = db.query(
        models.Part.name,
        func.coalesce(physical_stock.c.total_physical, 0).label("stock"),
        func.coalesce(reserved_stock.c.total_required, 0).label("needed")
    ).outerjoin(physical_stock, models.Part.id == physical_stock.c.part_id)\
     .outerjoin(reserved_stock, models.Part.id == reserved_stock.c.part_id)\
     .all()

    result = []
    for row in report:
        # Csak akkor foglalkozunk az alkatrésszel, ha van rá aktív igény
        if row.needed > 0:
            diff = row.stock - row.needed

            # Ha a készlet kevesebb, mint az összesített igény (diff negatív)
            if diff < 0:
                result.append({
                    "name": row.name,
                    "current_stock": row.stock,
                    "required_by_projects": row.needed,
                    "missing_quantity": abs(diff)
                })
            else:
                # Opcionális: Ha látni akarod a listában azt is, amiből van elég
                # de a hiány 0 db (mint a képeden a 'kapcsoló')
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
    slots_per_level: int = Query(..., gt=0),  # ÚJ: rekeszek száma polconként
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
                for s in range(1, slots_per_level + 1):  # Belső ciklus a rekeszeknek
                    rekesz_szam_global += 1
                    # Formátum: Sor-Oszlop-Szint-Rekesz
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
    levels: int = Query(..., gt=0),  # Polcok száma (szintek)
    slots_per_level: int = Query(..., gt=0),  # Rekeszek száma egy polcon
    db: Session = Depends(database.get_db),
    manager: models.User = Depends(require_warehouse_manager)
):
    # Aktuális max értékek a folytonos sorszámozáshoz
    current_max = db.query(
        func.max(models.WarehouseSlot.row_num).label("max_r"),
        func.max(models.WarehouseSlot.col_num).label("max_c"),
        func.max(models.WarehouseSlot.rekesz_num).label("max_n")
    ).first()

    curr_rows = current_max.max_r or 0
    curr_cols = current_max.max_c or 0
    curr_num = current_max.max_n or 0

    new_slots = []

    # Segédfüggvény a generáláshoz
    def create_slots(r, c):
        nonlocal curr_num
        for l in range(1, levels + 1):
            for s in range(1, slots_per_level + 1):
                curr_num += 1
                # Formátum: Sor-Oszlop-Szint-Rekesz (R01-C01-L01-S01)
                readable = f"R{r:02d}-C{c:02d}-L{l:02d}-S{s:02d}"
                new_slots.append(models.WarehouseSlot(
                    readable_id=readable,
                    row_num=r,
                    col_num=c,
                    level_num=l,
                    rekesz_num=curr_num,
                    current_quantity=0
                ))

    # 1. Új sorok generálása
    if add_rows > 0:
        for r in range(curr_rows + 1, curr_rows + add_rows + 1):
            # Az új sor minden oszlopához (meglévők + esetleges új oszlopok)
            for c in range(1, curr_cols + add_cols + 1):
                create_slots(r, c)

    # 2. Új oszlopok generálása a már meglévő sorokhoz
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
    # Alkatrészek lekérése a hozzájuk tartozó rekeszekben lévő mennyiségek összegével
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
    """A rekeszek állapotának megtekintése"""
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
        print(
            f"DEBUG: Jogosultság hiba! Felhasználó: {current_user.username}, Rang: {current_user.role}")
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

    new_log = models.KeszletNaplo(
        rekesz_id=slot.id,
        part_id=part_id,
        user_id=current_user.id,
        type="Bevételezés",
        quantity=quantity
    )
    db.add(new_log)
    db.commit()

    return {"message": "Sikeres bevételezés", "uj_mennyiseg": slot.current_quantity}


@router.post("/auto-inbound")
def auto_receive_goods(
    adatok: AutoInboundRequest,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    # JOGOSULTSÁG ELLENŐRZÉS
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
    # Ebben a listában tároljuk, melyik rekeszbe mennyit tettünk (a naplóhoz)
    elosztas_info = []
    # Ez megy vissza a frontendnek
    allocation_for_frontend = []

    # 1. Meglévő rekeszek (ahol már van ilyen alkatrész)
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
        # ELMENTJÜK A REKESZ ID-T IS!
        elosztas_info.append({"rekesz_id": r.id, "mennyiseg": tobb})
        allocation_for_frontend.append(
            {"readable_id": r.readable_id, "allocated_quantity": tobb})

    # 2. Üres rekeszek (Ha még maradt áru)
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
            # ELMENTJÜK A REKESZ ID-T IS!
            elosztas_info.append({"rekesz_id": r.id, "mennyiseg": tobb})
            allocation_for_frontend.append(
                {"readable_id": r.readable_id, "allocated_quantity": tobb})

    # Helyellenőrzés
    if maradek > 0:
        db.rollback()
        raise HTTPException(
            status_code=400, detail=f"Nincs elég hely! {maradek} db-nak nem jutott rekesz.")

    # 3. NAPLÓZÁS (Most már nem lesz Rekesz_ID is null hiba)
    for tétel in elosztas_info:
        uj_naplo = models.KeszletNaplo(

            rekesz_id=tétel["rekesz_id"],
            part_id=adatok.part_id,
            user_id=current_user.id,
            type="Bevételezés (Automata)",
            quantity=tétel["mennyiseg"]
        )
        db.add(uj_naplo)

    db.commit()
    # A frontendnek a "readable_id" (pl. R01-C01-L01) kell, a naplónak az adatbázis ID
    return {"status": "success", "allocation": allocation_for_frontend}


@router.get("/reports/project-requirements")
def get_project_requirements(db: Session = Depends(database.get_db)):
    """
    Listázza az összes várakozó vagy folyamatban lévő projektet 
    és a hozzájuk rendelt alkatrészeket.
    """
    # Lekérjük a projekteket, amik már átmentek a szakemberen (Wait, Scheduled, InProgress)
    results = db.query(
        models.Projekt.id.label("p_id"),
        models.Projekt.location,
        models.Part.name.label("part_name"),
        models.ProjektAlkatresz.required_quantity
    ).join(models.ProjektAlkatresz, models.Projekt.id == models.ProjektAlkatresz.projekt_id)\
     .join(models.Part, models.ProjektAlkatresz.part_id == models.Part.id)\
     .filter(models.Projekt.status.in_(["Wait", "Scheduled",]))\
     .all()

    # Formázás a frontendnek
    return [
        {
            "project_id": r.p_id,
            "location": r.location,
            "part_name": r.part_name,
            "qty": r.required_quantity
        } for r in results
    ]


@router.post("/projects/{p_id}/finalize-and-schedule")
def finalize_and_schedule(p_id: int, db: Session = Depends(database.get_db)):
    project = db.query(models.Projekt).filter(
        models.Projekt.id == p_id).first()

    # 1. Készletellenőrzés
    for item in project.alkatreszek:
        total_stock = db.query(func.sum(models.WarehouseSlot.current_quantity))\
                        .filter(models.WarehouseSlot.part_id == item.part_id).scalar() or 0
        if total_stock < item.required_quantity:
            raise HTTPException(
                status_code=400, detail=f"Nincs elég készlet: {item.alkatresz.name}")

    # 2. Státuszváltás Scheduled-re
    project.status = "Scheduled"

    # 3. Naplózás (időbélyeggel a statisztikához)
    db.add(models.ProjektNaplo(
        projekt_id=p_id,
        status="Scheduled",
        message="Raktárvezető jóváhagyta, készlet lefoglalva, kalkuláció végleges."
    ))
    db.commit()
    return {"message": "Projekt ütemezve, kalkuláció kész."}


@router.get("/projects/{p_id}/picking-list")
def get_picking_list(p_id: int, db: Session = Depends(database.get_db)):
    project = db.query(models.Projekt).filter(
        models.Projekt.id == p_id).first()

    if not project:
        raise HTTPException(status_code=404, detail="Projekt nem található")

    # ÚJ VÉDELEM: Ha a projekt már InProgress vagy Completed, ne adjunk kiszedési listát!
    if project.status not in ["Wait", "Scheduled"]:
        raise HTTPException(
            status_code=400,
            detail=f"Ez a projekt már elhagyta a raktárt (Státusz: {project.status})"
        )

    # Lekérjük az igényelt alkatrészeket
    project_parts = db.query(
        models.ProjektAlkatresz,
        models.Part.name.label("part_name")
    ).join(models.Part, models.ProjektAlkatresz.part_id == models.Part.id
           ).filter(models.ProjektAlkatresz.projekt_id == p_id).all()

    all_picking_steps = []
    has_missing_item = False  # Segédváltozó a hiány jelzésére

    for item_row in project_parts:
        item, p_name = item_row[0], item_row[1]
        needed_qty = item.required_quantity

        slots = db.query(models.WarehouseSlot).filter(
            models.WarehouseSlot.part_id == item.part_id,
            models.WarehouseSlot.current_quantity > 0
        ).order_by(models.WarehouseSlot.rekesz_num.asc()).all()

        if not slots:
            # NINCS KÉSZLETEN EGYÁLTALÁN
            has_missing_item = True
            all_picking_steps.append({
                "location": "NINCS RAKTÁRON",
                "part_name": p_name,
                "stock_qty": 0,
                "required_qty": needed_qty,
                "is_missing": True,
                "order_num": 999999  # A lista végére kerüljön
            })
        else:
            # Van készlet, a korábbi logika szerint feldolgozzuk...
            collected_from_slots = 0
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
                collected_from_slots += take_qty

            # Ha a rekeszekből nem jött össze a teljes igényelt mennyiség
            if needed_qty > 0:
                has_missing_item = True

    all_picking_steps.sort(key=lambda x: x['order_num'])

    return {
        "project_info": {
            "id": project.id,
            # Frontend ebből tudja, h tiltható-e a gomb
            "can_complete": not has_missing_item,
            "estimated_time": project.estimated_time,
            "labor_fee": project.price
        },
        "picking_steps": all_picking_steps
    }


@router.patch("/projects/{p_id}/send-back")
def send_back_to_expert(p_id: int, reason: str = Query(...), db: Session = Depends(database.get_db)):
    project = db.query(models.Projekt).filter(
        models.Projekt.id == p_id).first()
    if not project:
        raise HTTPException(status_code=404)

    # Visszaállítjuk Draft-ra, hogy a szakember újra tudja szerkeszteni/törölni
    project.status = "Draft"

    # Naplózás indokkal
    log = models.ProjektNaplo(
        projekt_id=p_id,
        status="Draft",
        message=f"Raktárvezető visszaküldte módosításra. Indok: {reason}"
    )
    db.add(log)
    db.commit()
    return {"message": "Projekt visszaküldve a szakembernek."}


@router.patch("/projects/{p_id}/fail")
def fail_project(p_id: int, reason: str = Query(...), db: Session = Depends(database.get_db)):
    project = db.query(models.Projekt).filter(
        models.Projekt.id == p_id).first()
    project.status = "Failed"
    db.add(models.ProjektNaplo(projekt_id=p_id,
           status="Failed", message=f"Meghiúsult: {reason}"))
    db.commit()
    return {"status": "Failed"}


@router.patch("/projects/{p_id}/complete")
def complete_project(p_id: int, db: Session = Depends(database.get_db)):
    project = db.query(models.Projekt).filter(
        models.Projekt.id == p_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Projekt nem található")
    project.status = "Completed"
    db.commit()
    return {"status": "success"}


@router.patch("/projects/{p_id}/start-picking")
def start_picking(p_id: int, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    """
    C.1: Raktáros elindítja a kivételezést. 
    Státusz: Scheduled -> InProgress
    """
    # Jogosultság ellenőrzés (Raktáros vagy felette)
    if current_user.role not in ["Raktaros", "Raktarvezeto", "Adminisztrator"]:
        raise HTTPException(
            status_code=403, detail="Nincs jogosultsága a kivételezéshez!")

    project = db.query(models.Projekt).filter(
        models.Projekt.id == p_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Projekt nem található")

    if project.status != "Scheduled":
        raise HTTPException(
            status_code=400, detail="Csak 'Scheduled' állapotú projekt indítható el!")

    # Átállítás InProgress-re
    project.status = "InProgress"

    # Naplózás
    db.add(models.ProjektNaplo(projekt_id=p_id, status="InProgress"))
    db.commit()

    return {"status": "InProgress", "message": "A projekt állapota 'Folyamatban'-ra módosult. A kivételezési lista nyomtatható."}


@router.patch("/projects/{p_id}/confirm-and-close")
def confirm_and_close(p_id: int, db: Session = Depends(database.get_db)):
    project = db.query(models.Projekt).filter(
        models.Projekt.id == p_id).first()

    if not project:
        raise HTTPException(status_code=404, detail="Projekt nem található")

    # 1. Készlet tényleges levonása a raktárból
    parts = db.query(models.ProjektAlkatresz).filter(
        models.ProjektAlkatresz.projekt_id == p_id
    ).all()

    for item in parts:
        remaining = item.required_quantity
        # Keressük azokat a rekeszeket, ahol van ilyen alkatrész
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

            # Ha kiürült a rekesz, felszabadítjuk
            if slot.current_quantity == 0:
                slot.part_id = None

    # 2. STÁTUSZ FRISSÍTÉSE
    # A models.py szerint a Projekt táblában 'status' (Statusz) mező van
    project.status = "InProgress"

    # 3. NAPLÓZÁS - CSAK OLYAN MEZŐKKEL, AMIK A MODELS.PY-BAN VANNAK!
    # A ProjektNaplo-ban csak id, projekt_id, status és timestamp van.
    uj_naplo = models.ProjektNaplo(
        projekt_id=p_id,
        status="InProgress"
    )
    db.add(uj_naplo)

    try:
        db.commit()
        db.refresh(project)
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500, detail=f"Hiba a mentés során: {str(e)}")

    return {"message": "Kiszedés sikeres", "new_status": project.status}


@router.get("/slots-status")
def get_slots_with_status(db: Session = Depends(database.get_db)):
    """
    Kifejezetten a vizuális raktár-térképhez: 
    Visszaadja a rekeszeket az alkatrész névvel és max kapacitással.
    """
    # A joinedload elengedhetetlen, hogy a 'part' kapcsolat ne legyen None
    slots = db.query(models.WarehouseSlot).options(
        joinedload(models.WarehouseSlot.part)
    ).all()

    result = []
    for slot in slots:
        # Ellenőrizzük, hogy van-e alkatrész a rekeszben
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
