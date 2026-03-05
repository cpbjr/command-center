import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ScrollArea } from '@/components/ui/scroll-area'
import { StatusBadge } from './StatusBadge'
import { ScoreBadge } from './ScoreBadge'
import { ConvertToClientDialog } from './ConvertToClientDialog'
import { type Business, useBusinessAudit, useUpdateBusinessStatus, useUpdateBusinessNotes } from '@/hooks/use-businesses'
import { AuditTriggerButton } from './AuditTriggerButton'
import { ContactList } from '@/components/contacts/ContactList'
import { LeadTaskList } from '@/components/tasks/LeadTaskList'
import { formatDate } from '@/lib/format'
import {
  MapPinIcon,
  PhoneIcon,
  GlobeIcon,
  MapIcon,
  CalendarIcon,
  TagIcon,
  StarIcon,
  CheckCircle2Icon,
  XCircleIcon,
  MinusCircleIcon,
} from 'lucide-react'

interface LeadDetailProps {
  business: Business | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

function BooleanFlag({ value, label }: { value: boolean | null; label: string }) {
  if (value === null || value === undefined) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <MinusCircleIcon className="size-4" />
        <span>{label}</span>
        <span className="ml-auto text-xs">unknown</span>
      </div>
    )
  }
  return (
    <div className={`flex items-center gap-2 text-sm ${value ? 'text-green-700' : 'text-red-600'}`}>
      {value ? (
        <CheckCircle2Icon className="size-4 text-green-500" />
      ) : (
        <XCircleIcon className="size-4 text-red-400" />
      )}
      <span>{label}</span>
    </div>
  )
}

