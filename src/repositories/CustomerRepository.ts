import type {
  Customer,
  CustomerBackup,
  CustomerSearchOptions,
  NewCustomer,
} from '@/models/Customer'

/**
 * A storage contract independent of the interface. It permits a future native
 * SQLite implementation without changing the form or business rules.
 */
export interface CustomerRepository {
  create(customer: NewCustomer, businessCard?: File | null): Promise<Customer>
  getById(id: string): Promise<Customer | null>
  list(options?: CustomerSearchOptions): Promise<Customer[]>
  update(id: string, customer: NewCustomer, businessCard?: File | null): Promise<Customer>
  delete(id: string): Promise<void>
  count(): Promise<number>
  getBusinessCard(id: string): Promise<File | null>
  createBackup(): Promise<CustomerBackup>
  restoreBackup(backup: CustomerBackup): Promise<void>
}
