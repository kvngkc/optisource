/**
 * Compresses an image file natively via the Canvas API.
 * Preserves standard aspect ratios. 1200px max width ensures very strong 
 * text clarity for receipts, bank proofs, or lens diagrams, while 
 * WebP encoding dramatically slashes file size by up to 90%.
 * 
 * @param {File} file - The raw image File object
 * @returns {Promise<File|Blob>} - The compressed WebP blob (or original file if SVG/unsupported)
 */
export async function compressImage(file, maxWidth = 1200, quality = 0.8) {
  if (!file || !file.type.startsWith('image/')) return file
  // SVGs don't need raster compression
  if (file.type === 'image/svg+xml') return file

  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.readAsDataURL(file)
    reader.onload = event => {
      const img = new Image()
      img.src = event.target.result
      img.onload = () => {
        // Calculate new dimensions
        let width = img.width
        let height = img.height

        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width)
          width = maxWidth
        }

        // Draw onto local canvas object
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, width, height)

        // Compress and convert to WEBP payload
        canvas.toBlob(
          blob => {
            if (!blob) {
              reject(new Error('Canvas is empty'))
              return
            }
            // Retain original name but append .webp for safety
            const newName = file.name.replace(/\.[^/.]+$/, "") + ".webp"
            const compressedFile = new File([blob], newName, {
              type: 'image/webp',
              lastModified: Date.now()
            })
            resolve(compressedFile)
          },
          'image/webp',
          quality
        )
      }
      img.onerror = error => reject(error)
    }
    reader.onerror = error => reject(error)
  })
}
