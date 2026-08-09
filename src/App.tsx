import { useState, useRef, useCallback, useEffect } from 'react'
import cairoLiteLogo from '@/imports/Untitled-1.png'
import type { Customer, CustomerBackup, InterestLevel, NewCustomer, ProductType } from '@/models/Customer'
import { customerRepository } from '@/database/CustomerRepository'
import { downloadBackup, downloadCustomersExcel } from '@/services/BackupService'

// ── Types ──────────────────────────────────────────────
type FormState = 'idle' | 'saving' | 'success'
type AppView = 'form' | 'customers' | 'settings'

// ── Data ───────────────────────────────────────────────
const JOB_TITLES = [
  'مالك الشركة', 'مدير عام', 'مدير مشتريات', 'مسؤول مشتريات',
  'مدير مبيعات', 'مدير مشروعات', 'مهندس كهرباء', 'مهندس إضاءة',
  'مقاول', 'موزع', 'تاجر', 'استشاري', 'أخرى',
]

const BUSINESS_TYPES = [
  'شركة تجارة', 'موزع', 'معرض بيع', 'مستورد', 'مصدر',
  'مقاولات', 'تنفيذ مشروعات', 'مصنع', 'جهة حكومية', 'مكتب استشاري', 'أخرى',
]

const PRODUCTS = [
  'لمبات LED', 'بانلات', 'كشافات', 'إنارة داخلية', 'إنارة خارجية',
  'إنارة ديكورية', 'إنارة صناعية', 'إنارة شوارع', 'شرائط LED', 'إكسسوارات', 'أخرى',
]

const COUNTRIES = [
  'المملكة العربية السعودية', 'الإمارات العربية المتحدة', 'مصر', 'الكويت', 'قطر',
  'البحرين', 'عُمان', 'الأردن', 'لبنان', 'العراق', 'اليمن', 'ليبيا',
  'تونس', 'المغرب', 'الجزائر', 'السودان', 'موريتانيا', 'الصومال', 'سوريا', 'فلسطين',
]

// ── Sub-components ─────────────────────────────────────

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="section-card">
      <h3 className="section-card-title">{title}</h3>
      {children}
    </div>
  )
}

function InputLabel({ label, required }: { label: string; required?: boolean }) {
  return (
    <label className="input-label">
      {required && <span className="required-star">*</span>}
      {label}
    </label>
  )
}

function ChipGroup({
  options,
  selected,
  onToggle,
}: {
  options: string[]
  selected: string[]
  onToggle: (val: string) => void
}) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          className={`chip${selected.includes(opt) ? ' selected' : ''}`}
          onClick={() => onToggle(opt)}
        >
          {selected.includes(opt) && (
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path
                d="M2 6l3 3 5-5"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
          {opt}
        </button>
      ))}
    </div>
  )
}

