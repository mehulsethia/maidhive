import { LandingHeader } from '@/components/landing-header'
import Footer from '@/components/footer'

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <LandingHeader />
      <div className="flex-1">{children}</div>
      <Footer />
    </div>
  )
}
