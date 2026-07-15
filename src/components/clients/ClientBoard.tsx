import { useState, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { ClientCard, statusConfig } from './ClientCard'
import { ClientForm } from './ClientForm'
import { useContracts } from '@/hooks/use-contracts'
import { useOpenTaskCountsByContract } from '@/hooks/use-tasks'
import type { Contract, ContractStatus } from '@/hooks/use-contracts'
import { cn } from '@/lib/utils'

const FILTER_TABS: (ContractStatus | 'all')[] = ['active', 'paused', 'churned', 'all']

export function ClientBoard() {
  const { data: clients, isLoading, error } = useContracts()
  const { data: taskCountsByClient = {} } = useOpenTaskCountsByContract()
  const [formOpen, setFormOpen] = useState(false)
  const [selectedClient, setSelectedClient] = useState<Contract | null>(null)
  const [statusFilter, setStatusFilter] = useState<ContractStatus | 'all'>('active')

  const filteredClients = useMemo(() => {
    if (statusFilter === 'all') return clients
    return clients?.filter((c) => c.status === statusFilter)
  }, [clients, statusFilter])

  function handleAdd() {
    setSelectedClient(null)
    setFormOpen(true)
  }

  function handleEdit(client: Contract) {
    setSelectedClient(client)
    setFormOpen(true)
  }

  function handleFormClose(open: boolean) {
    setFormOpen(open)
    if (!open) setSelectedClient(null)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="py-10 text-center text-sm text-destructive">
        Failed to load clients. Please refresh.
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="font-serif text-2xl font-semibold text-text-primary">Clients</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {filteredClients?.length ?? 0} {statusFilter === 'all' ? 'total' : statusConfig[statusFilter].label.toLowerCase()} client{filteredClients?.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Button onClick={handleAdd}>+ Add Client</Button>
      </div>

      <div className="flex gap-4 mb-6">
        {FILTER_TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setStatusFilter(tab)}
            className={cn(
              'text-sm pb-1 transition-colors',
              statusFilter === tab
                ? 'text-pine-mid font-semibold border-b-2 border-pine-mid'
                : 'text-text-tertiary hover:text-text-secondary'
            )}
          >
            {tab === 'all' ? 'All' : statusConfig[tab].label}
          </button>
        ))}
      </div>

      {!clients || clients.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <p className="text-lg font-medium text-text-primary">No clients yet.</p>
          <p className="text-sm text-muted-foreground mt-1 mb-4">Add your first client to get started.</p>
          <Button onClick={handleAdd}>Add Your First Client</Button>
        </div>
      ) : !filteredClients || filteredClients.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <p className="text-lg font-medium text-text-primary">
            No {statusFilter === 'all' ? '' : statusConfig[statusFilter].label.toLowerCase() + ' '}clients.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredClients.map((client) => (
            <ClientCard
              key={client.id}
              client={client}
              onClick={handleEdit}
              taskCount={taskCountsByClient[client.id]}
            />
          ))}
        </div>
      )}

      <ClientForm
        open={formOpen}
        onOpenChange={handleFormClose}
        client={selectedClient}
      />
    </div>
  )
}