function SegmentedControl({
  options,
  selected,
  onChange,
}: {
  options: { value: string; label: string }[]
  selected: string
  onChange: (v: string) => void
}) {
  return (
    <div
      style={{
        display: 'flex',
        background: '#F2F2F7',
        borderRadius: '13px',
        padding: '3px',
        gap: '2px',
      }}
    >
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          className={`seg-option${selected === opt.value ? ' active' : ''}`}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

function InterestCards({
  selected,
  onChange,
}: {
  selected: InterestLevel
  onChange: (v: InterestLevel) => void
}) {
  const cards: { value: InterestLevel; emoji: string; label: string; color: string; cls: string }[] = [
    { value: 'normal', emoji: '🟢', label: 'عادي', color: '#34C759', cls: 'selected-normal' },
    { value: 'interested', emoji: '🟡', label: 'مهتم', color: '#FF9500', cls: 'selected-interested' },
    { value: 'very-interested', emoji: '🔴', label: 'مهتم جداً', color: '#FF3B30', cls: 'selected-very-interested' },
  ]

  return (
    <div style={{ display: 'flex', gap: '12px' }}>
      {cards.map((c) => (
        <button
          key={c.value}
          type="button"
          className={`interest-card${selected === c.value ? ` ${c.cls}` : ''}`}
          onClick={() => onChange(selected === c.value ? null : c.value)}
        >
          <div style={{ fontSize: '28px', marginBottom: '8px', lineHeight: 1 }}>{c.emoji}</div>
          <div
            style={{
              fontSize: '15px',
              fontWeight: 600,
              color: selected === c.value ? c.color : '#3C3C43',
              fontFamily: 'Cairo, sans-serif',
              transition: 'color 0.2s ease',
            }}
          >
            {c.label}
          </div>
        </button>
      ))}
    </div>
  )
}

function UploadCard({
  file,
  dragOver,
  onDragOver,
  onDragLeave,
  onDrop,
  onClick,
}: {
  file: File | null
  dragOver: boolean
  onDragOver: (e: React.DragEvent) => void
  onDragLeave: () => void
  onDrop: (e: React.DragEvent) => void
  onClick: () => void
}) {
  return (
    <div
      className={`upload-card${dragOver ? ' drag-over' : ''}`}
      style={{ padding: '36px 24px', textAlign: 'center' }}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onClick={onClick}
    >
      {file ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '14px',
              background: 'rgba(0,122,255,0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="#007AFF" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              <polyline points="14 2 14 8 20 8" stroke="#007AFF" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              <line x1="16" y1="13" x2="8" y2="13" stroke="#007AFF" strokeWidth="1.8" strokeLinecap="round" />
              <line x1="16" y1="17" x2="8" y2="17" stroke="#007AFF" strokeWidth="1.8" strokeLinecap="round" />
              <polyline points="10 9 9 9 8 9" stroke="#007AFF" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </div>
          <p style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: '#007AFF', fontFamily: 'Cairo, sans-serif' }}>
            {file.name}
          </p>
          <p style={{ margin: 0, fontSize: '13px', color: '#AEAEB2', fontFamily: 'Cairo, sans-serif' }}>
            اضغط للتغيير
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
          {/* Camera icon with glass effect */}
          <div
            style={{
              width: '72px',
              height: '72px',
              borderRadius: '20px',
              background: 'linear-gradient(135deg, rgba(0,122,255,0.12) 0%, rgba(0,122,255,0.06) 100%)',
              border: '1px solid rgba(0,122,255,0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backdropFilter: 'blur(10px)',
            }}
          >
            <svg width="34" height="34" viewBox="0 0 24 24" fill="none">
              <path
                d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"
                stroke="#007AFF"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <circle cx="12" cy="13" r="4" stroke="#007AFF" strokeWidth="1.6" />
            </svg>
          </div>

          {/* Drag & drop illustration - minimal dots */}
          <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                style={{
                  width: '5px',
                  height: '5px',
                  borderRadius: '50%',
                  background: `rgba(0,122,255,${0.15 + i * 0.1})`,
                }}
              />
            ))}
          </div>

          <div>
            <p style={{ margin: '0 0 4px', fontSize: '16px', fontWeight: 700, color: '#1C1C1E', fontFamily: 'Cairo, sans-serif' }}>
              تصوير الكارت
            </p>
            <p style={{ margin: 0, fontSize: '13px', color: '#AEAEB2', fontFamily: 'Cairo, sans-serif' }}>
              اسحب الصورة هنا أو اضغط للرفع
            </p>
          </div>

          <button
            type="button"
            style={{
              background: 'rgba(0,122,255,0.08)',
              border: '1px solid rgba(0,122,255,0.2)',
              borderRadius: '10px',
              padding: '9px 20px',
              color: '#007AFF',
              fontSize: '14px',
              fontWeight: 600,
              fontFamily: 'Cairo, sans-serif',
              cursor: 'pointer',
              transition: 'background 0.15s ease',
            }}
            onClick={(e) => { e.stopPropagation(); onClick() }}
          >
            اختيار صورة
          </button>
        </div>
      )}
    </div>
  )
}

function SuccessOverlay({
  onClose,
  actionLabel = 'تسجيل عميل جديد',
  message = 'تمت إضافة بيانات العميل بنجاح إلى قاعدة البيانات',
}: {
  onClose: () => void
  actionLabel?: string
  message?: string
}) {
  return (
    <div className="success-overlay" onClick={onClose}>
      <div
        className="success-card"
        style={{
          background: 'white',
          borderRadius: '28px',
          padding: '48px 56px',
          textAlign: 'center',
          boxShadow: '0 24px 80px rgba(0,0,0,0.2)',
          maxWidth: '340px',
          width: '90%',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            width: '80px',
            height: '80px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #34C759, #30D158)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 24px',
            boxShadow: '0 8px 24px rgba(52,199,89,0.35)',
          }}
        >
          <svg width="40" height="40" viewBox="0 0 48 48" fill="none">
            <path
              d="M12 24l9 9 15-15"
              stroke="white"
              strokeWidth="3.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray="48"
              strokeDashoffset="0"
              style={{ animation: 'checkDraw 0.4s 0.3s ease both' }}
            />
          </svg>
        </div>
        <h2 style={{ margin: '0 0 8px', fontSize: '22px', fontWeight: 800, color: '#1C1C1E', fontFamily: 'Cairo, sans-serif' }}>
          تم حفظ العميل!
        </h2>
        <p style={{ margin: '0 0 28px', fontSize: '15px', color: '#6E6E73', fontFamily: 'Cairo, sans-serif', lineHeight: 1.5 }}>
          {message}
        </p>
        <button
          type="button"
          className="btn-primary"
          style={{ width: '100%', fontSize: '16px' }}
          onClick={onClose}
        >
          {actionLabel}
        </button>
      </div>
    </div>
  )
}

