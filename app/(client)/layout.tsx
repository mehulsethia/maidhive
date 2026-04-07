import { NavBar } from '@/components/nav-bar'

const NAV = [
  { href: '/client/dashboard', label: 'My bookings' },
  { href: '/client/search', label: 'Find a cleaner' },
]

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <NavBar links={NAV} />
      <main className="flex-1 px-6 py-8 max-w-5xl mx-auto w-full">{children}</main>
    </div>
  )
}
