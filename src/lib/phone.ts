/**
 * One phone rule. Strip non-digits. If 11 digits start with 1, drop that 1.
 * Ten digits are a US number. Empty is empty. Anything else is not a phone.
 */

export function nationalDigits(value: string | null | undefined): string | null {
  if (!value) return null
  let digits = value.replace(/\D/g, '')
  if (digits.length === 11 && digits.startsWith('1')) digits = digits.slice(1)
  if (digits.length !== 10) return null
  return digits
}

/** Empty stays ''. Ten digits become +1 plus those digits. Anything else is null. */
export function toE164(value: string | null | undefined): string | null {
  if (value == null || value.trim() === '') return ''
  const digits = nationalDigits(value)
  if (!digits) return null
  return `+1${digits}`
}
