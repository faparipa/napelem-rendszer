from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
import models
import database
import auth

router = APIRouter(tags=["User Management"])

# --- SÉMÁK (Pydantic) ---


class UserCreate(BaseModel):
    username: str
    password: str
    role: str  # A MySQL-ben ez a 'Pozicio'


class UserUpdate(BaseModel):
    role: str = None
    password: str = None


class UserOut(BaseModel):
    id: int
    username: str
    role: str

    class Config:
        from_attributes = True

# --- VÉGPONTOK ---

# 1. LISTÁZÁS (Minden felhasználó lekérése)


@router.get("/users", response_model=List[UserOut])
def get_users(
    db: Session = Depends(database.get_db),
    current_admin: models.User = Depends(auth.require_admin)
):
    # Most már nem fog 500-as hibát dobni, mert nem keresi az 'is_admin'-t
    return db.query(models.User).all()

# 2. LÉTREHOZÁS


@router.post("/users", status_code=status.HTTP_201_CREATED)
def create_user(
    user_data: UserCreate,
    db: Session = Depends(database.get_db),
    current_admin: models.User = Depends(auth.require_admin)
):
    existing_user = db.query(models.User).filter(
        models.User.username == user_data.username).first()
    if existing_user:
        raise HTTPException(
            status_code=400, detail="Ez a felhasználónév már foglalt.")

    new_user = models.User(
        username=user_data.username,
        password_hash=auth.pwd_context.hash(user_data.password),
        role=user_data.role
    )
    db.add(new_user)
    db.commit()
    return {"message": "Sikeres mentés"}

# 3. MÓDOSÍTÁS


@router.put("/users/{user_id}")
def update_user(
    user_id: int,
    user_data: UserUpdate,
    db: Session = Depends(database.get_db),
    current_admin: models.User = Depends(auth.require_admin)
):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=404, detail="Felhasználó nem található")

    if user_data.role:
        user.role = user_data.role
    if user_data.password:
        user.password_hash = auth.pwd_context.hash(user_data.password)

    db.commit()
    return {"message": "Felhasználó adatai frissítve."}

# 4. TÖRLÉS


@router.delete("/users/{user_id}")
def delete_user(
    user_id: int,
    db: Session = Depends(database.get_db),
    current_admin: models.User = Depends(auth.require_admin)
):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=404, detail="Felhasználó nem található")

    if user.username == current_admin.username:
        raise HTTPException(
            status_code=400, detail="Saját magadat nem törölheted!")

    db.delete(user)
    db.commit()
    return {"message": "Felhasználó törölve."}
