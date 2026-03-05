import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { type Business, useConvertToClient } from '@/hooks/use-businesses'

const SERVICE_TIERS = ['Lazy Ranking', 'Core 30', 'Geographic Expansion'] as const
type ServiceTier = (typeof SERVICE_TIERS)[number]

interface ConvertToClientDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  business: Business | null
}

export function ConvertToClientDialog({
  open,
  onOpenChange,
  business,
}: ConvertToClientDialogProps) {
  const [serviceTier, setServiceTier] = useState<ServiceTier>('Lazy Ranking')
  const [monthlyRevenue, setMonthlyRevenue] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const convertToClient = useConvertToClient()

  async function handleConvert() {
    if (!business) return
    setSubmitting(true)
    try {
      await convertToClient.mutateAsync({
        business,
        service_tier: serviceTier,
        monthly_revenue: monthlyRevenue ? Number(monthlyRevenue) : 0,
      })
      onOpenChange(false)
      setServiceTier('Lazy Ranking')
      setMonthlyRevenue('')
    } finally {
      setSubmitting(false)
    }
  }

  function handleCancel() {
    onOpenChange(false)
    setServiceTier('Lazy Ranking')
    setMonthlyRevenue('')
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Convert Lead to Client</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1">
            <label className="text-sm font-medium text-muted-foreground">Business</label>
            <p className="text-sm font-semibold">{business?.name}</p>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">Service Tier</label>
            <Select
              value={serviceTier}
              onValueChange={(v) => setServiceTier(v as ServiceTier)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SERVICE_TIERS.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">Monthly Revenue ($)</label>
            <Input
              value={monthlyRevenue}
              onChange={(e) => setMonthlyRevenue(e.target.value)}
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
            />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={handleCancel} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleConvert} disabled={submitting || !business}>
            {submitting ? 'Converting…' : 'Convert to Client'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
