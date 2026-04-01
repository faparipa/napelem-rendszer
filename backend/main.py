from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

# Saját modulok importálása
import models
import database
import auth
import user_management
import parts_management
import warehouse_management
import expert_management

# --- EZ A SOR HOZZA LÉTRE AZ ADATBÁZIST INDÍTÁSKOR ---
models.Base.metadata.create_all(bind=database.engine)

app = FastAPI(title="Napelem Rendszer Raktárkezelő")

# --- CORS BEÁLLÍTÁS (hogy a React elérje a backendet) ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- ROUTEREK REGISZTRÁLÁSA ---
app.include_router(user_management.router)
app.include_router(parts_management.router)
app.include_router(warehouse_management.router)
app.include_router(expert_management.router)


@app.post("/login")
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(database.get_db)):
    # Itt models.User.username-et keresünk, ami a models.py-ban a "Felhasznalonev" oszlop!
    user = db.query(models.User).filter(
        models.User.username == form_data.username).first()

    if not user:
        # Ha ide jut, nem találta meg a felhasználónevet
        print(f"DEBUG: Felhasználó nem található: {form_data.username}")
        raise HTTPException(status_code=401, detail="Hibás felhasználónév")

    if not auth.verify_password(form_data.password, user.password_hash):
        # Ha ide jut, a jelszó (Admin1) nem egyezik a hash-el
        print(f"DEBUG: Hibás jelszó a felhasználóhoz: {user.username}")
        raise HTTPException(status_code=401, detail="Hibás jelszó")

    # Ha minden jó, tokent generálunk
    access_token = auth.create_access_token(
        data={"sub": user.username, "role": user.role}
    )
    return {"access_token": access_token, "token_type": "bearer"}
