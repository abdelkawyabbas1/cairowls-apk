export type InterestLevel = 'normal' | 'interested' | 'very-interested' | null

export type ProductType = 'complete' | 'skd' | 'ckd'

/**
 * The canonical customer shape used by the UI and the persistence layer.
 * Arrays are kept as arrays in IndexedDB, avoiding lossy comma-separated values.
 */
export interface Customer {
  id: string
  name: string
  company: string
  mobile: string
  email: string
  country: string
  jobTitles: string[]
  otherJobTitle: string
  businessTypes: string[]
  products: string[]
  productType: ProductType
  interest: InterestLevel
  notes: string
  businessCardImageId: string | null
  businessCardFileName: string | null
  businessCardMimeType: string | null
  createdAt: string
  updatedAt: string
}

export type NewCustomer = Omit<
  Customer,
  | 'id'
  | 'businessCardImageId'
  | 'businessCardFileName'
  | 'businessCardMimeType'
  | 'createdAt'
  | 'updatedAt'
>

export interface CustomerAttachment {
  id: string
  customerId: string
  fileName: string
  mimeType: string
  blob: Blob
  createdAt: string
}

export interface CustomerSearchOptions {
  query?: string
  limit?: number
  sort?: 'newest' | 'oldest' | 'name' | 'company'
}

export interface CustomerBackup {
  format: 'cairo-lite-crm-backup'
  version: 1
  exportedAt: string
  customers: Customer[]
  attachments: Array<Omit<CustomerAttachment, 'blob'> & { dataUrl: string }>
}
