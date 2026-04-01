import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export const generateProjectPDF = (project, projectParts, calc, totals) => {
  if (project.status !== 'Scheduled') {
    alert(
      'Hiba: Árkalkuláció csak visszaigazolt (Scheduled) projekthez készíthető!'
    );
    return;
  }
  try {
    const doc = new jsPDF();

    // --- CÉG ADATOK ---
    doc.setFontSize(14);
    doc.setFont(undefined, 'bold');
    doc.text('SolarBeadando KFT.', 14, 15);

    doc.setFontSize(9);
    doc.setFont(undefined, 'normal');
    doc.text('Cím: 8800 Nagykanizsa, Zrínyi Miklós u. 18.', 14, 21);
    doc.text('Telefon: +36 30 121 2121 | Adószám: 12345678-9-10', 14, 26);

    // Fejléc
    doc.setFontSize(20);
    doc.text('MEGRENDELÉS ÉS ÁRAJÁNLAT', 14, 20);

    doc.setFontSize(12);
    doc.text(`Projekt: ${project.location}`, 14, 30);
    doc.text(
      `Visszaigazolva, Dátum: ${new Date().toLocaleDateString('hu-HU')}`,
      14,
      37
    );
    doc.text(`Projekt azonosító: #PRJ-${project.id}`, 14, 44);

    // Táblázat adatai
    const tableColumn = ['Alkatrész', 'Mennyiség', 'Egységár', 'Összesen'];
    const tableRows = projectParts.map((item) => [
      item.name,
      `${item.required_quantity} db`,
      `${item.price} Ft`,
      `${item.price * item.required_quantity} Ft`,
    ]);

    // Táblázat generálása - autoTable(doc, ...) formátummal a hiba elkerülésére
    autoTable(doc, {
      startY: 50,
      head: [tableColumn],
      body: tableRows,
      theme: 'grid',
      headStyles: { fillColor: [44, 62, 80] },
    });

    // Összesítés a táblázat után
    const finalY = doc.lastAutoTable.finalY + 10;
    doc.setFontSize(12);
    doc.text(
      `Anyagköltség összesen: ${totals.partsTotal.toLocaleString()} Ft`,
      14,
      finalY
    );
    doc.text(
      `Munkadíj (${calc.hours} óra): ${totals.laborTotal.toLocaleString()} Ft`,
      14,
      finalY + 8
    );

    doc.setFontSize(14);
    doc.text(
      `VÉGÖSSZEG: ${totals.grandTotal.toLocaleString()} Ft`,
      14,
      finalY + 18
    );

    doc.save(`megrendeles_${project.id}.pdf`);
  } catch (error) {
    console.error('PDF hiba:', error);
    alert('Hiba a PDF generálásakor! Ellenőrizd a konzolt.');
  }
};