export function LeadDetail({ business, open, onOpenChange }: LeadDetailProps) {
  const { data: audit } = useBusinessAudit(business?.id ?? null)
  const updateStatus = useUpdateBusinessStatus()
  const updateNotes = useUpdateBusinessNotes()
  const [convertDialogOpen, setConvertDialogOpen] = useState(false)
  const [localStatus, setLocalStatus] = useState<Business['contact_status'] | null>(business?.contact_status ?? null)
  const [localNotes, setLocalNotes] = useState(business?.notes ?? '')
  const [saveIndicator, setSaveIndicator] = useState<'idle' | 'saving' | 'saved'>('idle')
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    setLocalStatus(business?.contact_status ?? null)
    setLocalNotes(business?.notes ?? '')
    setSaveIndicator('idle')
  }, [business?.id])

  const handleNotesBlur = useCallback(() => {
    if (!business) return
    if (localNotes === (business.notes ?? '')) return

    setSaveIndicator('saving')
    updateNotes.mutate(
      { id: business.id, notes: localNotes },
      {
        onSuccess: () => {
          setSaveIndicator('saved')
          if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
          saveTimerRef.current = setTimeout(() => setSaveIndicator('idle'), 2000)
        },
        onError: () => setSaveIndicator('idle'),
      }
    )
  }, [business, localNotes, updateNotes])

  function handleStatusChange(v: Business['contact_status']) {
    if (!business) return
    if (v === 'CLOSED-WON') {
      setConvertDialogOpen(true)
    } else {
      setLocalStatus(v)
      updateStatus.mutate({ id: business.id, contact_status: v })
    }
  }

  return (
    <>
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg p-0">
        <ScrollArea className="h-full">
          <div className="p-6 space-y-6">
            {business ? (
              <>
                <SheetHeader className="p-0">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <SheetTitle className="text-xl leading-tight">{business.name}</SheetTitle>
                      {Array.isArray(business.gbp_categories) && business.gbp_categories.length > 0 && (
                        <SheetDescription className="mt-1">
                          {business.gbp_categories[0]}
                        </SheetDescription>
                      )}
                    </div>
                    <ScoreBadge score={business.latest_score} className="shrink-0 text-sm" />
                  </div>
                </SheetHeader>

                {/* Status */}
                <div className="flex items-center gap-3">
                  <span className="text-sm text-muted-foreground">Status:</span>
                  <StatusBadge status={localStatus ?? business.contact_status} />
                  <Select
                    value={localStatus ?? business.contact_status}
                    onValueChange={(v) => handleStatusChange(v as Business['contact_status'])}
                  >
                    <SelectTrigger size="sm" className="h-7 w-[110px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(['NEW', 'IDENTIFIED', 'CONTACTED', 'REPLIED', 'CLOSED', 'CLOSED-WON'] as const).map((s) => (
                        <SelectItem key={s} value={s}>
                          {s === 'CLOSED-WON' ? 'Closed-Won' : s.charAt(0) + s.slice(1).toLowerCase()}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Notes */}
                <section className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Notes
                    </h3>
                    {saveIndicator === 'saving' && (
                      <span className="text-xs text-muted-foreground animate-pulse">Saving...</span>
                    )}
                    {saveIndicator === 'saved' && (
                      <span className="text-xs text-green-600">Saved</span>
                    )}
                  </div>
                  <textarea
                    className="w-full min-h-[80px] resize-y rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                    placeholder="Add notes about this business..."
                    value={localNotes}
                    onChange={(e) => setLocalNotes(e.target.value)}
                    onBlur={handleNotesBlur}
                  />
                </section>

                {/* Contact info */}
                <section className="space-y-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Contact
                  </h3>
                  <div className="space-y-2">
                    {business.address && (
                      <div className="flex items-start gap-2 text-sm">
                        <MapPinIcon className="size-4 mt-0.5 shrink-0 text-muted-foreground" />
                        <span>{business.address}</span>
                      </div>
                    )}
                    {business.phone && (
                      <div className="flex items-center gap-2 text-sm">
                        <PhoneIcon className="size-4 shrink-0 text-muted-foreground" />
                        <a href={`tel:${business.phone}`} className="hover:underline text-primary">
                          {business.phone}
                        </a>
                      </div>
                    )}
                    {business.website_url && (
                      <div className="flex items-center gap-2 text-sm">
                        <GlobeIcon className="size-4 shrink-0 text-muted-foreground" />
                        <a
                          href={business.website_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:underline text-primary truncate"
                        >
                          {business.website_url.replace(/^https?:\/\//, '')}
                        </a>
                      </div>
                    )}
                    {business.google_maps_uri && (
                      <div className="flex items-center gap-2 text-sm">
                        <MapIcon className="size-4 shrink-0 text-muted-foreground" />
                        <a
                          href={business.google_maps_uri}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:underline text-primary"
                        >
                          Open in Google Maps
                        </a>
                      </div>
                    )}
                    {business.rating != null && (
                      <div className="flex items-center gap-2 text-sm">
                        <StarIcon className="size-4 shrink-0 fill-amber-400 text-amber-400" />
                        <span>
                          {business.rating.toFixed(1)} stars
                          {business.user_rating_count != null && (
                            <span className="text-muted-foreground ml-1">
                              ({business.user_rating_count.toLocaleString()} reviews)
                            </span>
                          )}
                        </span>
                      </div>
                    )}
                  </div>
                </section>

                {/* GBP categories */}
                {Array.isArray(business.gbp_categories) && business.gbp_categories.length > 0 && (
                  <section className="space-y-2">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      GBP Categories
                    </h3>
                    <div className="flex flex-wrap gap-1.5">
                      {business.gbp_categories.map((cat, i) => (
                        <span
                          key={i}
                          className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-0.5 text-xs text-secondary-foreground"
                        >
                          <TagIcon className="size-3" />
                          {cat}
                        </span>
                      ))}
                    </div>
                  </section>
                )}

                {/* Audit */}
                <section className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Audit
                    </h3>
                    <AuditTriggerButton businessId={business.id} hasAudit={!!audit} />
                  </div>
                  {audit ? (
                    <div className="rounded-md border p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Score</span>
                        <ScoreBadge score={audit.score} />
                      </div>
                      {audit.mobile_speed_score != null && (
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Mobile speed score</span>
                          <span className="font-medium">{audit.mobile_speed_score}</span>
                        </div>
                      )}
                      <div className="pt-1 space-y-1.5 border-t">
                        <BooleanFlag value={audit.has_schema} label="Has schema markup" />
                        <BooleanFlag value={audit.has_sameas} label="Has sameAs links" />
                        <BooleanFlag value={audit.category_aligned} label="Category aligned" />
                        <BooleanFlag value={audit.nap_consistent} label="NAP consistent" />
                      </div>
                      {audit.audited_at && (
                        <p className="text-xs text-muted-foreground pt-1">
                          Audited {formatDate(audit.audited_at)}
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No audit data available</p>
                  )}
                </section>

                {/* Contacts */}
                <section className="space-y-2">
                  <ContactList businessId={business.id} />
                </section>

                {/* Tasks */}
                <section className="space-y-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Tasks
                  </h3>
                  <LeadTaskList businessId={business.id} />
                </section>

                {/* Discovery info */}
                <section className="space-y-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Discovery
                  </h3>
                  <div className="rounded-md border p-3 space-y-2 text-sm">
                    {business.search_query && (
                      <div className="flex items-start gap-2">
                        <span className="text-muted-foreground w-24 shrink-0">Query</span>
                        <span className="font-medium">{business.search_query}</span>
                      </div>
                    )}
                    {business.discovered_at && (
                      <div className="flex items-start gap-2">
                        <CalendarIcon className="size-4 text-muted-foreground mt-0.5 shrink-0" />
                        <span>{formatDate(business.discovered_at)}</span>
                      </div>
                    )}
                    {business.discovery_rank != null && (
                      <div className="flex items-start gap-2">
                        <span className="text-muted-foreground w-24 shrink-0">Rank</span>
                        <span>
                          #{business.discovery_rank}
                          {business.rank_total_candidates != null && (
                            <span className="text-muted-foreground"> of {business.rank_total_candidates}</span>
                          )}
                        </span>
                      </div>
                    )}
                  </div>
                </section>
              </>
            ) : (
              <div className="flex h-40 items-center justify-center text-muted-foreground text-sm">
                Select a lead to view details
              </div>
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
    <ConvertToClientDialog
      open={convertDialogOpen}
      onOpenChange={setConvertDialogOpen}
      business={business}
    />
    </>
  )
}
