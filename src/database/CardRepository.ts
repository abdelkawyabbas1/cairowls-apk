import { sqliteService } from '@/database/SQLiteService'

export interface CardRow {
  id: string
  customer_id: string
  title: string
  description: string
  image: string | null
  created_at: string
}

export interface NewCard {
  id: string
  customerId: string
  title: string
  description?: string
  image?: string | null
  createdAt: string
}

/** Typed CRUD helpers for the `cards` table (business-card attachments). */
export class CardRepository {
  async create(card: NewCard): Promise<void> {
    await sqliteService.run(
      `INSERT INTO cards (id, customer_id, title, description, image, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [card.id, card.customerId, card.title, card.description ?? '', card.image ?? null, card.createdAt],
    )
  }

  async getByCustomerId(customerId: string): Promise<CardRow | null> {
    const rows = await sqliteService.query<CardRow>(
      `SELECT * FROM cards WHERE customer_id = ? ORDER BY created_at DESC LIMIT 1`,
      [customerId],
    )
    return rows[0] ?? null
  }

  async listByCustomerId(customerId: string): Promise<CardRow[]> {
    return sqliteService.query<CardRow>(
      `SELECT * FROM cards WHERE customer_id = ? ORDER BY created_at DESC`,
      [customerId],
    )
  }

  async deleteByCustomerId(customerId: string): Promise<void> {
    await sqliteService.run(`DELETE FROM cards WHERE customer_id = ?`, [customerId])
  }

  async delete(id: string): Promise<void> {
    await sqliteService.run(`DELETE FROM cards WHERE id = ?`, [id])
  }
}

export const cardRepository = new CardRepository()
