from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload  # <--- joinedload hozzáadva
import models
import database
import auth
from typing import List

router = APIRouter(tags=["Warehouse Management"])


@router.post("/warehouse/generate")
def generate_warehouse(
    rows: int,             # Hány sor/folyosó van
    cols: int,             # Hány oszlop van egy sorban
    levels: int,           # Hány szint (magasság)
    rekeszek_per_szint: int,  # Hány rekesz van EGY szinten (pl. 10)
    db: Session = Depends(database.get_db),
    admin: models.User = Depends(auth.require_admin)
):
    # 1. Biztonsági mentés: Töröljük a régi rekeszeket
    db.query(models.WarehouseSlot).delete()
    db.commit()

    slots_created = 0
    # Négyszeres ciklus: Sor -> Oszlop -> Szint -> Rekesz
    for r in range(1, rows + 1):
        for c in range(1, cols + 1):
            for l in range(1, levels + 1):
                for rek in range(1, rekeszek_per_szint + 1):

                    # Generálunk egy emberileg is értelmezhető kódot:
                    # S=Sor, O=Oszlop, SZ=Szint, R=Rekesz
                    # A :02d azt jelenti, hogy 01, 02 lesz a szám, nem csak 1, 2
                    rid = f"S{r:02d}-O{c:02d}-SZ{l:02d}-R{rek:02d}"

                    new_slot = models.WarehouseSlot(
                        row_num=r,
                        col_num=c,
                        level_num=l,
                        rekesz_num=rek,  # <--- Itt mentjük el a konkrét fakk számát
                        readable_id=rid,
                        current_quantity=0
                    )
                    db.add(new_slot)
                    slots_created += 1

        # Soronként érdemes commitolni, ha nagyon sok adat van
        db.commit()

    return {"message": f"Sikeresen legenerálva {slots_created} egyedi rekesz."}


@router.get("/warehouse/status")
def get_warehouse_status(db: Session = Depends(database.get_db)):
    """Lekéri az összes rekeszt az alkatrész adatokkal együtt."""
    # A joinedload megoldja az 'undefined' problémát, mert betölti a Part objektumot is
    return db.query(models.WarehouseSlot).options(joinedload(models.WarehouseSlot.part)).all()


@router.post("/warehouse/update-stock")
def update_stock(
    slot_id: int,
    part_id: int,
    quantity: int,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)  # Ki csinálja?
):
    """Kezeli a készlet hozzáadását és kivonását."""
    slot = db.query(models.WarehouseSlot).filter(
        models.WarehouseSlot.id == slot_id).first()
    part = db.query(models.Part).filter(models.Part.id == part_id).first()

    if not slot or not part:
        raise HTTPException(
            status_code=404, detail="Rekesz vagy alkatrész nem található")

    # Ha üres a rekesz, rögzítjük az alkatrészt
    if slot.part_id is None:
        slot.part_id = part_id
        slot.current_quantity = 0

    # Ellenőrzés: ne keverjük az alkatrészeket egy rekeszben
    if slot.part_id != part_id and slot.current_quantity > 0:
        raise HTTPException(
            status_code=400, detail="Ebben a rekeszben már más alkatrész van!")

    # Matek elvégzése
    new_qty = slot.current_quantity + quantity

    if new_qty < 0:
        raise HTTPException(
            status_code=400, detail="Nincs ennyi alkatrész a rekeszben a kivételhez!")

    if new_qty > part.max_per_slot:
        raise HTTPException(
            status_code=400, detail=f"A rekesz kapacitása véges! Max: {part.max_per_slot}")

    slot.current_quantity = new_qty

    # Ha elfogyott minden, felszabadítjuk a rekeszt (part_id = None)
    if slot.current_quantity == 0:
        slot.part_id = None

    new_log = models.KeszletNaplo(
        rekesz_id=slot_id,
        part_id=part_id,
        user_id=current_user.id,
        type="Bevételezés" if quantity > 0 else "Kivételezés",
        quantity=abs(quantity)
    )
    db.add(new_log)
    db.commit()
    return {"message": "Készlet frissítve és naplózva", "új mennyiség": slot.current_quantity}