function productTypeLabel(productType: ProductType): string {
  return {
    complete: 'منتج كامل',
    skd: 'منتج مفكك (SKD)',
    ckd: 'منتج مفكك بالكامل (CKD)',
  }[productType]
}

function interestMeta(interest: InterestLevel): { label: string; color: string; background: string } {
  if (interest === 'very-interested') return { label: 'مهتم جدًا', color: '#D92D20', background: '#FEF3F2' }
  if (interest === 'interested') return { label: 'مهتم', color: '#B54708', background: '#FFFAEB' }
  if (interest === 'normal') return { label: 'عادي', color: '#067647', background: '#ECFDF3' }
  return { label: 'غير محدد', color: '#667085', background: '#F2F4F7' }
}

function formatDate(isoDate: string): string {
  return new Intl.DateTimeFormat('ar-EG', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(isoDate))
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ padding: '13px 0', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
      <p style={{ margin: '0 0 5px', color: '#8E8E93', fontSize: '12px', fontWeight: 700 }}>{label}</p>
      <div style={{ color: '#1C1C1E', fontSize: '15px', lineHeight: 1.7 }}>{children}</div>
    </div>
  )
}

function Pills({ values, emptyText = 'غير محدد' }: { values: string[]; emptyText?: string }) {
  if (!values.length) return <span style={{ color: '#8E8E93' }}>{emptyText}</span>
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
      {values.map((value) => (
        <span key={value} className="detail-pill">{value}</span>
      ))}
    </div>
  )
}

