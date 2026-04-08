import Link from 'next/link'
import Footer from '@/components/footer'

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Nav */}
      <nav
        className="px-6 py-4 flex items-center justify-between"
        style={{
          background: 'radial-gradient(ellipse at 30% 50%, #0088DD 19%, #044EE2 38%, #030016 100%)',
        }}
      >
        <Link href="/" className="text-xl font-bold text-white">MaidHive</Link>
        <div className="flex gap-4">
          <Link href="/login" className="text-sm text-white/80 hover:text-white transition-colors">Log in</Link>
          <Link
            href="/signup"
            className="text-sm bg-white text-[#044EE2] font-semibold px-4 py-2 rounded-md hover:bg-white/90 transition-colors"
          >
            Get started
          </Link>
        </div>
      </nav>

      <div className="flex-1">
        {children}
      </div>

      <Footer />
    </div>
  )
}
