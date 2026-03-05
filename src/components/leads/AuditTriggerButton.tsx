import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { useRequestAudit } from '@/hooks/use-businesses'
import { ZapIcon, RefreshCwIcon, Loader2Icon, CheckIcon, AlertCircleIcon } from 'lucide-react'

interface AuditTriggerButtonProps {
  businessId: string
  hasAudit: boolean
}

type FeedbackState = 'idle' | 'loading' | 'success' | 'error'

export function AuditTriggerButton({ businessId, hasAudit }: AuditTriggerButtonProps) {
  const requestAudit = useRequestAudit()
  const [feedback, setFeedback] = useState<FeedbackState>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  async function handleClick() {
    if (feedback === 'loading') return

    setFeedback('loading')
    setErrorMessage(null)

    try {
      await requestAudit.mutateAsync(businessId)
      setFeedback('success')
      setTimeout(() => setFeedback('idle'), 3000)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      setErrorMessage(msg)
      setFeedback('error')
      setTimeout(() => {
        setFeedback('idle')
        setErrorMessage(null)
      }, 4000)
    }
  }

  if (feedback === 'success') {
    return (
      <div className="flex items-center gap-1.5 text-sm text-green-600">
        <CheckIcon className="size-4" />
        <span>Audit queued</span>
      </div>
    )
  }

  if (feedback === 'error') {
    return (
      <div className="flex items-center gap-1.5 text-sm text-red-600">
        <AlertCircleIcon className="size-4 shrink-0" />
        <span className="truncate">{errorMessage ?? 'Failed to queue audit'}</span>
      </div>
    )
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleClick}
      disabled={feedback === 'loading'}
      className="h-7 gap-1.5 text-xs"
    >
      {feedback === 'loading' ? (
        <Loader2Icon className="size-3.5 animate-spin" />
      ) : hasAudit ? (
        <RefreshCwIcon className="size-3.5" />
      ) : (
        <ZapIcon className="size-3.5" />
      )}
      {feedback === 'loading' ? 'Queuing…' : hasAudit ? 'Re-run' : 'Run Audit'}
    </Button>
  )
}