function CustomerDetailsOverlay({
  customer,
  imageUrl,
  onClose,
  onEdit,
  onDelete,
}: {
  customer: Customer
  imageUrl: string | null
  onClose: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  const interest = interestMeta(customer.interest)

  return (
    <div className="detail-overlay" onClick={onClose}>
      <aside className="detail-drawer" onClick={(event) => event.stopPropagation()} aria-label="تفاصيل العميل">
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', marginBottom: '24px' }}>
          <div>
            <button type="button" className="icon-close" aria-label="إغلاق" onClick={onClose}>×</button>
            <h2 style={{ margin: '12px 0 4px', fontSize: '25px', color: '#1C1C1E' }}>{customer.name}</h2>
            <p style={{ margin: 0, color: '#667085', fontSize: '15px' }}>{customer.company}</p>
          </div>
          <span className="interest-badge" style={{ color: interest.color, background: interest.background }}>{interest.label}</span>
        </div>

        <div className="detail-scroll">
          <DetailRow label="رقم الموبايل"><span dir="ltr">{customer.mobile}</span></DetailRow>
          <DetailRow label="البريد الإلكتروني"><span dir="ltr">{customer.email || 'غير محدد'}</span></DetailRow>
          <DetailRow label="الدولة">{customer.country || 'غير محدد'}</DetailRow>
          <DetailRow label="المسمى الوظيفي"><Pills values={[...customer.jobTitles.filter((title) => title !== 'أخرى'), customer.otherJobTitle].filter(Boolean)} /></DetailRow>
          <DetailRow label="نوع النشاط"><Pills values={customer.businessTypes} /></DetailRow>
          <DetailRow label="المنتجات المهتم بها"><Pills values={customer.products} /></DetailRow>
          <DetailRow label="نوع المنتج">{productTypeLabel(customer.productType)}</DetailRow>
          <DetailRow label="ملاحظات">{customer.notes || <span style={{ color: '#8E8E93' }}>لا توجد ملاحظات</span>}</DetailRow>
          <DetailRow label="الكارت الشخصي">
            {imageUrl ? <img src={imageUrl} alt="الكارت الشخصي" className="business-card-preview" /> : <span style={{ color: '#8E8E93' }}>لم يتم إرفاق كارت</span>}
          </DetailRow>
          <DetailRow label="تاريخ التسجيل">{formatDate(customer.createdAt)}</DetailRow>
        </div>

        <div className="detail-actions">
          <button type="button" className="btn-cancel" onClick={onDelete}>حذف العميل</button>
          <button type="button" className="btn-primary" style={{ padding: '13px 22px', fontSize: '15px' }} onClick={onEdit}>تعديل البيانات</button>
        </div>
      </aside>
    </div>
  )
}

function CustomerListScreen({
  customers,
  loading,
  query,
  onQueryChange,
  onNewCustomer,
  onOpen,
  onEdit,
  onDelete,
  onRefresh,
}: {
  customers: Customer[]
  loading: boolean
  query: string
  onQueryChange: (query: string) => void
  onNewCustomer: () => void
  onOpen: (customer: Customer) => void
  onEdit: (customer: Customer) => void
  onDelete: (customer: Customer) => void
  onRefresh: () => void
}) {
  return (
    <main className="screen-content">
      <div className="screen-heading">
        <div>
          <h2>العملاء</h2>
          <p>{customers.length} عميل{query ? ' مطابق للبحث' : ' مسجل على هذا الجهاز'}</p>
        </div>
        <button type="button" className="btn-primary" style={{ padding: '13px 20px', fontSize: '15px' }} onClick={onNewCustomer}>+ تسجيل عميل</button>
      </div>

      <div className="customer-toolbar">
        <div className="search-box">
          <span>⌕</span>
          <input value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder="ابحث بالاسم أو الشركة أو رقم الموبايل" />
        </div>
        <button type="button" className="btn-secondary" onClick={onRefresh} disabled={loading}>{loading ? 'جاري التحديث...' : 'تحديث'}</button>
      </div>

      {loading ? (
        <div className="empty-state">جاري تحميل العملاء...</div>
      ) : customers.length ? (
        <div className="customer-list">
          {customers.map((customer) => {
            const interest = interestMeta(customer.interest)
            return (
              <article key={customer.id} className="customer-list-card">
                <button type="button" className="customer-card-open" onClick={() => onOpen(customer)} aria-label={`عرض تفاصيل ${customer.name}`}>
                <div className="customer-card-main">
                  <div>
                    <h3>{customer.name}</h3>
                    <p>{customer.company}</p>
                  </div>
                  <span className="interest-badge" style={{ color: interest.color, background: interest.background }}>{interest.label}</span>
                </div>
                <div className="customer-card-meta">
                  <span dir="ltr">{customer.mobile}</span>
                  {customer.country && <span>{customer.country}</span>}
                  <span>{formatDate(customer.createdAt)}</span>
                </div>
                <div className="customer-card-footer">
                  <span>{customer.products.slice(0, 2).join(' · ') || 'بدون منتجات محددة'}</span>
                  <span className="edit-link">عرض التفاصيل</span>
                </div>
                </button>
                <div className="customer-card-actions">
                  <button type="button" className="customer-edit-button" onClick={() => onEdit(customer)}>تعديل البيانات</button>
                  <button type="button" className="customer-delete-button" onClick={() => onDelete(customer)}>حذف العميل</button>
                </div>
              </article>
            )
          })}
        </div>
      ) : (
        <div className="empty-state">
          <div style={{ fontSize: '34px', marginBottom: '10px' }}>👥</div>
          <strong>{query ? 'لا توجد نتائج مطابقة' : 'لا يوجد عملاء مسجلون بعد'}</strong>
          <p>{query ? 'جرّب البحث باسم أو شركة مختلفة.' : 'ابدأ بتسجيل أول عميل من زر «تسجيل عميل». '}</p>
        </div>
      )}
    </main>
  )
}

function SettingsScreen({
  customerCount,
  busy,
  notice,
  onBackup,
  onExport,
  onRestore,
}: {
  customerCount: number
  busy: boolean
  notice: string
  onBackup: () => void
  onExport: () => void
  onRestore: (file: File) => Promise<void>
}) {
  const restoreInputRef = useRef<HTMLInputElement>(null)

  return (
    <main className="screen-content settings-screen">
      <div className="screen-heading">
        <div>
          <h2>البيانات والنسخ الاحتياطي</h2>
          <p>كل البيانات محفوظة محليًا على هذا الجهاز</p>
        </div>
      </div>

      <SectionCard title="ملخص البيانات">
        <div className="settings-stat"><strong>{customerCount}</strong><span>عميل محفوظ محليًا</span></div>
      </SectionCard>

      <SectionCard title="تصدير البيانات">
        <p className="settings-description">صدّر قائمة العملاء إلى ملف Excel حقيقي بصيغة XLSX. لا يشمل الملف صور الكروت.</p>
        <button type="button" className="btn-primary" style={{ padding: '13px 22px', fontSize: '15px' }} onClick={onExport} disabled={busy}>تصدير Excel</button>
      </SectionCard>

      <SectionCard title="نسخة احتياطية كاملة">
        <p className="settings-description">تنشئ النسخة الاحتياطية ملفًا واحدًا يحتوي العملاء وصور الكروت. احتفظ به في «الملفات» أو أرسله لنفسك.</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
          <button type="button" className="btn-primary" style={{ padding: '13px 22px', fontSize: '15px' }} onClick={onBackup} disabled={busy}>إنشاء نسخة احتياطية</button>
          <button type="button" className="btn-secondary" onClick={() => restoreInputRef.current?.click()} disabled={busy}>استرجاع نسخة</button>
          <input
            ref={restoreInputRef}
            type="file"
            accept="application/json,.json"
            style={{ display: 'none' }}
            onChange={(event) => {
              const file = event.target.files?.[0]
              event.currentTarget.value = ''
              if (file) void onRestore(file)
            }}
          />
        </div>
      </SectionCard>

      {notice && <p className="settings-notice" role="status">{notice}</p>}
      <p className="settings-warning">تنبيه: الاسترجاع يستبدل بيانات هذا الجهاز بالبيانات الموجودة في ملف النسخة الاحتياطية.</p>
    </main>
  )
}

// ── Main App ───────────────────────────────────────────
export default function App() {
  // Form fields
  const [name, setName] = useState('')
  const [company, setCompany] = useState('')
  const [mobile, setMobile] = useState('')
  const [email, setEmail] = useState('')
  const [country, setCountry] = useState('')

  // Section 2 – Job titles
  const [jobTitles, setJobTitles] = useState<string[]>([])
  const [otherJobTitle, setOtherJobTitle] = useState('')

  // Section 3 – Business type
  const [businessTypes, setBusinessTypes] = useState<string[]>([])

  // Section 4 – Products
  const [products, setProducts] = useState<string[]>([])

  // Section 5 – Product type
  const [productType, setProductType] = useState<ProductType>('complete')

  // Section 6 – Interest
  const [interest, setInterest] = useState<InterestLevel>(null)

  // Section 7 – Notes
  const [notes, setNotes] = useState('')

  // Section 8 – Card upload
  const [cardFile, setCardFile] = useState<File | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Form state
  const [formState, setFormState] = useState<FormState>('idle')
  const [saveError, setSaveError] = useState('')

  // Application navigation and customer data
  const [view, setView] = useState<AppView>('form')
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null)
  const [customers, setCustomers] = useState<Customer[]>([])
  const [customerCount, setCustomerCount] = useState(0)
  const [customerQuery, setCustomerQuery] = useState('')
  const [customersLoading, setCustomersLoading] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [selectedCardUrl, setSelectedCardUrl] = useState<string | null>(null)
  const [settingsBusy, setSettingsBusy] = useState(false)
  const [settingsNotice, setSettingsNotice] = useState('')

  const loadCustomers = useCallback(async (query = '') => {
    setCustomersLoading(true)
    try {
      const [items, total] = await Promise.all([
        customerRepository.list({ query, sort: 'newest' }),
        customerRepository.count(),
      ])
      setCustomers(items)
      setCustomerCount(total)
    } finally {
      setCustomersLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadCustomers(customerQuery)
  }, [customerQuery, loadCustomers])

  useEffect(() => {
    if (!selectedCustomer) {
      setSelectedCardUrl(null)
      return undefined
    }

    let active = true
    let objectUrl: string | null = null
    void customerRepository.getBusinessCard(selectedCustomer.id).then((file) => {
      if (!active || !file) return
      objectUrl = URL.createObjectURL(file)
      setSelectedCardUrl(objectUrl)
    }).catch(() => {
      if (active) setSelectedCardUrl(null)
    })

    return () => {
      active = false
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [selectedCustomer])

  // ── Handlers ──
  const toggleMulti = useCallback((arr: string[], val: string, set: (v: string[]) => void) => {
    set(arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val])
  }, [])

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(true)
  }
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const f = e.dataTransfer.files[0]
    if (f) setCardFile(f)
  }

  const handleSave = async () => {
    if (!name.trim() || !company.trim() || !mobile.trim()) return
    setFormState('saving')
    setSaveError('')

    try {
      const payload: NewCustomer = {
        name: name.trim(),
        company: company.trim(),
        mobile: mobile.trim(),
        email: email.trim(),
        country,
        jobTitles: [...jobTitles],
        otherJobTitle: otherJobTitle.trim(),
        businessTypes: [...businessTypes],
        products: [...products],
        productType,
        interest,
        notes: notes.trim(),
      }
      if (editingCustomer) {
        await customerRepository.update(editingCustomer.id, payload, cardFile)
      } else {
        await customerRepository.create(payload, cardFile)
      }
      await loadCustomers(customerQuery)
      setFormState('success')
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'تعذر حفظ العميل. حاول مرة أخرى.')
      setFormState('idle')
    }
  }

  const handleReset = () => {
    setName(''); setCompany(''); setMobile(''); setEmail(''); setCountry('')
    setJobTitles([]); setOtherJobTitle('')
    setBusinessTypes([]); setProducts([])
    setProductType('complete'); setInterest(null)
    setNotes(''); setCardFile(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
    setSaveError('')
    setFormState('idle')
    setEditingCustomer(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleNewCustomer = () => {
    handleReset()
    setView('form')
  }

  const handleEditCustomer = (customer: Customer) => {
    setName(customer.name); setCompany(customer.company); setMobile(customer.mobile)
    setEmail(customer.email); setCountry(customer.country)
    setJobTitles([...customer.jobTitles]); setOtherJobTitle(customer.otherJobTitle)
    setBusinessTypes([...customer.businessTypes]); setProducts([...customer.products])
    setProductType(customer.productType); setInterest(customer.interest); setNotes(customer.notes)
    setCardFile(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
    setSaveError('')
    setFormState('idle')
    setEditingCustomer(customer)
    setSelectedCustomer(null)
    setView('form')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleSuccessClose = () => {
    handleReset()
    setView('customers')
  }

  const handleDeleteCustomer = async (customer: Customer) => {
    if (!window.confirm(`هل تريد حذف العميل «${customer.name}»؟ لا يمكن التراجع عن هذا الإجراء.`)) return
    try {
      await customerRepository.delete(customer.id)
      setSelectedCustomer(null)
      await loadCustomers(customerQuery)
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'تعذر حذف العميل.')
    }
  }

  const handleBackup = async () => {
    setSettingsBusy(true)
    setSettingsNotice('')
    try {
      await downloadBackup(await customerRepository.createBackup())
      setSettingsNotice('تم إنشاء النسخة الاحتياطية. اختر مكانًا آمنًا لحفظها.')
    } catch (error) {
      setSettingsNotice(error instanceof Error ? error.message : 'تعذر إنشاء النسخة الاحتياطية.')
    } finally {
      setSettingsBusy(false)
    }
  }

  const handleExport = async () => {
    setSettingsBusy(true)
    setSettingsNotice('')
    try {
      await downloadCustomersExcel(await customerRepository.list({ sort: 'newest' }))
      setSettingsNotice('تم تجهيز ملف Excel. اختر مكان الحفظ أو المشاركة.')
    } catch (error) {
      setSettingsNotice(error instanceof Error ? error.message : 'تعذر تصدير البيانات.')
    } finally {
      setSettingsBusy(false)
    }
  }

  const handleRestore = async (file: File) => {
    if (!window.confirm('سيتم استبدال بيانات العملاء الحالية بالموجودة في ملف النسخة الاحتياطية. هل تريد المتابعة؟')) return
    setSettingsBusy(true)
    setSettingsNotice('')
    try {
      const backup = JSON.parse(await file.text()) as CustomerBackup
      await customerRepository.restoreBackup(backup)
      setSelectedCustomer(null)
      await loadCustomers(customerQuery)
      setSettingsNotice('تم استرجاع النسخة الاحتياطية بنجاح.')
    } catch (error) {
      setSettingsNotice(error instanceof Error ? error.message : 'تعذر استرجاع النسخة الاحتياطية.')
    } finally {
      setSettingsBusy(false)
    }
  }

  const isValid = name.trim() && company.trim() && mobile.trim()
  const pageMeta = {
    form: {
      title: editingCustomer ? 'تعديل بيانات العميل' : 'تسجيل عميل جديد',
      subtitle: editingCustomer ? 'عدّل البيانات ثم احفظ التغييرات' : 'قم بإدخال بيانات العميل بسرعة أثناء المعرض',
    },
    customers: { title: 'العملاء', subtitle: 'ابحث في العملاء وسجّل المتابعة بسهولة' },
    settings: { title: 'البيانات', subtitle: 'التصدير والنسخ الاحتياطي المحلي' },
  }[view]

  return (
    <div
      dir="rtl"
      style={{
        minHeight: '100vh',
        background: '#F7F8FA',
        fontFamily: 'Cairo, -apple-system, BlinkMacSystemFont, sans-serif',
        paddingBottom: '100px',
      }}
    >
      {/* ── Header ── */}
      <div
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 50,
          background: 'rgba(247,248,250,0.92)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderBottom: '1px solid rgba(0,0,0,0.06)',
          padding: '20px 32px 18px',
        }}
      >
        <div className="app-header-inner">
          <div className="header-copy">
            <h1
              style={{
                margin: 0,
                fontSize: '26px',
                fontWeight: 800,
                color: '#1C1C1E',
                letterSpacing: '-0.3px',
                lineHeight: 1.2,
              }}
            >
              {pageMeta.title}
            </h1>
            <p
              style={{
                margin: '4px 0 0',
                fontSize: '14px',
                fontWeight: 400,
                color: '#8E8E93',
              }}
            >
              {pageMeta.subtitle}
            </p>
          </div>

          <nav className="app-nav" aria-label="التنقل الرئيسي">
            <button type="button" className={view === 'form' ? 'active' : ''} onClick={handleNewCustomer}>تسجيل عميل</button>
            <button type="button" className={view === 'customers' ? 'active' : ''} onClick={() => setView('customers')}>العملاء</button>
            <button type="button" className={view === 'settings' ? 'active' : ''} onClick={() => setView('settings')}>البيانات</button>
          </nav>

          <div className="brand-area">
            <img
              src={cairoLiteLogo}
              alt="Cairo Lite - كايرو لايت"
              style={{ height: '44px', width: 'auto', objectFit: 'contain', display: 'block' }}
            />
            <div
              style={{
                width: '1px',
                height: '28px',
                background: 'rgba(0,0,0,0.1)',
              }}
            />
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                background: 'white',
                border: '1px solid rgba(0,0,0,0.06)',
                borderRadius: '12px',
                padding: '8px 14px',
                boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
              }}
            >
              <div
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: '#34C759',
                  boxShadow: '0 0 0 2px rgba(52,199,89,0.25)',
                }}
              />
              <span style={{ fontSize: '13px', fontWeight: 600, color: '#3C3C43' }}>المعرض الدولي للإضاءة</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Form Body ── */}
      {view === 'form' && (
        <>
      <div style={{ maxWidth: '860px', margin: '0 auto', padding: '28px 32px 0', display: 'flex', flexDirection: 'column', gap: '16px' }}>

        {/* ── Section 1: Customer Data ── */}
        <SectionCard title="بيانات العميل">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <InputLabel label="الاسم" required />
              <input
                className="input-field"
                type="text"
                placeholder="الاسم الكامل"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div>
              <InputLabel label="اسم الشركة" required />
              <input
                className="input-field"
                type="text"
                placeholder="اسم الشركة أو المؤسسة"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
              />
            </div>
            <div>
              <InputLabel label="رقم الموبايل" required />
              <input
                className="input-field"
                type="tel"
                placeholder="+966 5X XXX XXXX"
                value={mobile}
                onChange={(e) => setMobile(e.target.value)}
                style={{ direction: 'ltr', textAlign: 'right' }}
              />
            </div>
            <div>
              <InputLabel label="البريد الإلكتروني" />
              <input
                className="input-field"
                type="email"
                placeholder="example@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{ direction: 'ltr', textAlign: 'right' }}
              />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <InputLabel label="الدولة" />
              <select
                className="input-field"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
              >
                <option value="">اختر الدولة</option>
                {COUNTRIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>
        </SectionCard>

        {/* ── Section 2: Job Title ── */}
        <SectionCard title="المسمى الوظيفي">
          <ChipGroup
            options={JOB_TITLES}
            selected={jobTitles}
            onToggle={(v) => toggleMulti(jobTitles, v, setJobTitles)}
          />
          {jobTitles.includes('أخرى') && (
            <div className="other-field-enter" style={{ marginTop: '14px' }}>
              <input
                className="input-field"
                type="text"
                placeholder="حدد المسمى الوظيفي"
                value={otherJobTitle}
                onChange={(e) => setOtherJobTitle(e.target.value)}
              />
            </div>
          )}
        </SectionCard>

        {/* ── Section 3: Business Type ── */}
        <SectionCard title="نوع النشاط">
          <ChipGroup
            options={BUSINESS_TYPES}
            selected={businessTypes}
            onToggle={(v) => toggleMulti(businessTypes, v, setBusinessTypes)}
          />
        </SectionCard>

        {/* ── Section 4 & 5 — two columns ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          {/* Section 4: Products */}
          <div className="section-card" style={{ gridColumn: '1 / -1' }}>
            <h3 className="section-card-title">المنتجات المهتم بها</h3>
            <ChipGroup
              options={PRODUCTS}
              selected={products}
              onToggle={(v) => toggleMulti(products, v, setProducts)}
            />
          </div>

          {/* Section 5: Product Type */}
          <div className="section-card" style={{ gridColumn: '1 / -1' }}>
            <h3 className="section-card-title">نوع المنتج</h3>
            <SegmentedControl
              options={[
                { value: 'complete', label: 'منتج كامل' },
                { value: 'skd', label: 'منتج مفكك (SKD)' },
                { value: 'ckd', label: 'منتج مفكك بالكامل (CKD)' },
              ]}
              selected={productType}
              onChange={(v) => setProductType(v as ProductType)}
            />
          </div>
        </div>

        {/* ── Section 6: Interest Level ── */}
        <SectionCard title="درجة الاهتمام">
          <InterestCards selected={interest} onChange={setInterest} />
        </SectionCard>

        {/* ── Sections 7 & 8 side by side ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          {/* Section 7: Notes */}
          <div className="section-card">
            <h3 className="section-card-title">ملاحظات</h3>
            <textarea
              className="input-field"
              placeholder="أضف أي ملاحظات أو تفاصيل إضافية حول العميل..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              style={{ minHeight: '148px' }}
            />
          </div>

          {/* Section 8: Business Card */}
          <div className="section-card">
            <h3 className="section-card-title">الكارت الشخصي</h3>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) setCardFile(f)
              }}
            />
            <UploadCard
              file={cardFile}
              dragOver={dragOver}
              onDragOver={handleDragOver}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            />
            {editingCustomer?.businessCardFileName && !cardFile && (
              <p style={{ margin: '10px 0 0', color: '#667085', fontSize: '12px' }}>
                يوجد كارت محفوظ بالفعل. اختيار صورة جديدة سيستبدله.
              </p>
            )}
          </div>
        </div>

        {/* Required fields note */}
        <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#AEAEB2', fontFamily: 'Cairo, sans-serif' }}>
          <span style={{ color: '#007AFF' }}>*</span> الحقول المطلوبة
        </p>
        {saveError && (
          <p role="alert" style={{ margin: '0', fontSize: '13px', color: '#FF3B30', fontFamily: 'Cairo, sans-serif' }}>
            {saveError}
          </p>
        )}
      </div>

      {/* ── Sticky Bottom Action Bar ── */}
      <div
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 40,
          background: 'rgba(247,248,250,0.94)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          borderTop: '1px solid rgba(0,0,0,0.07)',
          padding: '16px 32px',
          paddingBottom: 'max(16px, env(safe-area-inset-bottom))',
        }}
      >
        <div
          style={{
            maxWidth: '860px',
            margin: '0 auto',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
          }}
        >
          {/* Left: Cancel */}
          <button type="button" className="btn-cancel" onClick={handleReset}>
            إلغاء
          </button>

          {/* Right: Progress indicator + Save */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            {/* Field completion micro-indicator */}
            <div style={{ display: 'flex', gap: '5px' }}>
              {[!!name, !!company, !!mobile, jobTitles.length > 0, interest !== null].map((done, i) => (
                <div
                  key={i}
                  style={{
                    width: '28px',
                    height: '3px',
                    borderRadius: '2px',
                    background: done ? '#007AFF' : 'rgba(0,0,0,0.1)',
                    transition: 'background 0.25s ease',
                  }}
                />
              ))}
            </div>

            <button
              type="button"
              className="btn-primary"
              onClick={handleSave}
              disabled={!isValid || formState === 'saving'}
              style={{
                opacity: !isValid ? 0.45 : 1,
                minWidth: '160px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
              }}
            >
              {formState === 'saving' ? (
                <>
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    style={{ animation: 'spin 0.8s linear infinite' }}
                  >
                    <circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.3)" strokeWidth="2.5" />
                    <path
                      d="M12 2a10 10 0 0 1 10 10"
                      stroke="white"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                    />
                  </svg>
                  جاري الحفظ...
                </>
              ) : (
                <>
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"
                      stroke="white"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <polyline points="17 21 17 13 7 13 7 21" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    <polyline points="7 3 7 8 15 8" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  {editingCustomer ? 'حفظ التعديلات' : 'حفظ العميل'}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
        </>
      )}

      {view === 'customers' && (
        <CustomerListScreen
          customers={customers}
          loading={customersLoading}
          query={customerQuery}
          onQueryChange={setCustomerQuery}
          onNewCustomer={handleNewCustomer}
          onOpen={setSelectedCustomer}
          onEdit={handleEditCustomer}
          onDelete={(customer) => { void handleDeleteCustomer(customer) }}
          onRefresh={() => { void loadCustomers(customerQuery) }}
        />
      )}

      {view === 'settings' && (
        <SettingsScreen
          customerCount={customerCount}
          busy={settingsBusy}
          notice={settingsNotice}
          onBackup={() => { void handleBackup() }}
          onExport={() => { void handleExport() }}
          onRestore={handleRestore}
        />
      )}

      {/* ── Spin keyframe ── */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>

      {/* ── Success Overlay ── */}
      {formState === 'success' && (
        <SuccessOverlay
          onClose={handleSuccessClose}
          actionLabel="عرض العملاء"
          message={editingCustomer ? 'تم تحديث بيانات العميل بنجاح' : undefined}
        />
      )}
      {selectedCustomer && (
        <CustomerDetailsOverlay
          customer={selectedCustomer}
          imageUrl={selectedCardUrl}
          onClose={() => setSelectedCustomer(null)}
          onEdit={() => handleEditCustomer(selectedCustomer)}
          onDelete={() => { void handleDeleteCustomer(selectedCustomer) }}
        />
      )}
    </div>
  )
}
