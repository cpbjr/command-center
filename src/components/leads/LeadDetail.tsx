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
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { StatusBadge } from './StatusBadge'
import { ScoreBadge } from './ScoreBadge'
import { ConvertToClientDialog } from './ConvertToClientDialog'
import { type Business, useBusinessAudit, useMoveToStage, useMarkDropped, useEndEngagement, useUpdateBusinessNotes, useUpdateBusinessFolderPath, useDeleteBusiness } from '@/hooks/use-businesses'
import { AuditTriggerButton } from './AuditTriggerButton'
import { ContactList } from '@/components/contacts/ContactList'
import { EntityTaskList } from '@/components/tasks/EntityTaskList'
import { ActivityFeed } from '@/components/shared/ActivityFeed'
import { DocumentList } from '@/components/clients/DocumentList'
import { formatDate, formatPhone } from '@/lib/format'
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
  Trash2Icon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { LEAD_DROPDOWN_STAGES, STAGE_LABELS, DROPPED_REASONS, CLOSE_REASONS, type LifecycleStage } from '@/lib/lifecycle'

interface LeadDetailProps {
  business: Business | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

// "veterinary_care" → "Veterinary Care"
function formatCategory(raw: string): string {
  return raw
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

// "210-1 E 37th St, Garden City, ID 83714, USA" → "Garden City"
function extractCity(address: string | null | undefined): string {
  if (!address) return ''
  const parts = address.split(',').map((p) => p.trim()).filter(Boolean)
  // Drop a trailing country segment (e.g. "USA") and the "ST 12345" state/zip.
  let end = parts.length - 1
  if (end >= 0 && /^[A-Za-z.]+$/.test(parts[end])) end-- // country word
  if (end >= 0 && /\d/.test(parts[end])) end-- // "ID 83714"
  return end >= 0 ? parts[end] : ''
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
  const moveToStage = useMoveToStage()
  const markDropped = useMarkDropped()
  const endEngagement = useEndEngagement()
  const updateNotes = useUpdateBusinessNotes()
  const updateFolderPath = useUpdateBusinessFolderPath()
  const deleteBusiness = useDeleteBusiness()
  const [convertDialogOpen, setConvertDialogOpen] = useState(false)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [droppedReasonOpen, setDroppedReasonOpen] = useState(false)
  const [droppedReason, setDroppedReason] = useState<string | null>(null)
  const [endEngagementOpen, setEndEngagementOpen] = useState(false)
  const [closeReason, setCloseReason] = useState<string>(CLOSE_REASONS[0].value)
  const [localStage, setLocalStage] = useState<LifecycleStage | null>(business?.lifecycle_stage ?? null)
  const [localNotes, setLocalNotes] = useState(business?.notes ?? '')
  const [localFolderPath, setLocalFolderPath] = useState(business?.folder_path ?? '')
  const [saveIndicator, setSaveIndicator] = useState<'idle' | 'saving' | 'saved'>('idle')
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    setLocalStage(business?.lifecycle_stage ?? null)
    setLocalNotes(business?.notes ?? '')
    setLocalFolderPath(business?.folder_path ?? '')
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

  const handleFolderPathBlur = useCallback(() => {
    if (!business) return
    const trimmed = localFolderPath.trim()
    const current = business.folder_path ?? ''
    if (trimmed === current) return

    updateFolderPath.mutate({ id: business.id, folder_path: trimmed || null })
  }, [business, localFolderPath, updateFolderPath])

  function handleStageChange(v: LifecycleStage) {
    if (!business) return
    if (v === 'dropped') {
      setDroppedReason(null)
      setDroppedReasonOpen(true)
    } else {
      setLocalStage(v)
      moveToStage.mutate({ id: business.id, stage: v })
    }
  }

  function handleConfirmDropped() {
    if (!business) return
    setLocalStage('dropped')
    markDropped.mutate({ id: business.id, reason: droppedReason })
    setDroppedReasonOpen(false)
  }

  function handleConfirmEndEngagement() {
    if (!business) return
    endEngagement.mutate({ business_id: business.id, close_reason: closeReason })
    setEndEngagementOpen(false)
  }

  return (
    <>
    <Sheet open={open} onOpenChange={onOpenChange}>
      {/* Bottom drawer on mobile (thumb-reachable, full dynamic height); classic
          right rail on sm+. p-0 so the sticky header can span edge-to-edge. */}
      <SheetContent
        side="bottom"
        showCloseButton={false}
        className="p-0 h-[92dvh] flex flex-col sm:inset-y-0 sm:right-0 sm:left-auto sm:h-full sm:max-h-none sm:w-full sm:max-w-lg sm:rounded-none sm:border-l"
      >
        {business ? (
          <>
            {/* Sticky drawer header — grip + serif name + meta rail, always visible */}
            <SheetHeader className="shrink-0 gap-0 border-b border-border-light bg-parchment/95 backdrop-blur px-5 pb-3 pt-0">
              <div className="drawer-grip sm:hidden" />
              <div className="flex items-start gap-3 pt-2">
                <div className="flex-1 min-w-0">
                  <SheetTitle className="font-serif text-xl font-normal leading-tight text-pine-deep">
                    {business.name}
                  </SheetTitle>
                  <SheetDescription asChild>
                    <div className="meta-rail mt-1.5">
                      {Array.isArray(business.gbp_categories) && business.gbp_categories.length > 0 && (
                        <span>{formatCategory(business.gbp_categories[0])}</span>
                      )}
                      {extractCity(business.address) && <span>{extractCity(business.address)}</span>}
                    </div>
                  </SheetDescription>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <ScoreBadge score={business.latest_score} className="text-sm" />
                  <Button
                    size="icon"
                    variant="ghost"
                    className="min-h-[44px] min-w-[44px] text-muted-foreground hover:text-destructive"
                    onClick={() => setDeleteConfirmOpen(true)}
                    title="Delete lead"
                  >
                    <Trash2Icon className="size-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="min-h-[44px] min-w-[44px] text-muted-foreground"
                    onClick={() => onOpenChange(false)}
                    title="Close"
                  >
                    <XCircleIcon className="size-5" />
                  </Button>
                </div>
              </div>
            </SheetHeader>

        <ScrollArea className="flex-1 min-h-0">
          <div className="p-5 space-y-6">
              <>
                <Tabs defaultValue="details">
                  <TabsList className="w-full h-auto gap-0.5 p-1">
                    <TabsTrigger value="details" className="flex-1 text-xs">Details</TabsTrigger>
                    <TabsTrigger value="docs" className="flex-1 text-xs">Docs</TabsTrigger>
                  </TabsList>

                  <TabsContent value="details" className="space-y-6 pt-2">
                    {/* Status */}
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-muted-foreground">Status:</span>
                      <StatusBadge stage={localStage ?? business.lifecycle_stage} />
                      <Select
                        value={localStage ?? business.lifecycle_stage}
                        onValueChange={(v) => handleStageChange(v as LifecycleStage)}
                      >
                        <SelectTrigger size="sm" className="h-11 md:h-7 w-[110px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {LEAD_DROPDOWN_STAGES.map((s) => (
                            <SelectItem key={s} value={s}>
                              {STAGE_LABELS[s]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {(localStage ?? business.lifecycle_stage) === 'lead' && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-11 md:h-7 text-xs"
                          onClick={() => setConvertDialogOpen(true)}
                        >
                          Convert to Client
                        </Button>
                      )}
                      {(localStage ?? business.lifecycle_stage) === 'client' && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-11 md:h-7 text-xs"
                          onClick={() => {
                            setCloseReason(CLOSE_REASONS[0].value)
                            setEndEngagementOpen(true)
                          }}
                        >
                          End Engagement
                        </Button>
                      )}
                    </div>

                    {/* Standing notes — persistent context about the business,
                        distinct from the timestamped Activity Log below. Auto-saves on blur. */}
                    <section className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <h3 className="section-eyebrow">Standing Notes</h3>
                        {saveIndicator === 'saving' && (
                          <span className="text-meta text-muted-foreground animate-pulse">Saving…</span>
                        )}
                        {saveIndicator === 'saved' && (
                          <span className="text-meta text-needle">Saved</span>
                        )}
                      </div>
                      <textarea
                        className="w-full min-h-[88px] resize-y rounded-lg border border-input bg-card px-3 py-2.5 text-sm leading-relaxed placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                        placeholder="Pinned context — who to ask for, decision-maker, quirks. Time-stamped events go in the Activity Log below."
                        value={localNotes}
                        onChange={(e) => setLocalNotes(e.target.value)}
                        onBlur={handleNotesBlur}
                      />
                    </section>

                    {/* Contact info */}
                    <section className="space-y-2">
                      <h3 className="section-eyebrow">
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
                              {formatPhone(business.phone)}
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
                        <h3 className="section-eyebrow">
                          GBP Categories
                        </h3>
                        <div className="flex flex-wrap gap-1.5">
                          {business.gbp_categories.map((cat, i) => (
                            <span
                              key={i}
                              className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-0.5 text-xs text-secondary-foreground"
                            >
                              <TagIcon className="size-3" />
                              {formatCategory(cat)}
                            </span>
                          ))}
                        </div>
                      </section>
                    )}

                    {/* Audit */}
                    <section className="space-y-2">
                      <div className="flex items-center justify-between">
                        <h3 className="section-eyebrow">
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
                      <h3 className="section-eyebrow">
                        Tasks
                      </h3>
                      <EntityTaskList businessId={business.id} businessName={business.name} />
                    </section>

                    {/* Activity Log */}
                    <section className="space-y-2">
                      <ActivityFeed businessId={business.id} />
                    </section>

                    {/* Discovery info */}
                    <section className="space-y-2">
                      <h3 className="section-eyebrow">
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
                  </TabsContent>

                  <TabsContent value="docs" className="pt-2 space-y-3">
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-muted-foreground">File server folder</label>
                      <Input
                        value={localFolderPath}
                        onChange={(e) => setLocalFolderPath(e.target.value)}
                        onBlur={handleFolderPathBlur}
                        placeholder="WhitePineAgency/Clients/Leads/Business-Name"
                        className="text-xs font-mono"
                      />
                    </div>
                    <DocumentList folderPath={business.folder_path ?? null} />
                  </TabsContent>
                </Tabs>
              </>
          </div>
        </ScrollArea>
          </>
        ) : (
          <div className="flex h-40 items-center justify-center text-muted-foreground text-sm">
            Select a lead to view details
          </div>
        )}
      </SheetContent>
    </Sheet>
    <ConvertToClientDialog
      open={convertDialogOpen}
      onOpenChange={setConvertDialogOpen}
      business={business}
    />
    <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Delete Lead</DialogTitle>
          <DialogDescription>
            Delete <strong>{business?.name}</strong>? This cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => setDeleteConfirmOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={deleteBusiness.isPending}
            onClick={async () => {
              if (!business) return
              await deleteBusiness.mutateAsync(business.id)
              setDeleteConfirmOpen(false)
              onOpenChange(false)
            }}
          >
            {deleteBusiness.isPending ? 'Deleting…' : 'Delete'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    <Dialog open={droppedReasonOpen} onOpenChange={setDroppedReasonOpen}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Mark as Dropped</DialogTitle>
          <DialogDescription>
            Why is <strong>{business?.name}</strong> being dropped?
          </DialogDescription>
        </DialogHeader>
        <Select value={droppedReason ?? undefined} onValueChange={setDroppedReason}>
          <SelectTrigger size="sm" className="w-full">
            <SelectValue placeholder="Select a reason (optional)" />
          </SelectTrigger>
          <SelectContent>
            {DROPPED_REASONS.map((r) => (
              <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => setDroppedReasonOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleConfirmDropped} disabled={markDropped.isPending}>
            {markDropped.isPending ? 'Saving…' : 'Confirm'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    <Dialog open={endEngagementOpen} onOpenChange={setEndEngagementOpen}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>End Engagement</DialogTitle>
          <DialogDescription>
            End the client engagement with <strong>{business?.name}</strong>?
          </DialogDescription>
        </DialogHeader>
        <Select value={closeReason} onValueChange={setCloseReason}>
          <SelectTrigger size="sm" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CLOSE_REASONS.map((r) => (
              <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => setEndEngagementOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleConfirmEndEngagement} disabled={endEngagement.isPending}>
            {endEngagement.isPending ? 'Saving…' : 'Confirm'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  )
}
