'use client'

import { useEffect, useMemo, useState } from 'react'
import { Star } from 'lucide-react'
import { bookingsApi, clientsApi } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ProfilePageSkeleton } from '@/components/page-skeletons'
import { AvatarUpload } from '@/components/avatar-upload'
import { PhoneInput } from '@/components/phone-input'
import { formatCurrency } from '@/lib/utils'
import type { BookingRead } from '@/types'
import { toast } from 'sonner'

export default function ClientProfilePage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [bookings, setBookings] = useState<BookingRead[]>([])

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [defaultAddress, setDefaultAddress] = useState('')
  const [defaultCity, setDefaultCity] = useState('')
  const [defaultPostcode, setDefaultPostcode] = useState('')
  const [bio, setBio] = useState('')
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)

  useEffect(() => {
    ;(async () => {
      try {
        const [clientRes, bookingRes] = await Promise.all([clientsApi.me(), bookingsApi.my()])
        const client = clientRes.data as any
        const user = client?.user ?? {}
        const fullName = String(user?.name ?? '').trim()
        const parts = fullName.split(' ').filter(Boolean)

        setFirstName(parts[0] ?? '')
        setLastName(parts.slice(1).join(' '))
        setEmail(user?.email ?? '')
        setPhone(user?.phone ?? '')
        setDefaultAddress(client?.default_address ?? '')
        setDefaultCity(client?.default_city ?? '')
        setDefaultPostcode(client?.default_postcode ?? '')
        setBio('')
        setAvatarUrl(user?.avatar_url ?? null)

        setBookings(bookingRes.data?.items ?? [])
      } catch {
        toast.error('Failed to load profile.')
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const stats = useMemo(() => {
    const totalBookings = bookings.length
    const completed = bookings.filter((b) => b.status === 'completed')
    const totalSpent = completed.reduce((sum, b) => sum + Number(b.total_amount ?? 0), 0)
    return { totalBookings, totalSpent }
  }, [bookings])

  async function saveProfile() {
    if (!firstName.trim()) return toast.error('First name is required.')
    if (!lastName.trim()) return toast.error('Last name is required.')
    if (!phone.trim()) return toast.error('Phone number is required.')

    setSaving(true)
    try {
      await clientsApi.updateMe({
        name: `${firstName.trim()} ${lastName.trim()}`,
        phone,
        default_address: defaultAddress || null,
        default_city: defaultCity || null,
        default_postcode: defaultPostcode || null,
      })
      toast.success('Profile updated.')
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to save profile.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <ProfilePageSkeleton />

  return (
    <div className="space-y-5">
      <div>
        <h1 className="marketplace-title text-3xl text-slate-900">My Profile</h1>
        <p className="text-sm text-slate-500">Manage your account details and booking preferences.</p>
      </div>

      <Card className="border-slate-200">
        <CardContent className="p-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-4">
              <AvatarUpload
                currentUrl={avatarUrl}
                fallbackInitial={firstName[0] ?? 'C'}
                onUploaded={(url) => setAvatarUrl(url)}
              />
              <div>
                <p className="text-4xl font-bold text-slate-900">{`${firstName} ${lastName}`.trim() || 'Client'}</p>
                <p className="text-sm text-slate-500">{email || 'No email available'}</p>
                <div className="mt-2 flex items-center gap-1 text-amber-500">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} className={`h-4 w-4 ${i === 0 ? 'fill-current' : ''}`} />
                  ))}
                </div>
              </div>
            </div>

            <Button variant="outline" onClick={saveProfile} loading={saving}>
              Update Credentials
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-slate-200">
        <CardContent className="space-y-4 p-5">
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <Label>First Name</Label>
              <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label>Last Name</Label>
              <Input value={lastName} onChange={(e) => setLastName(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label>Phone Number</Label>
              <PhoneInput value={phone} onChange={setPhone} className="mt-1" />
            </div>
            <div>
              <Label>Default Address</Label>
              <Input value={defaultAddress} onChange={(e) => setDefaultAddress(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label>Default City</Label>
              <Input value={defaultCity} onChange={(e) => setDefaultCity(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label>Default Postcode</Label>
              <Input value={defaultPostcode} onChange={(e) => setDefaultPostcode(e.target.value)} className="mt-1" />
            </div>
          </div>

          <div>
            <Label>Notes For Future Bookings (optional)</Label>
            <Textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              className="mt-1"
              rows={4}
              placeholder="Saved locally in this browser for now."
            />
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
              <p className="text-slate-500">Total Bookings</p>
              <p className="text-xl font-semibold text-slate-900">{stats.totalBookings}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
              <p className="text-slate-500">Total Spent</p>
              <p className="text-xl font-semibold text-slate-900">{formatCurrency(stats.totalSpent)}</p>
            </div>
          </div>

          <div className="flex justify-end">
            <Button onClick={saveProfile} loading={saving}>Save & Publish</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
