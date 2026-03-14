import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useCreateClient, useUpdateClient } from '@/hooks/use-clients'
import type { Client, ClientInsert, ServiceTier, ClientStatus } from '@/hooks/use-clients'
import { ContactList } from '@/components/contacts/ContactList'
import { ClientTaskList } from '@/components/tasks/ClientTaskList'
import { CommLogWidget } from '@/components/clients/CommLogWidget'
import { GbpScoreWidget } from '@/components/clients/GbpScoreWidget'
import { GbpInsightsWidget } from '@/components/clients/GbpInsightsWidget'
import { BaselineWidget } from '@/components/clients/BaselineWidget'
import { DocumentList } from '@/components/clients/DocumentList'
import { AnalyticsWidget } from '@/components/clients/AnalyticsWidget'

interface ClientFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  client?: Client | null
}

type FormValues = {
  name: string
  address: string
  phone: string
  website_url: string
  service_tier: ServiceTier
  monthly_revenue: string
  current_phase: string
  next_action: string
  status: ClientStatus
  start_date: string
  notes: string
}

const SERVICE_TIERS: ServiceTier[] = ['Lazy Ranking', 'Core 30', 'Geographic Expansion', 'Quick Win']
const STATUSES: ClientStatus[] = ['active', 'paused', 'churned']

const emptyForm = (): FormValues => ({
  name: '',
  address: '',
  phone: '',
  website_url: '',
  service_tier: 'Lazy Ranking',
  monthly_revenue: '',
  current_phase: '',
  next_action: '',
  status: 'active',
  start_date: '',
  notes: '',
})

function clientToForm(client: Client): FormValues {
  return {
    name: client.name ?? '',
    address: client.address ?? '',
    phone: client.phone ?? '',
    website_url: client.website_url ?? '',
    service_tier: client.service_tier ?? 'Lazy Ranking',
    monthly_revenue: client.monthly_revenue != null ? String(client.monthly_revenue) : '',
    current_phase: client.current_phase ?? '',
    next_action: client.next_action ?? '',
    status: client.status ?? 'active',
    start_date: client.start_date ?? '',
    notes: client.notes ?? '',
  }
}

