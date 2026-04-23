import Link from 'next/link'

export default function Footer() {
  return (
    <footer className="bg-gray-950 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-16">
        <div className="grid md:grid-cols-4 gap-10 mb-14">
          {/* Brand */}
          <div className="md:col-span-1">
            <Link href="/" className="flex items-center gap-2.5 mb-4">
              <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
                <span className="text-white font-bold text-xs">M</span>
              </div>
              <span className="text-lg font-bold">MaidHive</span>
            </Link>
            <p className="text-sm text-gray-400 leading-relaxed">
              Connecting trusted cleaners with homeowners through a secure, transparent platform.
            </p>
          </div>

          {/* For customers */}
          <div>
            <h4 className="text-sm font-semibold text-gray-300 mb-4">For customers</h4>
            <ul className="space-y-3 text-sm">
              <li>
                <Link href="/#how-it-works" className="text-gray-400 hover:text-white transition-colors">
                  How it works
                </Link>
              </li>
              <li>
                <Link href="/#services" className="text-gray-400 hover:text-white transition-colors">
                  Services
                </Link>
              </li>
              <li>
                <Link href="/#faq" className="text-gray-400 hover:text-white transition-colors">
                  FAQs
                </Link>
              </li>
            </ul>
          </div>

          {/* For cleaners */}
          <div>
            <h4 className="text-sm font-semibold text-gray-300 mb-4">For cleaners</h4>
            <ul className="space-y-3 text-sm">
              <li>
                <Link href="/for-cleaners" className="text-gray-400 hover:text-white transition-colors">
                  Become a cleaner
                </Link>
              </li>
              <li>
                <Link href="/for-cleaners#how-it-works" className="text-gray-400 hover:text-white transition-colors">
                  Cleaner resources
                </Link>
              </li>
              <li>
                <Link href="/for-cleaners#faq" className="text-gray-400 hover:text-white transition-colors">
                  FAQs
                </Link>
              </li>
            </ul>
          </div>

          {/* Support */}
          <div>
            <h4 className="text-sm font-semibold text-gray-300 mb-4">Support</h4>
            <ul className="space-y-3 text-sm">
              <li>
                <Link href="/terms-and-conditions" className="text-gray-400 hover:text-white transition-colors">
                  Terms of service
                </Link>
              </li>
              <li>
                <Link href="/privacy-policy" className="text-gray-400 hover:text-white transition-colors">
                  Privacy policy
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-gray-800 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-gray-500">
          <span>&copy; {new Date().getFullYear()} MaidHive. All rights reserved.</span>
          <Link href="/responsible-disclosure-policy" className="hover:text-gray-300 transition-colors">
            Responsible Disclosure Policy
          </Link>
        </div>
      </div>
    </footer>
  )
}
