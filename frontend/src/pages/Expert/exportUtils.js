import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export const generateProjectPDF = (project, projectParts, calc, totals) => {
  if (project.status == 'Wait') {
    alert(
      'PDF csak akkor generálható, ha minden alkatrész rendelkezésre áll !'
    );
    return;
  }

  try {
    const doc = new jsPDF();

    // --- CÉG ADATOK (Bal felső sarok) ---
    doc.setFontSize(14);
    doc.setFont(undefined, 'bold');
    doc.text('SolarBeadando KFT.', 14, 15);

    doc.setFontSize(9);
    doc.setFont(undefined, 'normal');
    doc.text('Cím: 8800 Nagykanizsa, Zrínyi Miklós u. 18.', 14, 22);
    doc.text('Telefon: +36 30 121 2121 | Adószám: 12345678-9-10', 14, 27);

    // --- BIZONYLAT CÍME (Lejjebb tolva, hogy ne csússzon rá a fejlécre) ---
    doc.setFontSize(22);
    doc.setFont(undefined, 'bold');
    doc.text('MEGRENDELÉS ÉS ÁRAJÁNLAT', 14, 45);

    // --- PROJEKT INFORMÁCIÓK ---
    doc.setFontSize(11);
    doc.setFont(undefined, 'normal');
    doc.text(`Projekt helyszíne: ${project.location}`, 14, 55);
    doc.text(
      `Visszaigazolás dátuma: ${new Date().toLocaleDateString('hu-HU')}`,
      14,
      62
    );
    doc.text(`Projekt azonosító: #PRJ-${project.id}`, 14, 69);

    // --- TÁBLÁZAT ADATAI ---
    const tableColumn = ['Alkatrész', 'Mennyiség', 'Egységár', 'Összesen'];
    const tableRows = projectParts.map((item) => [
      item.name,
      `${item.required_quantity} db`,
      `${item.price.toLocaleString()} Ft`,
      `${(item.price * item.required_quantity).toLocaleString()} Ft`,
    ]);

    // Táblázat generálása
    autoTable(doc, {
      startY: 75, // Itt kezdődik a táblázat, így nem takarja ki a fenti szövegeket
      head: [tableColumn],
      body: tableRows,
      theme: 'grid',
      headStyles: { fillColor: [44, 62, 80], halign: 'center' },
      columnStyles: {
        1: { halign: 'center' }, // Mennyiség középre
        2: { halign: 'right' }, // Egységár jobbra
        3: { halign: 'right' }, // Összesen jobbra
      },
    });

    // --- ÖSSZESÍTÉS (Dinamikusan a táblázat vége után) ---
    const finalY = doc.lastAutoTable.finalY + 15;

    doc.setFontSize(12);
    doc.setFont(undefined, 'normal');
    doc.text(`Anyagköltség összesen:`, 14, finalY);
    doc.text(`${totals.partsTotal.toLocaleString()} Ft`, 120, finalY, {
      align: 'right',
    });

    doc.text(`Munkadíj (${calc.hours} óra):`, 14, finalY + 8);
    doc.text(`${totals.laborTotal.toLocaleString()} Ft`, 120, finalY + 8, {
      align: 'right',
    });

    // Vízszintes elválasztó vonal a végösszeg előtt
    doc.setDrawColor(44, 62, 80);
    doc.line(14, finalY + 12, 120, finalY + 12);

    // Végösszeg kiemelése
    doc.setFontSize(14);
    doc.setFont(undefined, 'bold');
    doc.text(`VÉGÖSSZEG:`, 14, finalY + 20);
    doc.text(`${totals.grandTotal.toLocaleString()} Ft`, 120, finalY + 20, {
      align: 'right',
    });

    // Mentés
    doc.save(`megrendeles_${project.id}.pdf`);
  } catch (error) {
    console.error('PDF hiba:', error);
    alert('Hiba történt a PDF generálása közben!');
  }
};
