// Builds an actual, self-contained PDF document — not a browser print of
// whatever page happens to be on screen. Now that the dashboard is split
// into separate pages (Overview, AI overview, Interactions, ...), "print
// the current page" would only ever capture a fraction of the picture;
// this instead assembles medications + interactions + the AI summary into
// one clinical-style handout every time, regardless of which page the
// person is currently on.
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { formatTime } from './timing.js'
import { SEVERITY_LABEL } from './interactionData.js'

const BRAND_TEAL = [15, 122, 120]
const INK = [26, 40, 40]
const INK_SOFT = [95, 115, 115]
const SIGNIFICANT = [178, 58, 20]
const MINOR = [150, 108, 10]

const DISCLAIMER =
  "MedCheck is not a substitute for professional medical advice. Interaction data is drawn from public drug databases and can't account for your full clinical picture. If you think you're having a serious reaction, contact a healthcare professional immediately or call 911."

function addHeaderAndFooter(doc, { subjectName }) {
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const marginX = 40
  const pageCount = doc.internal.getNumberOfPages()

  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)

    // Footer disclaimer + page number on every page, since a long
    // medication/interaction list can spill across multiple pages.
    doc.setDrawColor(222, 230, 230)
    doc.line(marginX, pageHeight - 52, pageWidth - marginX, pageHeight - 52)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    doc.setTextColor(...INK_SOFT)
    doc.text(DISCLAIMER, marginX, pageHeight - 38, { maxWidth: pageWidth - marginX * 2 - 70 })
    doc.text(`Page ${i} of ${pageCount}`, pageWidth - marginX, pageHeight - 22, { align: 'right' })
    doc.text(subjectName ? `MedCheck — ${subjectName}` : 'MedCheck', marginX, pageHeight - 22)
  }
}

// medications: [{ name, timeOfDay }]
// interactions: [{ drugs: [a,b], severity, explanation | description }]
// riskSummary: string | null — Gemini's one-paragraph overall summary, or
// null when it couldn't be generated (the PDF just omits that section).
export function generateMedicationSummaryPdf({ subjectName, medications = [], interactions = [], riskSummary }) {
  const doc = new jsPDF({ unit: 'pt', format: 'letter' })
  const marginX = 40
  const pageWidth = doc.internal.pageSize.getWidth()
  let y = 54

  // --- Brand header ---
  doc.setFillColor(...BRAND_TEAL)
  doc.roundedRect(marginX, y - 20, 24, 24, 6, 6, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.text('+', marginX + 12, y - 3, { align: 'center' })

  doc.setTextColor(...INK)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(15)
  doc.text('MedCheck', marginX + 32, y - 2)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...INK_SOFT)
  const generatedStr = `Generated ${new Date().toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}`
  doc.text(generatedStr, pageWidth - marginX, y - 6, { align: 'right' })

  y += 18
  doc.setDrawColor(222, 230, 230)
  doc.line(marginX, y, pageWidth - marginX, y)
  y += 30

  // --- Title ---
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(19)
  doc.setTextColor(...INK)
  doc.text('Medication Summary', marginX, y)
  y += 20

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10.5)
  doc.setTextColor(...INK_SOFT)
  doc.text(subjectName ? `For ${subjectName}` : 'For your own records', marginX, y)
  y += 28

  // --- Medications ---
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12.5)
  doc.setTextColor(...INK)
  doc.text('Medications', marginX, y)
  y += 8

  if (medications.length === 0) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.setTextColor(...INK_SOFT)
    doc.text('No medications on file yet.', marginX, y + 16)
    y += 34
  } else {
    autoTable(doc, {
      startY: y + 8,
      margin: { left: marginX, right: marginX },
      head: [['Medication', 'Time of day']],
      body: medications.map((m) => [m.name, m.timeOfDay ? formatTime(m.timeOfDay) : '—']),
      styles: { fontSize: 10, cellPadding: 7, textColor: INK, lineColor: [222, 230, 230] },
      headStyles: { fillColor: BRAND_TEAL, textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [244, 249, 249] },
    })
    y = doc.lastAutoTable.finalY + 28
  }

  // --- AI risk overview ---
  if (riskSummary) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12.5)
    doc.setTextColor(...INK)
    doc.text('AI risk overview', marginX, y)
    y += 18

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.setTextColor(...INK_SOFT)
    const lines = doc.splitTextToSize(riskSummary, pageWidth - marginX * 2)
    doc.text(lines, marginX, y)
    y += lines.length * 13 + 22
  }

  // --- Interaction check ---
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12.5)
  doc.setTextColor(...INK)
  doc.text('Interaction check', marginX, y)
  y += 8

  if (medications.length < 2) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.setTextColor(...INK_SOFT)
    doc.text('Add at least two medications to check for interactions.', marginX, y + 16)
  } else if (interactions.length === 0) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.setTextColor(...INK_SOFT)
    doc.text('No known interactions found among these medications.', marginX, y + 16)
  } else {
    autoTable(doc, {
      startY: y + 8,
      margin: { left: marginX, right: marginX },
      head: [['Severity', 'Medications', 'What we found']],
      body: interactions.map((it) => [
        SEVERITY_LABEL[it.severity] || it.severity,
        it.drugs.join(' + '),
        it.explanation || it.description || '',
      ]),
      styles: { fontSize: 9, cellPadding: 7, textColor: INK, valign: 'top', lineColor: [222, 230, 230] },
      headStyles: { fillColor: BRAND_TEAL, textColor: 255, fontStyle: 'bold' },
      columnStyles: { 0: { cellWidth: 68 }, 1: { cellWidth: 130 } },
      alternateRowStyles: { fillColor: [244, 249, 249] },
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index === 0) {
          const sev = String(data.cell.raw || '').toLowerCase()
          if (sev === 'significant') data.cell.styles.textColor = SIGNIFICANT
          if (sev === 'minor') data.cell.styles.textColor = MINOR
          data.cell.styles.fontStyle = 'bold'
        }
      },
    })
  }

  addHeaderAndFooter(doc, { subjectName })

  const filenameBase = (subjectName || 'my-medications').toLowerCase().replace(/[^a-z0-9]+/g, '-')
  doc.save(`medcheck-summary-${filenameBase}.pdf`)
}
