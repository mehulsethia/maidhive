'use client'

import { useEffect, useState } from 'react'
import { Search } from 'lucide-react'
import { cleanersApi } from '@/lib/api'
import { CleanerCard } from '@/components/cleaner-card'
import { EmptyState } from '@/components/empty-state'
import { LoadingSpinner } from '@/components/loading-spinner'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import type { CleanerSummary } from '@/types'
import { toast } from 'sonner'

const SERVICE_TYPES = [
  { value: '', label: 'All service types' },
  { value: 'standard', label: 'Standard Clean' },
  { value: 'deep_clean', label: 'Deep Clean' },
  { value: 'end_of_tenancy', label: 'End of Tenancy' },
  { value: 'move_in', label: 'Move-in Clean' },
]

export default function SearchPage() {
  const [city, setCity] = useState('')
  const [query, setQuery] = useState('')
  const [cleaners, setCleaners] = useState<CleanerSummary[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)

  async function handleSearch(e?: React.FormEvent) {
    e?.preventDefault()
    setLoading(true)
    setSearched(true)
    try {
      const res = await cleanersApi.search({ city: query || undefined })
      setCleaners(res.data?.items ?? [])
    } catch {
      toast.error('Search failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  // Auto-search on mount to show all available cleaners
  useEffect(() => { handleSearch() }, [])

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Find a cleaner</h1>

      {/* Search bar */}
      <form onSubmit={handleSearch} className="flex gap-2 mb-8">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by city (e.g. Dublin, Cork)"
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button type="submit" loading={loading}>Search</Button>
      </form>

      {/* Results */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-40 rounded-lg" />
          ))}
        </div>
      ) : !searched ? null : cleaners.length === 0 ? (
        <EmptyState
          title="No cleaners found"
          description={query ? `No cleaners found in "${query}". Try a different city.` : 'No approved cleaners are available right now.'}
        />
      ) : (
        <>
          <p className="text-sm text-muted-foreground mb-4">{cleaners.length} cleaner{cleaners.length !== 1 ? 's' : ''} available</p>
          <div className="grid gap-4 sm:grid-cols-2">
            {cleaners.map(c => (
              <CleanerCard key={c.id} cleaner={c} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
