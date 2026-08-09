import { Capacitor } from '@capacitor/core'
import { Directory, Filesystem } from '@capacitor/filesystem'
import { Share } from '@capacitor/share'
import type { Customer, CustomerBackup } from '@/models/Customer'

function filenameDate(date = new Date()): string {
  return date.toISOString().slice(0, 10)
}

function productTypeLabel(productType: Customer['productType']): string {
  return {
    complete: 'منتج كامل',
    skd: 'منتج مفكك (SKD)',
    ckd: 'منتج مفكك بالكامل (CKD)',
  }[productType]
}

function interestLabel(interest: Customer['interest']): string {
  const labels: Record<NonNullable<Customer['interest']> | 'none', string> = {
    normal: 'عادي',
    interested: 'مهتم',
    'very-interested': 'مهتم جدًا',
    none: 'غير محدد',
  }
  return labels[interest ?? 'none']
}

function downloadInBrowser(blob: Blob, filename: string): void {
  const objectUrl = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = objectUrl
  anchor.download = filename
  anchor.rel = 'noopener'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1_000)
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  const chunkSize = 0x8000
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize))
  }
  return btoa(binary)
}

async function exportFile(bytes: Uint8Array, filename: string, mimeType: string, title: string): Promise<void> {
  if (!Capacitor.isNativePlatform()) {
    downloadInBrowser(new Blob([bytes as unknown as BlobPart], { type: mimeType }), filename)
    return
  }

  await Filesystem.writeFile({
    path: filename,
    directory: Directory.Cache,
    data: bytesToBase64(bytes),
  })
  const { uri } = await Filesystem.getUri({ path: filename, directory: Directory.Cache })
  await Share.share({
    title,
    text: `تم تجهيز ${filename}`,
    url: uri,
    dialogTitle: 'حفظ الملف أو مشاركته',
  })
}

export async function downloadBackup(backup: CustomerBackup): Promise<void> {
  const bytes = new TextEncoder().encode(JSON.stringify(backup, null, 2))
  await exportFile(
    bytes,
    `cairo-lite-crm-backup-${filenameDate()}.json`,
    'application/json;charset=utf-8',
    'نسخة كايرو لايت الاحتياطية',
  )
}

/** Creates a real Excel workbook and downloads/shares it on web, iOS, and Android. */
export async function createCustomersExcelBytes(customers: Customer[]): Promise<Uint8Array> {
  const excelJs = await import('exceljs')
  const WorkbookConstructor = excelJs.Workbook ?? excelJs.default.Workbook
  const workbook = new WorkbookConstructor()
  workbook.creator = 'Cairo Lite CRM'
  workbook.created = new Date()
  workbook.modified = new Date()

  const sheet = workbook.addWorksheet('العملاء', {
    views: [{ rightToLeft: true, state: 'frozen', ySplit: 1 }],
    properties: { defaultRowHeight: 22 },
  })

  sheet.columns = [
    { header: 'الاسم', key: 'name', width: 24 },
    { header: 'اسم الشركة', key: 'company', width: 26 },
    { header: 'رقم الموبايل', key: 'mobile', width: 20 },
    { header: 'البريد الإلكتروني', key: 'email', width: 28 },
    { header: 'الدولة', key: 'country', width: 20 },
    { header: 'المسمى الوظيفي', key: 'jobTitle', width: 30 },
    { header: 'نوع النشاط', key: 'businessTypes', width: 32 },
    { header: 'المنتجات المهتم بها', key: 'products', width: 36 },
    { header: 'نوع المنتج', key: 'productType', width: 22 },
    { header: 'درجة الاهتمام', key: 'interest', width: 18 },
    { header: 'ملاحظات', key: 'notes', width: 42 },
    { header: 'اسم ملف الكارت', key: 'cardName', width: 28 },
    { header: 'تاريخ الإضافة', key: 'createdAt', width: 20, style: { numFmt: 'yyyy-mm-dd hh:mm' } },
    { header: 'آخر تعديل', key: 'updatedAt', width: 20, style: { numFmt: 'yyyy-mm-dd hh:mm' } },
    { header: 'معرّف العميل', key: 'id', width: 38 },
  ]

  for (const customer of customers) {
    sheet.addRow({
      name: customer.name,
      company: customer.company,
      mobile: customer.mobile,
      email: customer.email,
      country: customer.country,
      jobTitle: [...customer.jobTitles.filter((title) => title !== 'أخرى'), customer.otherJobTitle].filter(Boolean).join('، '),
      businessTypes: customer.businessTypes.join('، '),
      products: customer.products.join('، '),
      productType: productTypeLabel(customer.productType),
      interest: interestLabel(customer.interest),
      notes: customer.notes,
      cardName: customer.businessCardFileName ?? null,
      createdAt: new Date(customer.createdAt),
      updatedAt: new Date(customer.updatedAt),
      id: customer.id,
    })
  }

  const header = sheet.getRow(1)
  header.height = 30
  header.font = { bold: true, color: { argb: 'FFFFFFFF' }, name: 'Arial', size: 11 }
  header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF3457D5' } }
  header.alignment = { horizontal: 'center', vertical: 'middle' }
  sheet.autoFilter = { from: 'A1', to: 'O1' }

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber > 1) {
      row.alignment = { vertical: 'top', horizontal: 'right', wrapText: true }
      if (rowNumber % 2 === 0) {
        row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF7F8FC' } }
      }
    }
  })

  const buffer = await workbook.xlsx.writeBuffer()
  return new Uint8Array(buffer as ArrayBuffer)
}

export async function downloadCustomersExcel(customers: Customer[]): Promise<void> {
  const bytes = await createCustomersExcelBytes(customers)
  await exportFile(
    bytes,
    `cairo-lite-customers-${filenameDate()}.xlsx`,
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'بيانات عملاء كايرو لايت',
  )
}
