// Client-side validointi tiedostojen upload-flow'lle. Ei korvaa palvelinpuolen
// tarkistuksia, mutta antaa käyttäjälle nopean palautteen ja karsii ilmiselvät
// väärän tyypin/koon tiedostot ennen kuin ne edes menevät Supabasen storageen.

// Kuvat (kuitit, laitekuvat) — allow HEIC koska iOS-kameraan oletuksena
export const IMAGE_MIME = new Set([
  'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/heif',
])
export const IMAGE_EXT = new Set(['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif'])
export const IMAGE_MAX_BYTES = 10 * 1024 * 1024 // 10 MB

// Dokumentit (kirjanpito, sopimukset ym.) — PDF ensisijaisesti + kuvat + Office
export const DOC_MIME = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // xlsx
  'application/vnd.ms-excel',                                          // xls
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // docx
  'application/msword',                                                // doc
  'text/csv',
  'text/plain',
  ...IMAGE_MIME,
])
export const DOC_EXT = new Set(['pdf', 'xlsx', 'xls', 'docx', 'doc', 'csv', 'txt', ...IMAGE_EXT])
export const DOC_MAX_BYTES = 25 * 1024 * 1024 // 25 MB

function fileExt(name) {
  const idx = (name || '').lastIndexOf('.')
  return idx > 0 ? name.slice(idx + 1).toLowerCase() : ''
}

// Palauttaa null jos OK, tai virhemerkkijono jos ei kelpaa.
export function validateImage(file) {
  if (!file) return 'Ei tiedostoa.'
  if (file.size > IMAGE_MAX_BYTES) {
    return `Tiedosto liian suuri (${(file.size / 1024 / 1024).toFixed(1)} MB). Max ${IMAGE_MAX_BYTES / 1024 / 1024} MB.`
  }
  const ext = fileExt(file.name)
  const mimeOk = IMAGE_MIME.has((file.type || '').toLowerCase())
  const extOk = IMAGE_EXT.has(ext)
  // MIME on epäluotettava HEIC:llä (jotkut selaimet antavat tyhjän) → salli
  // jos joko MIME tai päätä on ok.
  if (!mimeOk && !extOk) {
    return `Vain kuvat sallittu (jpg, png, webp, heic). Tiedoston tyyppi: ${file.type || 'tuntematon'}.`
  }
  return null
}

export function validateDocument(file) {
  if (!file) return 'Ei tiedostoa.'
  if (file.size > DOC_MAX_BYTES) {
    return `Tiedosto liian suuri (${(file.size / 1024 / 1024).toFixed(1)} MB). Max ${DOC_MAX_BYTES / 1024 / 1024} MB.`
  }
  const ext = fileExt(file.name)
  const mimeOk = DOC_MIME.has((file.type || '').toLowerCase())
  const extOk = DOC_EXT.has(ext)
  if (!mimeOk && !extOk) {
    return `Sallitut: pdf, xlsx, xls, docx, doc, csv, txt, kuvat. Tiedoston tyyppi: ${file.type || 'tuntematon'}.`
  }
  return null
}

// Yhteinen accept-attribuutti input[type=file]:lle
export const IMAGE_ACCEPT = 'image/jpeg,image/png,image/webp,image/heic,image/heif,.jpg,.jpeg,.png,.webp,.heic,.heif'
export const DOC_ACCEPT   = 'application/pdf,image/*,.pdf,.xlsx,.xls,.docx,.doc,.csv,.txt'
