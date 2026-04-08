import Link from 'next/link'

export default function Footer() {
  return (
    <footer
      className="text-white"
      style={{
        background: 'radial-gradient(ellipse at 30% 50%, #0088DD 19%, #044EE2 38%, #030016 100%)',
      }}
    >
      <div className="max-w-6xl mx-auto px-6 py-16">
        <div className="grid md:grid-cols-3 gap-12 mb-12">
          {/* Brand */}
          <div>
            <span className="text-2xl font-bold tracking-tight">MaidHive</span>
            <p className="mt-3 text-sm text-white/70 leading-relaxed">
              Connecting you with verified, professional cleaners. Transparent pricing, secure payments, guaranteed quality.
            </p>
          </div>

          {/* Platform */}
          <div>
            <h4 className="text-sm font-semibold uppercase tracking-widest text-white/50 mb-4">Platform</h4>
            <ul className="space-y-3 text-sm">
              <li><Link href="/signup" className="text-white/80 hover:text-white transition-colors">Book a cleaner</Link></li>
              <li><Link href="/signup?role=cleaner" className="text-white/80 hover:text-white transition-colors">Become a cleaner</Link></li>
              <li><Link href="/login" className="text-white/80 hover:text-white transition-colors">Sign in</Link></li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="text-sm font-semibold uppercase tracking-widest text-white/50 mb-4">Legal</h4>
            <ul className="space-y-3 text-sm">
              <li><Link href="/terms-and-conditions" className="text-white/80 hover:text-white transition-colors">Terms &amp; Conditions</Link></li>
              <li><Link href="/privacy-policy" className="text-white/80 hover:text-white transition-colors">Privacy Policy</Link></li>
              <li><Link href="/responsible-disclosure-policy" className="text-white/80 hover:text-white transition-colors">Responsible Disclosure</Link></li>
            </ul>
          </div>
        </div>

        <div className="border-t border-white/10 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-white/40">
          <span>&copy; {new Date().getFullYear()} MaidHive. All rights reserved.</span>
          <div className="flex gap-6">
            <Link href="/privacy-policy" className="hover:text-white/70 transition-colors">Privacy</Link>
            <Link href="/terms-and-conditions" className="hover:text-white/70 transition-colors">Terms</Link>
            <Link href="/responsible-disclosure-policy" className="hover:text-white/70 transition-colors">Disclosure</Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