@router.get("/warehouse/suggest-split/{part_id}")
def suggest_split(part_id: int, quantity: int, db: Session = Depends(database.get_db)):
    part = db.query(models.Part).filter(models.Part.id == part_id).first()
    if not part:
        raise HTTPException(status_code=404, detail="Alkatrész nem található")

    suggestions = []
    remaining_qty = quantity

    # 1. Meglévő helyek feltöltése (ahol már ez az alkatrész van)
    existing_slots = db.query(models.WarehouseSlot).filter(
        models.WarehouseSlot.part_id == part_id,
        models.WarehouseSlot.current_quantity < part.max_per_slot
    ).order_by(models.WarehouseSlot.current_quantity.desc()).all()

    for slot in existing_slots:
        if remaining_qty <= 0:
            break
        space_left = part.max_per_slot - slot.current_quantity
        to_put_here = min(remaining_qty, space_left)

        suggestions.append({
            "slot_id": slot.id,
            "readable_id": slot.readable_id,
            "quantity": to_put_here,
            "reason": f"Hely van még: {space_left} db"
        })
        remaining_qty -= to_put_here

    # 2. Üres helyek keresése, ha még maradt alkatrész
    if remaining_qty > 0:
        empty_slots = db.query(models.WarehouseSlot).filter(
            models.WarehouseSlot.part_id == None
        ).all()

        for slot in empty_slots:
            if remaining_qty <= 0:
                break
            to_put_here = min(remaining_qty, part.max_per_slot)

            suggestions.append({
                "slot_id": slot.id,
                "readable_id": slot.readable_id,
                "quantity": to_put_here,
                "reason": "Üres rekesz"
            })
            remaining_qty -= to_put_here

    if remaining_qty > 0:
        raise HTTPException(
            status_code=400, detail=f"Nincs elég hely! {remaining_qty} db-nak nem jutott rekesz.")

    return suggestions

# expert_management.py vagy warehouse_management.py


@router.post("/projects/{p_id}/confirm-prepared")
def confirm_parts_prepared(p_id: int, db: Session = Depends(database.get_db)):
    project = db.query(models.Projekt).filter(
        models.Projekt.id == p_id).first()

    # 1. Ellenőrizzük, hogy minden tételből van-e elég (Double-check)
    project_parts = db.query(models.ProjektAlkatresz).filter(
        models.ProjektAlkatresz.projekt_id == p_id).all()

    for item in project_parts:
        # Aktuális szabad készlet lekérése
        total_stock = db.query(func.sum(models.WarehouseSlot.current_quantity))\
                        .filter(models.WarehouseSlot.part_id == item.part_id).scalar() or 0

        if total_stock < item.required_quantity:
            raise HTTPException(
                status_code=400, detail=f"Nincs elég készlet: {item.part_id}")

    # 2. Levonás a raktárból (FIFO vagy legkisebb slot alapján)
    for item in project_parts:
        remaining_to_deduct = item.required_quantity
        slots = db.query(models.WarehouseSlot)\
                  .filter(models.WarehouseSlot.part_id == item.part_id)\
                  .order_by(models.WarehouseSlot.current_quantity.asc()).all()

        for slot in slots:
            if remaining_to_deduct <= 0:
                break
            deduct = min(slot.current_quantity, remaining_to_deduct)
            slot.current_quantity -= deduct
            remaining_to_deduct -= deduct

    # 3. Státuszváltás -> Most már generálható a PDF!
    project.status = "Scheduled"
    db.add(models.ProjektNaplo(projekt_id=p_id,
           status="Scheduled", message="Raktár visszaigazolta."))
    db.commit()

    return {"message": "Sikeres visszaigazolás, a projekt Scheduled állapotba került."}
