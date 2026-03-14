from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm  # <--- Ez a fontos sor!
from sqlalchemy.orm import Session
from pydantic import BaseModel
import models
import database
import auth
import user_management
import parts_management

app = FastAPI(title="Napelem Rendszer")
app.include_router(user_management.router)
app.include_router(parts_management.router)

# main.py-ban a login végpontod pontosan ilyen legyen:


@app.post("/login")
def login(
    form_data: OAuth2PasswordRequestForm = Depends(),  # <--- Ez a kulcs!
    db: Session = Depends(database.get_db)
):
    user = db.query(models.User).filter(
        models.User.username == form_data.username).first()

    if not user or not auth.verify_password(form_data.password, user.password_hash):
        # Fontos: a 401 mellé kell ez a fejléc a Swaggernek!
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Hibás felhasználónév vagy jelszó",
            headers={"WWW-Authenticate": "Bearer"},
        )

    access_token = auth.create_access_token(
        data={"sub": user.username, "role": user.role, "is_admin": user.is_admin}
    )
    # A válasznak pontosan ilyen struktúrájúnak kell lennie:
    return {"access_token": access_token, "token_type": "bearer"}

# Adatséma az új felhasználóhoz


class UserCreate(BaseModel):
    username: str
    password: str
    role: str  # 'Szakember', 'Raktárvezető' vagy 'Raktáros'
    is_admin: bool = False


@app.post("/users", status_code=status.HTTP_201_CREATED)
def create_user(
    user_data: UserCreate,
    db: Session = Depends(database.get_db),
    admin_user: models.User = Depends(
        auth.require_admin)  # Csak admin érheti el!
):
    # Ellenőrizzük, létezik-e már a név
    existing_user = db.query(models.User).filter(
        models.User.username == user_data.username).first()
    if existing_user:
        raise HTTPException(
            status_code=400, detail="Ez a felhasználónév már foglalt")

    # Új felhasználó mentése
    new_user = models.User(
        username=user_data.username,
        password_hash=auth.pwd_context.hash(user_data.password),
        role=user_data.role,
        is_admin=user_data.is_admin
    )
    db.add(new_user)
    db.commit()
    return {"message": f"'{user_data.username}' felhasználó sikeresen létrehozva."}
