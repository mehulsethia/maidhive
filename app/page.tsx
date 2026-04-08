import Link from 'next/link'
import Footer from '@/components/footer'

export default function LandingPage() {
  return (
    <main className="min-h-screen flex flex-col">
      {/* Nav */}
      <nav
        className="px-6 py-4 flex items-center justify-between"
        style={{
          background: 'radial-gradient(ellipse at 30% 50%, #0088DD 19%, #044EE2 38%, #030016 100%)',
        }}
      >
        <span className="text-xl font-bold text-white">MaidHive</span>
        <div className="flex gap-4">
          <Link href="/login" className="text-sm text-white/80 hover:text-white transition-colors">
            Log in
          </Link>
          <Link
            href="/signup"
            className="text-sm bg-white text-[#044EE2] font-semibold px-4 py-2 rounded-md hover:bg-white/90 transition-colors"
          >
            Get started
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section
        className="px-6 py-28 text-center text-white flex-1"
        style={{
          background: 'radial-gradient(ellipse at 30% 50%, #0088DD 19%, #044EE2 38%, #030016 100%)',
        }}
      >
        <div className="max-w-3xl mx-auto">
          <h1 className="text-5xl font-bold tracking-tight mb-6 leading-tight">
            Book trusted cleaners,<br />on your schedule.
          </h1>
          <p className="text-xl text-white/75 mb-10 leading-relaxed">
            MaidHive connects you with verified, professional cleaners in your area.
            Transparent pricing, secure payments, guaranteed quality.
          </p>
          <div className="flex gap-4 justify-center flex-wrap">
            <Link
              href="/signup"
              className="bg-white text-[#044EE2] font-semibold px-8 py-3 rounded-md text-lg hover:bg-white/90 transition-colors"
            >
              Book a cleaner
            </Link>
            <Link
              href="/signup?role=cleaner"
              className="border border-white/40 text-white px-8 py-3 rounded-md text-lg hover:bg-white/10 transition-colors"
            >
              Become a cleaner
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="px-6 py-20 bg-white">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12 text-gray-900">Why MaidHive?</h2>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { title: 'Verified cleaners', body: 'Every cleaner is background-checked and personally approved by our team before they can take bookings.' },
              { title: 'Secure payments', body: 'Pay upfront safely. Funds are only released to your cleaner after your job is marked complete.' },
              { title: 'Flexible scheduling', body: 'Book same-day or plan weeks ahead. Reschedule or cancel with ease from your dashboard.' },
            ].map((f) => (
              <div key={f.title} className="p-8 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                <div
                  className="w-10 h-10 rounded-lg mb-4"
                  style={{ background: 'linear-gradient(135deg, #0088DD, #044EE2)' }}
                />
                <h3 className="font-semibold text-lg mb-2 text-gray-900">{f.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 py-20 bg-gray-50">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-4 text-gray-900">Ready to get started?</h2>
          <p className="text-gray-500 mb-8">Join hundreds of happy clients and professional cleaners on MaidHive.</p>
          <Link
            href="/signup"
            className="inline-block text-white font-semibold px-10 py-4 rounded-md text-lg transition-opacity hover:opacity-90"
            style={{ background: 'linear-gradient(135deg, #0088DD, #044EE2)' }}
          >
            Create your free account
          </Link>
        </div>
      </section>

      <Footer />
    </main>
  )
}
