import { useState, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { ClientCard } from './ClientCard'
import { ClientForm } from './ClientForm'
import { useClients } from '@/hooks/use-clients'
import { useTasks } from '@/hooks/use-tasks'
import type { Client } from '@/hooks/use-clients'

export function ClientBoard() {
  const { data: clients, isLoading, error } = useClients()
  const { data: allTasks = [] } = useTasks()
  const [formOpen, setFormOpen] = useState(false)
  const [selectedClient, setSelectedClient] = useState<Client | null>(null)

  const taskCountsByClient = useMemo(() => {
    const counts: Record<number, number> = {}
    for (const task of allTasks) {
      if (task.client_id != null && task.status !== 'done') {
        counts[task.client_id] = (counts[task.client_id] ?? 0) + 1
      }
    }
    return counts
  }, [allTasks])

  function handleAdd() {
    setSelectedClient(null)
    setFormOpen(true)
  }

  function handleEdit(client: Client) {
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
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-semibold text-text-primary">Clients</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {clients?.length ?? 0} active engagement{clients?.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Button onClick={handleAdd}>+ Add Client</Button>
      </div>

      {!clients || clients.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <p className="text-lg font-medium text-text-primary">No clients yet.</p>
          <p className="text-sm text-muted-foreground mt-1 mb-4">Add your first client to get started.</p>
          <Button onClick={handleAdd}>Add Your First Client</Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {clients.map((client) => (
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
