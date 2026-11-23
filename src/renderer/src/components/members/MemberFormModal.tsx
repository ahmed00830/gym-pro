import {
  Camera,
  Image as ImageIcon,
  Loader2,
  X
} from 'lucide-react'
import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { useI18n } from '../../i18n'
import { formatDate } from '../../lib/format'
import type { Gender, MemberInput, MemberRecord } from '@shared/analytics'

interface MemberFormModalProps {
  open: boolean
  mode: 'create' | 'edit'
  initial?: MemberRecord | null
  submitting: boolean
  onClose: () => void
  onSubmit: (input: MemberInput) => Promise<void>
}

const genderOptions: Array<{ value: '' | Gender; labelKey: string }> = [
  { value: '', labelKey: 'common.notProvided' },
  { value: 'male', labelKey: 'memberProfile.genderMale' },
  { value: 'female', labelKey: 'memberProfile.genderFemale' },
  { value: 'other', labelKey: 'memberProfile.genderOther' }
]

function todayIso(): string {
  const now = new Date()
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

function resizeImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const image = new Image()
      image.onload = () => {
        const maxSize = 320
        const scale = Math.min(
          1,
          maxSize / Math.max(image.width, image.height)
        )
        const width = Math.max(1, Math.round(image.width * scale))
        const height = Math.max(1, Math.round(image.height * scale))
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const context = canvas.getContext('2d')

        if (!context) {
          reject(new Error('Canvas is unavailable.'))
          return
        }

        context.drawImage(image, 0, 0, width, height)
        resolve(canvas.toDataURL('image/jpeg', 0.82))
      }
      image.onerror = () => reject(new Error('The selected file is not a valid image.'))
      image.src = String(reader.result)
    }
    reader.onerror = () => reject(new Error('The selected file could not be read.'))
    reader.readAsDataURL(file)
  })
}

