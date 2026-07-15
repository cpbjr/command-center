export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(amount)
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(date))
}

export function formatScore(score: number): string {
  return `${score}/5`
}

/**
 * Format a US phone number as (AAA) BBB-CCCC.
 * Accepts messy input (punctuation, +1 country code, trailing extension).
 * Returns the original string unchanged when it isn't a recognizable
 * 10-digit US number, so unusual entries are never mangled.
 */
export function formatPhone(phone: string | null | undefined): string {
  if (!phone) return ''

  // Split off a trailing extension (e.g. "x12", "ext. 5") to preserve it.
  const extMatch = phone.match(/\s*(?:x|ext\.?|extension)\s*\d+\s*$/i)
  const ext = extMatch ? ` ${extMatch[0].trim()}` : ''
  const main = ext ? phone.slice(0, extMatch!.index).trim() : phone

  let digits = main.replace(/\D/g, '')
  if (digits.length === 11 && digits.startsWith('1')) digits = digits.slice(1)

  if (digits.length !== 10) return phone // not a standard US number — leave as-is
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}${ext}`
}
