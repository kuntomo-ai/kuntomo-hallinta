import logoUrl from '../logo-musta.svg'

// Kuntomo-brändivärit (vastaa index.css :root -muuttujia)
export const KUNTOMO_PDF_COLORS = {
  violet: [122, 2, 81],        // --violet #7a0251
  violet2: [151, 3, 99],       // --violet2 #970363
  violetDim: [74, 1, 49],      // --violet-dim #4a0131
  rowAlt: [250, 240, 246],     // vaalea rose, vastaa --violet-subtle
  text: [13, 13, 13],
  text2: [68, 68, 68],
  text3: [119, 119, 119],
  border: [214, 199, 209],
}

let cachedLogoPng = null

async function loadLogoPng() {
  if (cachedLogoPng) return cachedLogoPng
  const res = await fetch(logoUrl)
  const svgText = await res.text()
  const svgWithFill = svgText.replace(
    '<svg ',
    `<svg fill="#7a0251" `,
  )
  const blob = new Blob([svgWithFill], { type: 'image/svg+xml;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  try {
    const img = await new Promise((resolve, reject) => {
      const image = new Image()
      image.onload = () => resolve(image)
      image.onerror = reject
      image.src = url
    })
    const scale = 4
    const w = 1057
    const h = 397
    const canvas = document.createElement('canvas')
    canvas.width = w * scale / 4
    canvas.height = h * scale / 4
    const ctx = canvas.getContext('2d')
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    cachedLogoPng = {
      dataUrl: canvas.toDataURL('image/png'),
      aspect: w / h,
    }
    return cachedLogoPng
  } finally {
    URL.revokeObjectURL(url)
  }
}

/**
 * Lisää Kuntomo-brändätyn ylätunnisteen PDF:ään: logo vasemmalla, otsikko oikealla,
 * ohut violetti erotinviiva. Palauttaa seuraavan Y-koordinaatin sisällölle.
 */
export async function addKuntomoHeader(doc, title, subtitle = '') {
  const pageW = doc.internal.pageSize.getWidth()
  const marginL = 14
  const marginR = 14
  const topY = 12

  const logoW = 38
  let logoH = 14
  try {
    const logo = await loadLogoPng()
    logoH = logoW / logo.aspect
    doc.addImage(logo.dataUrl, 'PNG', marginL, topY, logoW, logoH)
  } catch {
    // Jos logon lataus epäonnistuu, jatketaan ilman logoa
  }

  // Otsikko oikealla ylhäällä
  doc.setTextColor(...KUNTOMO_PDF_COLORS.violet)
  doc.setFontSize(14)
  doc.setFont(undefined, 'bold')
  doc.text(title, pageW - marginR, topY + 6, { align: 'right' })

  if (subtitle) {
    doc.setFontSize(9)
    doc.setFont(undefined, 'normal')
    doc.setTextColor(...KUNTOMO_PDF_COLORS.text3)
    doc.text(subtitle, pageW - marginR, topY + 12, { align: 'right' })
  }

  // Erotinviiva
  const lineY = topY + Math.max(logoH, 14) + 3
  doc.setDrawColor(...KUNTOMO_PDF_COLORS.violet)
  doc.setLineWidth(0.6)
  doc.line(marginL, lineY, pageW - marginR, lineY)

  // Palauta sisällön aloitus-Y
  doc.setTextColor(...KUNTOMO_PDF_COLORS.text)
  doc.setFont(undefined, 'normal')
  return lineY + 6
}

/**
 * Yhteiset autoTable-tyylit Kuntomo-brändin mukaisesti.
 * Yhdistä omiin asetuksiisi spread-operaattorilla.
 */
export function kuntomoTableStyles() {
  return {
    headStyles: {
      fillColor: KUNTOMO_PDF_COLORS.violet,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
    },
    alternateRowStyles: { fillColor: KUNTOMO_PDF_COLORS.rowAlt },
    styles: { lineColor: KUNTOMO_PDF_COLORS.border, lineWidth: 0.1 },
  }
}

/**
 * Lisää sivunumeron + päivämäärän alareunaan.
 * Kutsu doc.save():n edellä.
 */
export function addKuntomoFooter(doc) {
  const pageCount = doc.internal.getNumberOfPages()
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const today = new Date().toLocaleDateString('fi-FI')
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFontSize(8)
    doc.setTextColor(...KUNTOMO_PDF_COLORS.text3)
    doc.text(`Kuntomo Oy · ${today}`, 14, pageH - 8)
    doc.text(`Sivu ${i}/${pageCount}`, pageW - 14, pageH - 8, { align: 'right' })
  }
}
