from database import SessionLocal, engine
import models
import auth


def seed_admin():
    # Táblák létrehozása, ha még nem léteznek
    models.Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    admin_exists = db.query(models.User).filter(
        models.User.username == "admin").first()

    if not admin_exists:
        # FONTOS: Az auth.pwd_context-et használjuk!
        hashed_pw = auth.pwd_context.hash("admin123")
        admin_user = models.User(
            username="admin",
            password_hash=hashed_pw,
            role="Adminisztrátor",
            is_admin=True
        )
        db.add(admin_user)
        db.commit()
        print("Admin sikeresen létrehozva: admin / admin123")
    else:
        # Ha már létezik, frissítsük a jelszavát, hogy biztosan be tudj lépni
        admin_exists.password_hash = auth.pwd_context.hash("admin123")
        db.commit()
        print("Admin jelszava frissítve: admin123")
    db.close()


if __name__ == "__main__":
    seed_admin()
