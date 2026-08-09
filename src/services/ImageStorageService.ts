import { Directory, Filesystem } from '@capacitor/filesystem'

/**
 * Persists customer business-card images as real files on disk via
 * @capacitor/filesystem, instead of storing image bytes inside SQLite.
 * Only the relative file path is ever written to the `cards` table.
 *
 * All paths live under Directory.Data / business-cards/, and the folder is
 * recreated automatically if it's missing (e.g. after an app reinstall or a
 * restored backup that only brought back the database file).
 */
const IMAGE_FOLDER = 'business-cards'

function extensionFromMimeType(mimeType: string): string {
  const map: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/heic': 'heic',
    'image/heif': 'heif',
  }
  return map[mimeType] ?? 'bin'
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result
      if (typeof result !== 'string') {
        reject(new Error('تعذر قراءة الصورة.'))
        return
      }
      // FileReader.readAsDataURL yields "data:<mime>;base64,<data>" — strip the prefix.
      resolve(result.split(',', 2)[1] ?? '')
    }
    reader.onerror = () => reject(reader.error ?? new Error('تعذر قراءة الصورة.'))
    reader.readAsDataURL(file)
  })
}

function base64ToBlob(base64: string, mimeType: string): Blob {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return new Blob([bytes], { type: mimeType })
}

async function ensureFolder(): Promise<void> {
  try {
    await Filesystem.mkdir({
      path: IMAGE_FOLDER,
      directory: Directory.Data,
      recursive: true,
    })
  } catch {
    // Already exists — mkdir throws in that case, which is fine.
  }
}

export class ImageStorageService {
  /** Saves a file under the business-cards folder and returns its relative path. */
  async save(customerId: string, file: File): Promise<{ path: string; mimeType: string; fileName: string }> {
    await ensureFolder()

    const mimeType = file.type || 'image/jpeg'
    const extension = extensionFromMimeType(mimeType)
    const path = `${IMAGE_FOLDER}/${customerId}-${Date.now()}.${extension}`
    const base64 = await fileToBase64(file)

    await Filesystem.writeFile({
      path,
      directory: Directory.Data,
      data: base64,
    })

    return { path, mimeType, fileName: file.name || `business-card.${extension}` }
  }

  /** Reads a previously saved image back as a File, recreating the folder if it went missing. */
  async read(path: string, mimeType: string, fileName: string): Promise<File | null> {
    try {
      await ensureFolder()
      const result = await Filesystem.readFile({ path, directory: Directory.Data })
      const base64 = typeof result.data === 'string' ? result.data : await (result.data as Blob).text()
      const blob = base64ToBlob(base64, mimeType)
      return new File([blob], fileName, { type: mimeType })
    } catch {
      return null
    }
  }

  /** Deletes a stored image. Safe to call even if the file no longer exists. */
  async delete(path: string): Promise<void> {
    try {
      await Filesystem.deleteFile({ path, directory: Directory.Data })
    } catch {
      // Missing file is not an error for a delete.
    }
  }
}

export const imageStorageService = new ImageStorageService()