function ClientFormFields({
  values,
  set,
  submitting,
  isEdit,
  onCancel,
}: {
  values: FormValues
  set: <K extends keyof FormValues>(key: K, value: FormValues[K]) => void
  submitting: boolean
  isEdit: boolean
  onCancel: () => void
}) {
  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <label className="text-sm font-medium">Name *</label>
        <Input
          value={values.name}
          onChange={(e) => set('name', e.target.value)}
          placeholder="Client business name"
          required
        />
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium">Address</label>
        <Input value={values.address} onChange={(e) => set('address', e.target.value)} placeholder="123 Main St, Eagle, ID" />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="text-sm font-medium">Phone</label>
          <Input value={values.phone} onChange={(e) => set('phone', e.target.value)} placeholder="(208) 555-1234" />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium">Website</label>
          <Input value={values.website_url} onChange={(e) => set('website_url', e.target.value)} placeholder="https://..." />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="text-sm font-medium">Service Tier</label>
          <Select value={values.service_tier} onValueChange={(v) => set('service_tier', v as ServiceTier)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {SERVICE_TIERS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium">Status</label>
          <Select value={values.status} onValueChange={(v) => set('status', v as ClientStatus)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {STATUSES.map((s) => <SelectItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="text-sm font-medium">Monthly Revenue ($)</label>
          <Input
            value={values.monthly_revenue}
            onChange={(e) => set('monthly_revenue', e.target.value)}
            type="number" step="0.01" min="0" placeholder="0.00"
          />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium">Start Date</label>
          <Input value={values.start_date} onChange={(e) => set('start_date', e.target.value)} type="date" />
        </div>
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium">Current Phase</label>
        <Input value={values.current_phase} onChange={(e) => set('current_phase', e.target.value)} placeholder="e.g. GBP Optimization" />
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium">Next Action</label>
        <Input value={values.next_action} onChange={(e) => set('next_action', e.target.value)} placeholder="e.g. Send weekly report" />
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium">Notes</label>
        <textarea
          value={values.notes}
          onChange={(e) => set('notes', e.target.value)}
          rows={3}
          placeholder="Additional context..."
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
        />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Client'}
        </Button>
      </div>
    </div>
  )
}

export function ClientForm({ open, onOpenChange, client }: ClientFormProps) {
  const isEdit = !!client
  const [values, setValues] = useState<FormValues>(emptyForm)
  const [submitting, setSubmitting] = useState(false)

  const createClient = useCreateClient()
  const updateClient = useUpdateClient()

  useEffect(() => {
    if (open) setValues(client ? clientToForm(client) : emptyForm())
  }, [open, client])

  function set<K extends keyof FormValues>(key: K, value: FormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!values.name.trim()) return
    setSubmitting(true)
    try {
      const payload: ClientInsert = {
        name: values.name.trim(),
        address: values.address,
        phone: values.phone,
        website_url: values.website_url,
        service_tier: values.service_tier,
        monthly_revenue: values.monthly_revenue ? Number(values.monthly_revenue) : 0,
        current_phase: values.current_phase,
        next_action: values.next_action,
        status: values.status,
        start_date: values.start_date || (null as unknown as string),
        notes: values.notes,
      }
      if (isEdit && client) {
        await updateClient.mutateAsync({ id: client.id, ...payload })
      } else {
        await createClient.mutateAsync(payload)
      }
      onOpenChange(false)
    } finally {
      setSubmitting(false)
    }
  }

  // Edit mode: Sheet with tabs (Details + Contacts)
  if (isEdit && client) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-full sm:max-w-lg p-0">
          <ScrollArea className="h-full">
            <div className="p-6 space-y-4">
              <SheetHeader className="p-0">
                <SheetTitle>{client.name}</SheetTitle>
              </SheetHeader>
              <Tabs defaultValue="details">
                <TabsList className="w-full flex-wrap h-auto gap-0.5 p-1">
                  <TabsTrigger value="details" className="flex-1 text-xs">Details</TabsTrigger>
                  <TabsTrigger value="contacts" className="flex-1 text-xs">Contacts</TabsTrigger>
                  <TabsTrigger value="tasks" className="flex-1 text-xs">Tasks</TabsTrigger>
                  <TabsTrigger value="activity" className="flex-1 text-xs">Activity</TabsTrigger>
                  <TabsTrigger value="gbp" className="flex-1 text-xs">GBP</TabsTrigger>
                  <TabsTrigger value="docs" className="flex-1 text-xs">Docs</TabsTrigger>
                </TabsList>
                <TabsContent value="details">
                  <form onSubmit={handleSubmit} className="pt-4">
                    <ClientFormFields values={values} set={set} submitting={submitting} isEdit onCancel={() => onOpenChange(false)} />
                  </form>
                </TabsContent>
                <TabsContent value="contacts" className="pt-4">
                  <ContactList clientId={client.id} />
                </TabsContent>
                <TabsContent value="tasks" className="pt-4">
                  <ClientTaskList clientId={client.id} businessId={client.business_id} />
                </TabsContent>
                <TabsContent value="activity" className="pt-4">
                  <CommLogWidget clientId={client.id} />
                </TabsContent>
                <TabsContent value="gbp" className="pt-4 space-y-6">
                  <GbpScoreWidget clientId={client.id} />
                  <GbpInsightsWidget clientId={client.id} />
                  <BaselineWidget clientId={client.id} />
                  <div className="mt-6 border-t pt-4">
                    <AnalyticsWidget clientId={client.id} clientName={client.name} />
                  </div>
                </TabsContent>
                <TabsContent value="docs" className="pt-4">
                  <DocumentList clientId={client.id} />
                </TabsContent>
              </Tabs>
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>
    )
  }

  // Add mode: simple dialog
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Client</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <ClientFormFields values={values} set={set} submitting={submitting} isEdit={false} onCancel={() => onOpenChange(false)} />
        </form>
      </DialogContent>
    </Dialog>
  )
}
