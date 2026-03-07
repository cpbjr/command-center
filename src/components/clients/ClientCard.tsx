import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatCurrency, formatDate } from '@/lib/format'
import { MapPinIcon, PhoneIcon, GlobeIcon, FileText } from 'lucide-react'
import type { Client, ServiceTier, ClientStatus } from '@/hooks/use-clients'

interface ClientCardProps {
  client: Client
  onClick: (client: Client) => void
  taskCount?: number
  documentCount?: number
}

const tierConfig: Record<ServiceTier, { label: string; className: string }> = {
  'Lazy Ranking': {
    label: 'Lazy Ranking',
    className: 'bg-green-100 text-green-800 border-green-200',
  },
  'Core 30': {
    label: 'Core 30',
    className: 'bg-blue-100 text-blue-800 border-blue-200',
  },
  'Geographic Expansion': {
    label: 'Geographic Expansion',
    className: 'bg-amber-100 text-amber-800 border-amber-200',
  },
  'Quick Win': {
    label: 'Quick Win',
    className: 'bg-purple-100 text-purple-800 border-purple-200',
  },
}

const statusConfig: Record<ClientStatus, { label: string; dotClass: string }> = {
  active: { label: 'Active', dotClass: 'bg-green-500' },
  paused: { label: 'Paused', dotClass: 'bg-yellow-500' },
  churned: { label: 'Churned', dotClass: 'bg-red-500' },
}

export function ClientCard({ client, onClick, taskCount, documentCount }: ClientCardProps) {
  const tier = tierConfig[client.service_tier] ?? {
    label: client.service_tier,
    className: 'bg-gray-100 text-gray-800 border-gray-200',
  }
  const statusInfo = statusConfig[client.status] ?? {
    label: client.status,
    dotClass: 'bg-gray-400',
  }

  return (
    <Card
      className="cursor-pointer"
      onClick={() => onClick(client)}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <CardTitle className="text-lg leading-tight truncate">{client.name}</CardTitle>
            {taskCount != null && taskCount > 0 && (
              <Badge variant="outline" className="text-xs shrink-0">{taskCount}</Badge>
            )}
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <span
              className={`inline-block h-2.5 w-2.5 rounded-full ${statusInfo.dotClass}`}
              title={statusInfo.label}
            />
            <span className="text-xs text-muted-foreground">{statusInfo.label}</span>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <Badge variant="outline" className={`w-fit text-xs ${tier.className}`}>
            {tier.label}
          </Badge>
          {documentCount != null && documentCount > 0 && (
            <FileText className="h-3.5 w-3.5 text-muted-foreground" />
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        {(client.address || client.phone || client.website_url) && (
          <div className="space-y-1 pb-2 border-b border-border">
            {client.address && (
              <div className="flex items-start gap-1.5 text-muted-foreground">
                <MapPinIcon className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <span className="text-xs">{client.address}</span>
              </div>
            )}
            {client.phone && (
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <PhoneIcon className="h-3.5 w-3.5 shrink-0" />
                <span className="text-xs">{client.phone}</span>
              </div>
            )}
            {client.website_url && (
              <div className="flex items-center gap-1.5 text-muted-foreground" onClick={(e) => e.stopPropagation()}>
                <GlobeIcon className="h-3.5 w-3.5 shrink-0" />
                <a
                  href={client.website_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-600 hover:underline truncate"
                >
                  {client.website_url.replace(/^https?:\/\//, '')}
                </a>
              </div>
            )}
          </div>
        )}
        <div className="flex justify-between">
          <span className="text-muted-foreground">Monthly Revenue</span>
          <span className="font-medium">
            {client.monthly_revenue != null
              ? formatCurrency(Number(client.monthly_revenue))
              : '—'}
          </span>
        </div>
        {client.current_phase && (
          <div>
            <span className="text-muted-foreground">Phase</span>
            <p className="mt-0.5 font-medium">{client.current_phase}</p>
          </div>
        )}
        {client.next_action && (
          <div>
            <span className="text-muted-foreground">Next Action</span>
            <p className="mt-0.5 text-text-primary">{client.next_action}</p>
          </div>
        )}
        {client.start_date && (
          <div className="flex justify-between pt-1 border-t border-border">
            <span className="text-muted-foreground">Started</span>
            <span>{formatDate(client.start_date)}</span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
