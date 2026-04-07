import { NavBar } from '@/components/nav-bar'

const NAV = [
  { href: '/cleaner/dashboard', label: 'Jobs' },
  { href: '/cleaner/availability', label: 'Availability' },
  { href: '/cleaner/earnings', label: 'Earnings' },
]

export default function CleanerLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <NavBar links={NAV} />
      <main className="flex-1 px-6 py-8 max-w-5xl mx-auto w-full">{children}</main>
    </div>
  )
}
