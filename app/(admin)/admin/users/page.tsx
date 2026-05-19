'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Search, UserX, UserCheck } from 'lucide-react'
import { adminApi } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select } from '@/components/ui/select'
import { LoadingSpinner } from '@/components/loading-spinner'
import { EmptyState } from '@/components/empty-state'
import { reportLoadError, resetLoadError } from '@/lib/load-error-policy'
import { formatDate } from '@/lib/utils'
import { cn } from '@/lib/utils'
import type { AdminUser } from '@/types'
import { toast } from 'sonner'

const PAGE_SIZE = 30

const ROLE_BADGE: Record<string, any> = {
  admin:   { variant: 'destructive', label: 'Admin' },
  cleaner: { variant: 'warning',     label: 'Cleaner' },
  client:  { variant: 'secondary',   label: 'Client' },
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [total, setTotal] = useState(0)
  const [hasNext, setHasNext] = useState(false)
  const [page, setPage] = useState(1)
  const [roleFilter, setRoleFilter] = useState('')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [toggling, setToggling] = useState<string | null>(null)

  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  const load = useCallback(async (p: number, role: string, q: string) => {
    setLoading(true)
    try {
      const res = await adminApi.listUsers({ page: p, role: role || undefined, search: q || undefined })
      setUsers(res.data?.items ?? [])
      setTotal(res.data?.total ?? 0)
      setHasNext(res.data?.has_next ?? false)
      resetLoadError('admin-users')
    } catch {
      reportLoadError('admin-users', 'Failed to load users.')
    } finally {
      setLoading(false)
    }
  }, [])

  // Load on page/filter change
  useEffect(() => { load(page, roleFilter, search) }, [page, roleFilter, load]) // eslint-disable-line

  // Debounce search
  function handleSearch(val: string) {
    setSearch(val)
    setPage(1)
    if (searchTimeout.current) clearTimeout(searchTimeout.current)
    searchTimeout.current = setTimeout(() => {
      load(1, roleFilter, val)
    }, 400)
  }

  async function toggleActive(user: AdminUser) {
    setToggling(user.id)
    try {
      const res = await adminApi.toggleUserActive(user.id)
      setUsers(prev =>
        prev.map(u => u.id === user.id ? { ...u, is_active: res.data?.is_active ?? !u.is_active } : u)
      )
      toast.success(res.data?.is_active ? `${user.name} activated.` : `${user.name} deactivated.`)
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to update user.')
    } finally {
      setToggling(null)
    }
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="grid w-full grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_280px]">
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or email…"
            value={search}
            onChange={e => handleSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select
          value={roleFilter}
          onChange={e => { setRoleFilter(e.target.value); setPage(1) }}
          className="w-full"
        >
          <option value="">All roles</option>
          <option value="client">Clients</option>
          <option value="cleaner">Cleaners</option>
          <option value="admin">Admins</option>
        </Select>
      </div>

      {/* Table */}
      {loading ? (
        <LoadingSpinner />
      ) : users.length === 0 ? (
        <EmptyState title="No users found" description="Try adjusting your search or filter." />
      ) : (
        <div className="-mx-4 w-[calc(100%+2rem)] max-w-none overflow-x-auto overscroll-x-contain rounded-lg border sm:mx-0 sm:w-full">
          <table className="w-full min-w-[680px] text-sm sm:min-w-[760px]">
            <thead className="bg-muted/40">
              <tr className="text-left text-muted-foreground text-xs uppercase tracking-wide">
                <th className="px-4 py-3 font-medium">User</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium">Phone</th>
                <th className="px-4 py-3 font-medium">Joined</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {users.map(u => {
                const rb = ROLE_BADGE[u.role]
                return (
                  <tr key={u.id} className={cn('hover:bg-muted/20 transition-colors', !u.is_active && 'opacity-50')}>
                    <td className="px-4 py-3 min-w-[180px]">
                      <p className="font-medium break-words">{u.name}</p>
                      <p className="text-xs text-muted-foreground break-all">{u.email}</p>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={rb.variant}>{rb.label}</Badge>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">
                      {u.phone ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs whitespace-nowrap">
                      {formatDate(u.created_at)}
                    </td>
                    <td className="px-4 py-3">
                      {u.is_active ? (
                        <span className="text-xs text-green-700 font-medium">Active</span>
                      ) : (
                        <span className="text-xs text-muted-foreground">Deactivated</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {u.role !== 'admin' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleActive(u)}
                          disabled={toggling === u.id}
                          className={cn(
                            'text-xs h-7',
                            u.is_active
                              ? 'text-destructive hover:text-destructive hover:bg-destructive/10'
                              : 'text-green-700 hover:text-green-700 hover:bg-green-50',
                          )}
                        >
                          {u.is_active ? (
                            <><UserX className="h-3.5 w-3.5 mr-1" /> Deactivate</>
                          ) : (
                            <><UserCheck className="h-3.5 w-3.5 mr-1" /> Reactivate</>
                          )}
                        </Button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {!loading && total > PAGE_SIZE && (
        <div className="flex flex-col gap-3 text-sm sm:flex-row sm:items-center sm:justify-between">
          <p className="text-muted-foreground">
            Page {page} · {Math.min(page * PAGE_SIZE, total)} of {total} users
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 1}
              onClick={() => setPage(p => Math.max(1, p - 1))}
            >
              <ChevronLeft className="h-4 w-4" /> Prev
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!hasNext}
              onClick={() => setPage(p => p + 1)}
            >
              Next <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
