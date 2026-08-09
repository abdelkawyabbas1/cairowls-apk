import { initDatabase } from '@/database/Database'
import { sqliteService } from '@/database/SQLiteService'
import { cardRepository } from '@/database/CardRepository'
import { imageStorageService } from '@/services/ImageStorageService'
import type {
  Customer,
  CustomerBackup,
  CustomerSearchOptions,
  NewCustomer,
} from '@/models/Customer'
import type { CustomerRepository as CustomerRepositoryContract } from '@/repositories/CustomerRepository'

interface CustomerRow {
  id: string
  name: string
  company: string
  phone: string
  email: string
  address: string
  country: string
  job_titles_json: string
  other_job_title: string
  business_types_json: string
  products_json: string
  product_type: string
  interest: string | null
  notes: string
  created_at: string
  updated_at: string
}

function createId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function rowToCustomer(row: CustomerRow, card: { image: string | null; title: string; description: string } | null): Customer {
  return {
    id: row.id,
    name: row.name,
    company: row.company,
    mobile: row.phone,
    email: row.email,
    country: row.country,
    jobTitles: JSON.parse(row.job_titles_json) as string[],
    otherJobTitle: row.other_job_title,
    businessTypes: JSON.parse(row.business_types_json) as string[],
    products: JSON.parse(row.products_json) as string[],
    productType: row.product_type as Customer['productType'],
    interest: (row.interest as Customer['interest']) ?? null,
    notes: row.notes,
    businessCardImageId: card?.image ?? null,
    businessCardFileName: card ? card.title : null,
    businessCardMimeType: card ? card.description : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function normaliseSearch(value: string): string {
  return value.trim().toLocaleLowerCase('ar')
}

function matchesSearch(customer: Customer, query: string): boolean {
  if (!query) return true
  return [customer.name, customer.company, customer.mobile, customer.email, customer.country]
    .some((value) => normaliseSearch(value).includes(query))
}

function sortCustomers(customers: Customer[], sort: CustomerSearchOptions['sort']): Customer[] {
  return [...customers].sort((first, second) => {
    if (sort === 'oldest') return first.createdAt.localeCompare(second.createdAt)
    if (sort === 'name') return first.name.localeCompare(second.name, 'ar')
    if (sort === 'company') return first.company.localeCompare(second.company, 'ar')
    return second.createdAt.localeCompare(first.createdAt)
  })
}

/**
 * Native SQLite implementation of the CustomerRepository contract. Business
 * card images are written to disk through ImageStorageService; only the
 * resulting file path is persisted in the `cards` table (`image` column).
 * The public interface — every method name and its arguments — is identical
 * to the previous IndexedDB implementation, so App.tsx does not change.
 */
export class SQLiteCustomerRepository implements CustomerRepositoryContract {
  private async ready(): Promise<void> {
    await initDatabase()
  }

  async create(input: NewCustomer, businessCard?: File | null): Promise<Customer> {
    await this.ready()
    const now = new Date().toISOString()
    const id = createId()
    const savedCard = businessCard ? await imageStorageService.save(id, businessCard) : null

    try {
      await sqliteService.transaction(async (db) => {
        await db.run(
          `INSERT INTO customers (
            id, name, company, phone, email, address, country,
            job_titles_json, other_job_title, business_types_json, products_json,
            product_type, interest, notes, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            id, input.name, input.company, input.mobile, input.email, '', input.country,
            JSON.stringify(input.jobTitles), input.otherJobTitle,
            JSON.stringify(input.businessTypes), JSON.stringify(input.products),
            input.productType, input.interest, input.notes, now, now,
          ],
        )
        if (savedCard) {
          await db.run(
            `INSERT INTO cards (id, customer_id, title, description, image, created_at)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [createId(), id, savedCard.fileName, savedCard.mimeType, savedCard.path, now],
          )
        }
        await db.run(
          `INSERT INTO history (id, customer_id, action, created_at) VALUES (?, ?, ?, ?)`,
          [createId(), id, 'created', now],
        )
      })
    } catch (error) {
      if (savedCard) await imageStorageService.delete(savedCard.path).catch(() => undefined)
      throw error
    }
    await sqliteService.saveToStore()

    const created = await this.getById(id)
    if (!created) throw new Error('تعذر إنشاء العميل.')
    return created
  }

  async getById(id: string): Promise<Customer | null> {
    await this.ready()
    const rows = await sqliteService.query<CustomerRow>(`SELECT * FROM customers WHERE id = ?`, [id])
    const row = rows[0]
    if (!row) return null
    const card = await cardRepository.getByCustomerId(id)
    return rowToCustomer(row, card ? { image: card.image, title: card.title, description: card.description } : null)
  }

  async list(options: CustomerSearchOptions = {}): Promise<Customer[]> {
    await this.ready()
    const rows = await sqliteService.query<CustomerRow>(`SELECT * FROM customers`)
    const customers = await Promise.all(rows.map(async (row) => {
      const card = await cardRepository.getByCustomerId(row.id)
      return rowToCustomer(row, card ? { image: card.image, title: card.title, description: card.description } : null)
    }))

    const filtered = customers.filter((customer) => matchesSearch(customer, normaliseSearch(options.query ?? '')))
    const sorted = sortCustomers(filtered, options.sort)
    return options.limit ? sorted.slice(0, options.limit) : sorted
  }

  async update(id: string, input: NewCustomer, businessCard?: File | null): Promise<Customer> {
    await this.ready()
    const existing = await this.getById(id)
    if (!existing) throw new Error('لم يتم العثور على العميل المطلوب.')

    const now = new Date().toISOString()
    const previousCards = await cardRepository.listByCustomerId(id)
    const replacement = businessCard ? await imageStorageService.save(id, businessCard) : null

    try {
      await sqliteService.transaction(async (db) => {
        await db.run(
          `UPDATE customers SET
            name = ?, company = ?, phone = ?, email = ?, country = ?,
            job_titles_json = ?, other_job_title = ?, business_types_json = ?,
            products_json = ?, product_type = ?, interest = ?, notes = ?, updated_at = ?
          WHERE id = ?`,
          [
            input.name, input.company, input.mobile, input.email, input.country,
            JSON.stringify(input.jobTitles), input.otherJobTitle,
            JSON.stringify(input.businessTypes), JSON.stringify(input.products),
            input.productType, input.interest, input.notes, now, id,
          ],
        )
        if (replacement) {
          await db.run(`DELETE FROM cards WHERE customer_id = ?`, [id])
          await db.run(
            `INSERT INTO cards (id, customer_id, title, description, image, created_at)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [createId(), id, replacement.fileName, replacement.mimeType, replacement.path, now],
          )
        }
        await db.run(
          `INSERT INTO history (id, customer_id, action, created_at) VALUES (?, ?, ?, ?)`,
          [createId(), id, 'updated', now],
        )
      })
    } catch (error) {
      if (replacement) await imageStorageService.delete(replacement.path).catch(() => undefined)
      throw error
    }
    if (replacement) {
      await Promise.all(previousCards
        .filter((card) => card.image)
        .map((card) => imageStorageService.delete(card.image!).catch(() => undefined)))
    }
    await sqliteService.saveToStore()

    const updated = await this.getById(id)
    if (!updated) throw new Error('تعذر تحديث بيانات العميل.')
    return updated
  }

  async delete(id: string): Promise<void> {
    await this.ready()
    const existing = await this.getById(id)
    if (!existing) return

    const cards = await cardRepository.listByCustomerId(id)
    await sqliteService.transaction(async (db) => {
      // ON DELETE CASCADE removes the customer's cards/notes/history rows too.
      await db.run(`DELETE FROM customers WHERE id = ?`, [id])
    })
    await Promise.all(cards
      .filter((card) => card.image)
      .map((card) => imageStorageService.delete(card.image!).catch(() => undefined)))
    await sqliteService.saveToStore()
  }

  async count(): Promise<number> {
    await this.ready()
    const rows = await sqliteService.query<{ total: number }>(`SELECT COUNT(*) as total FROM customers`)
    return rows[0]?.total ?? 0
  }

  async getBusinessCard(customerId: string): Promise<File | null> {
    await this.ready()
    const card = await cardRepository.getByCustomerId(customerId)
    if (!card?.image) return null
    return imageStorageService.read(card.image, card.description || 'image/jpeg', card.title || 'business-card.jpg')
  }

  async createBackup(): Promise<CustomerBackup> {
    await this.ready()
    const customers = await this.list({ sort: 'newest' })
    const attachments = await Promise.all(customers.map(async (customer) => {
      if (!customer.businessCardImageId) return null
      const file = await this.getBusinessCard(customer.id)
      if (!file) return null
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('تعذر تجهيز الصورة.'))
        reader.onerror = () => reject(reader.error ?? new Error('تعذر قراءة صورة الكارت.'))
        reader.readAsDataURL(file)
      })
      return {
        id: `${customer.id}-card`,
        customerId: customer.id,
        fileName: customer.businessCardFileName ?? file.name,
        mimeType: customer.businessCardMimeType ?? file.type,
        createdAt: customer.createdAt,
        dataUrl,
      }
    }))

    return {
      format: 'cairo-lite-crm-backup',
      version: 1,
      exportedAt: new Date().toISOString(),
      customers,
      attachments: attachments.filter((item): item is NonNullable<typeof item> => item !== null),
    }
  }

  async restoreBackup(backup: CustomerBackup): Promise<void> {
    await this.ready()
    if (backup.format !== 'cairo-lite-crm-backup' || backup.version !== 1 ||
      !Array.isArray(backup.customers) || !Array.isArray(backup.attachments)) {
      throw new Error('ملف النسخة الاحتياطية غير صالح أو غير مدعوم.')
    }

    const customerIds = new Set(backup.customers.map((customer) => customer.id))
    if (backup.attachments.some((attachment) => !customerIds.has(attachment.customerId))) {
      throw new Error('ملف النسخة الاحتياطية يحتوي كارتًا لعميل غير موجود.')
    }

    const previousCards = await sqliteService.query<{ image: string | null }>(
      `SELECT image FROM cards WHERE image IS NOT NULL`,
    )
    const restoredCards: Array<{
      id: string
      customerId: string
      title: string
      description: string
      image: string
      createdAt: string
    }> = []

    try {
      for (const attachment of backup.attachments) {
        const file = new File(
          [base64ToBytes(attachment.dataUrl) as unknown as BlobPart],
          attachment.fileName,
          { type: attachment.mimeType },
        )
        const saved = await imageStorageService.save(attachment.customerId, file)
        restoredCards.push({
          id: createId(),
          customerId: attachment.customerId,
          title: saved.fileName,
          description: saved.mimeType,
          image: saved.path,
          createdAt: attachment.createdAt,
        })
      }

      await sqliteService.transaction(async (db) => {
        await db.run(`DELETE FROM customers`)
        for (const customer of backup.customers) {
          await db.run(
            `INSERT INTO customers (
              id, name, company, phone, email, address, country,
              job_titles_json, other_job_title, business_types_json, products_json,
              product_type, interest, notes, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              customer.id, customer.name, customer.company, customer.mobile, customer.email, '', customer.country,
              JSON.stringify(customer.jobTitles), customer.otherJobTitle,
              JSON.stringify(customer.businessTypes), JSON.stringify(customer.products),
              customer.productType, customer.interest, customer.notes, customer.createdAt, customer.updatedAt,
            ],
          )
        }
        for (const card of restoredCards) {
          await db.run(
            `INSERT INTO cards (id, customer_id, title, description, image, created_at)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [card.id, card.customerId, card.title, card.description, card.image, card.createdAt],
          )
        }
      })
    } catch (error) {
      await Promise.all(restoredCards.map((card) => imageStorageService.delete(card.image).catch(() => undefined)))
      throw error
    }

    await Promise.all(previousCards
      .filter((card) => card.image)
      .map((card) => imageStorageService.delete(card.image!).catch(() => undefined)))
    await sqliteService.saveToStore()
  }
}

function base64ToBytes(dataUrl: string): Uint8Array {
  const encoded = dataUrl.split(',', 2)[1] ?? ''
  const binary = atob(encoded)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return bytes
}

export const customerRepository = new SQLiteCustomerRepository()