export function MemberFormModal({
  open,
  mode,
  initial,
  submitting,
  onClose,
  onSubmit
}: MemberFormModalProps) {
  const { t } = useI18n()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [secondaryPhone, setSecondaryPhone] = useState('')
  const [address, setAddress] = useState('')
  const [gender, setGender] = useState<'' | Gender>('')
  const [dateOfBirth, setDateOfBirth] = useState('')
  const [registrationDate, setRegistrationDate] = useState(todayIso())
  const [emergencyContact, setEmergencyContact] = useState('')
  const [notes, setNotes] = useState('')
  const [photoData, setPhotoData] = useState<string | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [photoError, setPhotoError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return

    setFullName(initial?.fullName ?? '')
    setPhone(initial?.phone ?? '')
    setSecondaryPhone(initial?.secondaryPhone ?? '')
    setAddress(initial?.address ?? '')
    setGender(initial?.gender ?? '')
    setDateOfBirth(initial?.dateOfBirth ?? '')
    setRegistrationDate(initial?.registrationDate ?? todayIso())
    setEmergencyContact(initial?.emergencyContact ?? '')
    setNotes(initial?.notes ?? '')
    setPhotoData(initial?.photoData ?? null)
    setErrors({})
    setPhotoError(null)
  }, [initial, open])

  useEffect(() => {
    if (!open) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !submitting) onClose()
    }

    document.addEventListener('keydown', handleKeyDown)
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
    }
  }, [onClose, open, submitting])

  if (!open) return null

  const validate = (): boolean => {
    const nextErrors: Record<string, string> = {}

    if (!fullName.trim()) nextErrors.fullName = t('common.noData')
    if (!phone.trim()) nextErrors.phone = t('common.noData')
    if (dateOfBirth && !/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth)) {
      nextErrors.dateOfBirth = t('common.noData')
    }
    if (!registrationDate || !/^\d{4}-\d{2}-\d{2}$/.test(registrationDate)) {
      nextErrors.registrationDate = t('common.noData')
    }

    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  const handlePhotoChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setPhotoError(null)

    if (!file.type.startsWith('image/')) {
      setPhotoError(t('members.emptyTitle'))
      return
    }

    if (file.size > 4 * 1024 * 1024) {
      setPhotoError(t('members.emptyTitle'))
      return
    }

    try {
      const resized = await resizeImage(file)
      setPhotoData(resized)
    } catch (error) {
      setPhotoError(error instanceof Error ? error.message : t('members.emptyTitle'))
    } finally {
      event.target.value = ''
    }
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!validate()) return

    const input: MemberInput = {
      fullName: fullName.trim(),
      phone: phone.trim(),
      secondaryPhone: secondaryPhone.trim() || null,
      address: address.trim() || null,
      gender: gender || null,
      dateOfBirth: dateOfBirth || null,
      emergencyContact: emergencyContact.trim() || null,
      notes: notes.trim() || null,
      registrationDate,
      photoData
    }

    await onSubmit(input)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label={t('common.close')}
        onClick={() => !submitting && onClose()}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="member-form-title"
        className="relative z-10 flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-[26px] border border-white/[0.08] bg-[#15131c] shadow-[0_34px_90px_-20px_rgba(0,0,0,0.95)]"
      >
        <header className="flex items-center justify-between gap-3 border-b border-white/[0.06] px-5 py-4">
          <div>
            <h2
              id="member-form-title"
              className="font-display text-base font-semibold text-primary"
            >
              {mode === 'create'
                ? t('members.addMember')
                : t('members.editMember')}
            </h2>
            <p className="mt-0.5 text-[11px] text-muted">
              {mode === 'create'
                ? t('members.emptyDescription')
                : t('memberProfile.detailsTitle')}
            </p>
          </div>
          <button
            type="button"
            onClick={() => !submitting && onClose()}
            aria-label={t('common.close')}
            className="grid size-8 place-items-center rounded-lg border border-white/[0.07] text-muted transition-colors hover:text-primary"
          >
            <X className="size-4" />
          </button>
        </header>

        <form
          onSubmit={handleSubmit}
          className="flex flex-1 flex-col overflow-hidden"
        >
          <div className="flex-1 overflow-y-auto px-5 py-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-1.5 sm:col-span-2">
                <span className="text-[11px] font-medium text-muted">
                  {t('members.member')} — {t('common.value')}
                </span>
                <input
                  type="text"
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  required
                  className="h-10 rounded-xl border border-white/[0.07] bg-white/[0.025] px-3 text-sm text-primary placeholder:text-dim focus:border-purple/45 focus:outline-none"
                  placeholder={t('members.searchPlaceholder')}
                />
                {errors.fullName ? (
                  <span className="text-[10px] text-rose">{errors.fullName}</span>
                ) : null}
              </label>

              <label className="flex flex-col gap-1.5">
                <span className="text-[11px] font-medium text-muted">
                  {t('memberProfile.phone')}
                </span>
                <input
                  type="tel"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  required
                  dir="ltr"
                  className="h-10 rounded-xl border border-white/[0.07] bg-white/[0.025] px-3 text-sm text-primary placeholder:text-dim focus:border-purple/45 focus:outline-none"
                />
                {errors.phone ? (
                  <span className="text-[10px] text-rose">{errors.phone}</span>
                ) : null}
              </label>

              <label className="flex flex-col gap-1.5">
                <span className="text-[11px] font-medium text-muted">
                  {t('memberProfile.secondaryPhone')}
                </span>
                <input
                  type="tel"
                  value={secondaryPhone}
                  onChange={(event) => setSecondaryPhone(event.target.value)}
                  dir="ltr"
                  className="h-10 rounded-xl border border-white/[0.07] bg-white/[0.025] px-3 text-sm text-primary placeholder:text-dim focus:border-purple/45 focus:outline-none"
                />
              </label>

              <label className="flex flex-col gap-1.5 sm:col-span-2">
                <span className="text-[11px] font-medium text-muted">
                  {t('memberProfile.address')}
                </span>
                <input
                  type="text"
                  value={address}
                  onChange={(event) => setAddress(event.target.value)}
                  className="h-10 rounded-xl border border-white/[0.07] bg-white/[0.025] px-3 text-sm text-primary placeholder:text-dim focus:border-purple/45 focus:outline-none"
                />
              </label>

              <label className="flex flex-col gap-1.5">
                <span className="text-[11px] font-medium text-muted">
                  {t('memberProfile.gender')}
                </span>
                <select
                  value={gender}
                  onChange={(event) =>
                    setGender(event.target.value as '' | Gender)
                  }
                  className="h-10 rounded-xl border border-white/[0.07] bg-[#1a1721] px-3 text-sm text-primary focus:border-purple/45 focus:outline-none"
                >
                  {genderOptions.map((option) => (
                    <option key={option.value || 'none'} value={option.value}>
                      {t(option.labelKey as 'common.notProvided')}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-1.5">
                <span className="text-[11px] font-medium text-muted">
                  {t('memberProfile.birthDate')}
                </span>
                <input
                  type="date"
                  value={dateOfBirth}
                  onChange={(event) => setDateOfBirth(event.target.value)}
                  className="h-10 rounded-xl border border-white/[0.07] bg-white/[0.025] px-3 text-sm text-primary focus:border-purple/45 focus:outline-none"
                />
                {errors.dateOfBirth ? (
                  <span className="text-[10px] text-rose">
                    {errors.dateOfBirth}
                  </span>
                ) : null}
              </label>

              <label className="flex flex-col gap-1.5">
                <span className="text-[11px] font-medium text-muted">
                  {t('memberProfile.registrationDate')}
                </span>
                <input
                  type="date"
                  value={registrationDate}
                  onChange={(event) => setRegistrationDate(event.target.value)}
                  required
                  className="h-10 rounded-xl border border-white/[0.07] bg-white/[0.025] px-3 text-sm text-primary focus:border-purple/45 focus:outline-none"
                />
                {errors.registrationDate ? (
                  <span className="text-[10px] text-rose">
                    {errors.registrationDate}
                  </span>
                ) : null}
              </label>

              <label className="flex flex-col gap-1.5">
                <span className="text-[11px] font-medium text-muted">
                  {t('memberProfile.emergencyContact')}
                </span>
                <input
                  type="text"
                  value={emergencyContact}
                  onChange={(event) => setEmergencyContact(event.target.value)}
                  className="h-10 rounded-xl border border-white/[0.07] bg-white/[0.025] px-3 text-sm text-primary placeholder:text-dim focus:border-purple/45 focus:outline-none"
                />
              </label>

              <label className="flex flex-col gap-1.5 sm:col-span-2">
                <span className="text-[11px] font-medium text-muted">
                  {t('memberProfile.notes')}
                </span>
                <textarea
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  rows={3}
                  className="resize-none rounded-xl border border-white/[0.07] bg-white/[0.025] px-3 py-2 text-sm text-primary placeholder:text-dim focus:border-purple/45 focus:outline-none"
                />
              </label>

              <div className="sm:col-span-2">
                <span className="text-[11px] font-medium text-muted">
                  {t('dashboard.recentMembers')}
                </span>
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  <div className="relative size-16 overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.03]">
                    {photoData ? (
                      <img
                        src={photoData}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span className="grid h-full w-full place-items-center text-dim">
                        <ImageIcon className="size-6" strokeWidth={1.6} />
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="inline-flex items-center gap-2 rounded-xl border border-purple/30 bg-purple/12 px-3 py-2 text-xs font-medium text-purple-soft transition-colors hover:bg-purple/20"
                    >
                      <Camera className="size-3.5" />
                      {t('members.uploadPhoto')}
                    </button>
                    {photoData ? (
                      <button
                        type="button"
                        onClick={() => setPhotoData(null)}
                        className="inline-flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-xs font-medium text-muted transition-colors hover:text-rose"
                      >
                        <X className="size-3.5" />
                        {t('members.removePhoto')}
                      </button>
                    ) : null}
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoChange}
                    className="hidden"
                  />
                </div>
                {photoError ? (
                  <p className="mt-2 text-[10px] text-rose">{photoError}</p>
                ) : null}
                {initial?.registrationDate ? (
                  <p className="mt-2 text-[10px] text-dim">
                    {formatDate(initial.registrationDate, 'ar')}
                  </p>
                ) : null}
              </div>
            </div>
          </div>

          <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-white/[0.06] px-5 py-3.5">
            <button
              type="button"
              onClick={() => !submitting && onClose()}
              disabled={submitting}
              className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-2 text-xs font-medium text-muted transition-colors hover:text-primary disabled:opacity-50"
            >
              {t('common.close')}
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 rounded-xl border border-purple/30 bg-purple/20 px-4 py-2 text-xs font-medium text-purple-soft transition-colors hover:bg-purple/30 hover:text-primary disabled:opacity-60"
            >
              {submitting ? <Loader2 className="size-3.5 animate-spin" /> : null}
              {t('common.save')}
            </button>
          </footer>
        </form>
      </div>
    </div>
  )
}
