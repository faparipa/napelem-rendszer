DROP DATABASE IF EXISTS beadando;
CREATE DATABASE beadando DEFAULT CHARACTER SET utf8 COLLATE utf8_hungarian_ci;
USE beadando;

-- 1. Felhasználók (Admin, Szakember, Raktárvezeto, Raktáros) [cite: 68, 69]
CREATE TABLE Felhasznalo (
    Felhasznalo_ID INT AUTO_INCREMENT PRIMARY KEY,
    Pozicio ENUM('Adminisztrator','Szakember','Raktarvezeto','Raktaros') NOT NULL,
    Felhasznalonev VARCHAR(30) NOT NULL UNIQUE,
    Jelszo VARCHAR(255) NOT NULL
);

INSERT INTO Felhasznalo (Pozicio, Felhasznalonev, Jelszo) VALUES 
('Adminisztrator','vargaistvan','$2b$12$KqsFCp/EVMAemm7jZoyJ/OFgORQtaxD6./FlqVgiOxuHlYiGLf.ay'),
('Szakember','kisstamas','$2b$12$sYpR7a.aMX.4o86URYR.2eUpYKletLchHwXvx2sRCnMg2HDWBvvXW'),
('Raktarvezeto','nagyimre','$2b$12$HokkSZP7mfTKR88.sUwLpOjlEur70sg./autVWDvSFAng9Dg1dSJe'),
('Raktaros','bogdanlajos','2b$12$ltivOaCaS3jIKCb52sUFLO8hsgKkUzxhdjZ75IKhrU6VG6iAkuhdi');

-- 2. Alkatrészek [cite: 53]
CREATE TABLE Alkatresz (
    Alkatresz_ID INT AUTO_INCREMENT PRIMARY KEY,
    Nev VARCHAR(100) NOT NULL,
    Ar INT NOT NULL,
    Rekesz_Max_Mennyiseg INT NOT NULL
);

INSERT INTO Alkatresz (Nev, Ar, Rekesz_Max_Mennyiseg) VALUES 
('Napelem panel 400W', 65000, 20),
('Fronius Inverter 5kW', 450000, 5),
('Szolár kábel tekercs', 25000, 10),
('Aluminium tartókonzol', 8500, 50);

-- 3. Rekeszek (Emberi azonosítóval az útvonalhoz) [cite: 8, 25, 58]
DROP TABLE IF EXISTS rekesz;
CREATE TABLE rekesz (
    Rekesz_ID INT AUTO_INCREMENT PRIMARY KEY,
    Readable_ID VARCHAR(20) UNIQUE NOT NULL,
    Sor INT NOT NULL,
    Oszlop INT NOT NULL,
    Szint INT NOT NULL,
    Rekesz_Szam INT NOT NULL, 
    Alkatresz_ID INT NULL,
    Mennyiseg INT DEFAULT 0,
    FOREIGN KEY (Alkatresz_ID) REFERENCES alkatresz(Alkatresz_ID)
);

INSERT INTO Rekesz (Readable_ID, Sor, Oszlop, Szint, Alkatresz_ID, Mennyiseg) VALUES 
('S1-O1-SZ1', 1, 1, 1, 1, 15),
('S1-O2-SZ1', 1, 2, 1, 2, 2),
('S2-O1-SZ1', 2, 1, 1, 3, 5),
('S3-O1-SZ2', 3, 1, 2, 4, 40),
('S1-O1-SZ2', 1, 1, 2, NULL, 0);

-- 4. Projektek [cite: 32-39]
CREATE TABLE Projekt(
    Projekt_ID INT AUTO_INCREMENT PRIMARY KEY,
    Megrendelo_Adatok VARCHAR(100) NOT NULL,
    Helyszin VARCHAR(150) NOT NULL,
    Leiras TEXT,
    Statusz ENUM('New','Draft','Wait','Scheduled','InProgress','Completed','Failed') NOT NULL,
    Becsult_ido INT,
    Ar INT
);

INSERT INTO Projekt (Megrendelo_Adatok, Helyszin, Leiras, Statusz, Becsult_ido, Ar) VALUES 
('Kiss János','8800 Nagykanizsa Arany János utca 20', 'Családi házra napelem','New',NULL,NULL),
('Lakatos Nándor','8800 Nagykanizsa Csengery utca 2', 'Családi házra napelem','Scheduled',40,2500000);

-- 5. Projekt Napló (Statisztikákhoz) [cite: 40, 41]
CREATE TABLE Projekt_Naplo(
    Naplo_ID INT AUTO_INCREMENT PRIMARY KEY,
    Projekt_ID INT NOT NULL,
    Statusz ENUM('New','Draft','Wait','Scheduled','InProgress','Completed','Failed') NOT NULL,
    Datum DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (Projekt_ID) REFERENCES Projekt(Projekt_ID)
);

-- 6. Projekt Alkatrészek (Foglalások) [cite: 4, 5, 47]
CREATE TABLE Projekt_Alkatresz(
    Foglalas_ID INT AUTO_INCREMENT PRIMARY KEY,
    Projekt_ID INT NOT NULL,
    Alkatresz_ID INT NOT NULL,
    Szukseges_Mennyiseg INT NOT NULL DEFAULT 0,
    Lefoglalt_Mennyiseg INT NOT NULL DEFAULT 0,
    Elofoglalt_Mennyiseg INT NOT NULL DEFAULT 0,
    Egysegar_Rogzitve INT NULL,
    FOREIGN KEY (Projekt_ID) REFERENCES Projekt(Projekt_ID),
    FOREIGN KEY (Alkatresz_ID) REFERENCES Alkatresz(Alkatresz_ID)
);

-- 7. Készlet Napló (Mozgások követése) [cite: 41]
CREATE TABLE Keszlet_Naplo (
    Naplo_ID INT AUTO_INCREMENT PRIMARY KEY,
    Rekesz_ID INT NOT NULL,
    Alkatresz_ID INT NOT NULL,
    Felhasznalo_ID INT NOT NULL,
    Tipus ENUM('Bevételezés', 'Kivételezés', 'Leltár korrekció') NOT NULL,
    Mennyiseg INT NOT NULL,
    Datum DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (Rekesz_ID) REFERENCES Rekesz(Rekesz_ID),
    FOREIGN KEY (Alkatresz_ID) REFERENCES Alkatresz(Alkatresz_ID),
    FOREIGN KEY (Felhasznalo_ID) REFERENCES Felhasznalo(Felhasznalo_ID)
);