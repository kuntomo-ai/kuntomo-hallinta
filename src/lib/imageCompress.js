// Downscale + JPEG-encode an uploaded image to keep Storage costs sane.
// Returns a Blob ready for supabase.storage.upload().
export async function compressImg(file, maxWidth = 1400, quality = 0.72) {
  return new Promise(resolve => {
    const img = new Image()
    const blobUrl = URL.createObjectURL(file)
    img.onload = () => {
      const scale = Math.min(1, maxWidth / img.width)
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(img.width * scale)
      canvas.height = Math.round(img.height * scale)
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
      URL.revokeObjectURL(blobUrl)
      canvas.toBlob(resolve, 'image/jpeg', quality)
    }
    img.src = blobUrl
  })
}
