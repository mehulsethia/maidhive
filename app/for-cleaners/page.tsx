import Link from 'next/link'
import Image from 'next/image'
import { LandingHeader } from '@/components/landing-header'
import Footer from '@/components/footer'
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  CreditCard,
  DollarSign,
  FileCheck,
  Handshake,
  HeartHandshake,
  Repeat,
  Shield,
  ShieldCheck,
  Star,
  UserCheck,
  Users,
} from 'lucide-react'

export default function CleanerLandingPage() {
  return (
    <main className="min-h-screen flex flex-col">
      <LandingHeader />

      {/* ─── Hero ─── */}
      <section className="relative bg-gradient-to-br from-primary/95 via-primary to-primary/80 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_30%,rgba(255,255,255,0.08),transparent_50%)]" />

        <div className="relative max-w-7xl mx-auto px-6 py-20 lg:py-28">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left */}
            <div className="animate-fade-in">
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white tracking-tight leading-[1.1] mb-6">
                Become a MaidHive Cleaner
              </h1>
              <p className="text-lg text-white/80 leading-relaxed mb-8 max-w-lg">
                Set your hourly rate, accept bookings on your schedule, and get
                paid securely through the platform.
              </p>

              <Link
                href="/signup?role=cleaner"
                className="inline-flex items-center gap-2 bg-white hover:bg-gray-50 text-primary font-semibold px-8 py-3.5 rounded-lg text-base transition-all shadow-lg"
              >
                Apply as a cleaner
                <ArrowRight className="h-4 w-4" />
              </Link>

              <div className="mt-10 flex flex-col gap-3">
                {[
                  'Flexible hours — choose when you work',
                  'Transparent platform fee — no hidden deductions',
                  'Secure payouts after completed jobs',
                  'Build your reputation with real reviews',
                ].map((item) => (
                  <div key={item} className="flex items-center gap-3">
                    <CheckCircle2 className="h-5 w-5 text-white/90 shrink-0" />
                    <span className="text-sm text-white/80">{item}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Right — Earnings card mockup */}
            <div className="hidden lg:block animate-fade-in-right">
              <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm ml-auto">
                <div className="flex items-center justify-between mb-6">
                  <span className="text-sm text-gray-500">This week&apos;s earnings</span>
                  <span className="text-3xl font-bold text-gray-900">&euro; 642.50</span>
                </div>
                <div className="space-y-3">
                  <div className="bg-primary/5 rounded-xl p-4 border border-primary/10">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-sm text-gray-900">Deep Clean</span>
                      <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">New</span>
                    </div>
                    <p className="text-xs text-gray-500">Tomorrow, 10:00 AM</p>
                    <p className="text-xs text-gray-400 mt-1">3 hrs &middot; 2 rooms &middot; 1 bathroom</p>
                    <div className="mt-3">
                      <div className="w-full bg-primary text-white text-xs font-medium text-center py-2 rounded-lg">
                        Accept Booking
                      </div>
                    </div>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-sm text-gray-900">Regular Clean</span>
                      <span className="text-xs bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-full font-medium">Confirmed</span>
                    </div>
                    <p className="text-xs text-gray-500">Friday, 2:00 PM</p>
                    <p className="text-xs text-gray-400 mt-1">2 hrs &middot; 3 rooms &middot; 1 bathroom</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── How it works ─── */}
      <section id="how-it-works" className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              How it works
            </h2>
            <p className="text-gray-500 text-lg">Get started in four simple steps</p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              {
                step: '1',
                title: 'Apply and get approved',
                desc: 'Submit your application with basic details and references. We review within 48 hours.',
              },
              {
                step: '2',
                title: 'Set your availability',
                desc: 'Choose when and where you want to work. Update your schedule anytime.',
              },
              {
                step: '3',
                title: 'Accept bookings near you',
                desc: 'Browse available jobs in your area. Accept the ones that fit your schedule.',
              },
              {
                step: '4',
                title: 'Get paid after each job',
                desc: 'Earnings are automatically transferred to your account within 48 hours.',
              },
            ].map((item) => (
              <div key={item.step} className="text-center group">
                <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-5 group-hover:bg-primary/10 transition-colors">
                  <span className="text-xl font-bold text-gray-900 group-hover:text-primary transition-colors">{item.step}</span>
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">{item.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Clear earnings ─── */}
      <section className="py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            {/* Left content */}
            <div>
              <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
                Clear earnings, no surprises
              </h2>
              <p className="text-gray-500 text-lg leading-relaxed mb-8">
                MaidHive is built on transparency. You see exactly what you&apos;ll
                earn before accepting any job, and we never take hidden fees.
              </p>

              <div className="space-y-5">
                {[
                  {
                    icon: DollarSign,
                    title: 'Cleaner sets hourly rate',
                    desc: 'You control your rate within market ranges. Build your reputation and increase rates over time.',
                  },
                  {
                    icon: CreditCard,
                    title: 'Client pays hourly rate + hours',
                    desc: 'Earnings are transferred to your bank account 48 hours after completing a job. No waiting weeks for payment.',
                  },
                  {
                    icon: FileCheck,
                    title: 'MaidHive keeps 10%',
                    desc: 'Our fee covers payment processing, customer verification, insurance, and platform support. No hidden charges.',
                  },
                ].map((item) => (
                  <div key={item.title} className="flex items-start gap-4">
                    <div className="shrink-0 w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <item.icon className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 text-sm mb-1">{item.title}</h3>
                      <p className="text-sm text-gray-500 leading-relaxed">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right — Pricing card */}
            <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8">
              <div className="flex items-center justify-between mb-6">
                <span className="text-sm text-gray-500">Example: 3-hour deep clean</span>
              </div>
              <div className="text-center mb-8">
                <span className="text-5xl font-bold text-gray-900">&euro;67.50</span>
                <p className="text-sm text-gray-400 mt-2">Your earnings after platform fee</p>
              </div>

              <div className="space-y-4 border-t border-gray-100 pt-6">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Job total (&euro;25/hr &times; 3 hours)</span>
                  <span className="font-medium text-gray-900">&euro;75.00</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Platform fee (10%)</span>
                  <span className="font-medium text-red-500">-&euro;7.50</span>
                </div>
                <div className="border-t border-gray-100 pt-4 flex justify-between">
                  <span className="font-semibold text-gray-900">You receive</span>
                  <span className="text-2xl font-bold text-primary">&euro;67.50</span>
                </div>
              </div>

              <div className="mt-6 bg-gray-50 rounded-xl p-4 text-center">
                <p className="text-xs text-gray-500">Paid to your account within 48 hours</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Why cleaners choose MaidHive ─── */}
      <section className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              Why cleaners choose MaidHive
            </h2>
            <p className="text-gray-500 text-lg">
              A fair, structured platform built for independent professionals
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                icon: ShieldCheck,
                title: 'Verified customers only',
                desc: 'All customers are identity-verified and reviewed before they can book.',
              },
              {
                icon: FileCheck,
                title: 'Clear cancellation rules',
                desc: 'Structured policies protect your time. Customers pay cancellation fees.',
              },
              {
                icon: CreditCard,
                title: 'Platform-handled payments',
                desc: 'Never chase clients for money. All payments are managed through the platform.',
              },
              {
                icon: Handshake,
                title: 'Dispute support',
                desc: 'Dedicated support for every job that needs resolution. Fair for all parties.',
              },
              {
                icon: Shield,
                title: 'Insurance coverage',
                desc: 'Liability insurance included for all jobs booked through MaidHive.',
              },
              {
                icon: Repeat,
                title: 'Build repeat clients',
                desc: 'Great work leads to recurring bookings with the same customers.',
              },
            ].map((f) => (
              <div
                key={f.title}
                className="bg-gray-50 rounded-2xl p-7 border border-gray-100 hover:shadow-lg hover:border-gray-200 transition-all duration-300 group"
              >
                <div className="w-11 h-11 rounded-xl bg-gray-200/80 flex items-center justify-center mb-4 group-hover:bg-primary/10 transition-colors">
                  <f.icon className="h-5 w-5 text-gray-600 group-hover:text-primary transition-colors" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-2 text-sm">{f.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Work on your terms ─── */}
      <section className="py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              Work on your terms
            </h2>
            <p className="text-gray-500 text-lg">
              MaidHive gives you control over your schedule and the jobs you accept.
              Build your business, your way.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            <div className="bg-white rounded-2xl p-8 border border-gray-100 shadow-sm">
              <h3 className="font-semibold text-gray-900 text-lg mb-4">Choose when you work</h3>
              <p className="text-sm text-gray-500 leading-relaxed mb-6">
                Set your availability by day and time. Update it as often as you
                need. You&apos;re only offered jobs that match your schedule.
              </p>
              <ul className="space-y-3">
                {[
                  'No minimum hours required',
                  'Work weekends only, or build a full schedule',
                  'Block out holidays and time off instantly',
                ].map((item) => (
                  <li key={item} className="flex items-center gap-3 text-sm text-gray-600">
                    <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-white rounded-2xl p-8 border border-gray-100 shadow-sm">
              <h3 className="font-semibold text-gray-900 text-lg mb-4">Select your jobs</h3>
              <p className="text-sm text-gray-500 leading-relaxed mb-6">
                Review each booking before accepting. See the location,
                duration, rate, and customer rating before you commit.
              </p>
              <ul className="space-y-3">
                {[
                  'Accept only jobs in your preferred area',
                  'Build relationships with repeat customers',
                  'No pressure to accept every request',
                ].map((item) => (
                  <li key={item} className="flex items-center gap-3 text-sm text-gray-600">
                    <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ─── CTA Banner ─── */}
      <section className="bg-gradient-to-br from-gray-950 via-gray-900 to-primary/30 py-20">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            Ready to grow your cleaning business?
          </h2>
          <p className="text-gray-300 text-lg mb-4 max-w-xl mx-auto">
            Join hundreds of professional cleaners who trust MaidHive
            for reliable bookings, fair pay, and platform support.
          </p>

          <Link
            href="/signup?role=cleaner"
            className="inline-flex items-center gap-2 border-2 border-white/80 text-white hover:bg-white hover:text-gray-900 font-semibold px-8 py-3.5 rounded-full text-base transition-all mt-6"
          >
            Apply as a cleaner
            <ArrowRight className="h-4 w-4" />
          </Link>

          <p className="text-xs text-gray-400 mt-4">
            Applications are reviewed within 48 hours to maintain quality and trust
          </p>
        </div>
      </section>

      {/* ─── Cross-sell to client ─── */}
      <section className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            {/* Image */}
            <div className="relative rounded-2xl overflow-hidden aspect-[4/3] shadow-xl">
              <Image
                src="/images/hero-client.jpg"
                alt="Clean modern home"
                fill
                className="object-cover"
                sizes="(min-width: 1024px) 50vw, 100vw"
              />
            </div>

            {/* Content */}
            <div>
              <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
                Need a trusted cleaner for your home?
              </h2>
              <p className="text-gray-500 text-lg leading-relaxed mb-8">
                MaidHive helps homeowners and renters book verified
                cleaners with clear pricing and secure payments.
              </p>

              <div className="space-y-5 mb-10">
                {[
                  { title: 'Verified local cleaners', desc: 'Connect with trusted clients nearby.' },
                  { title: 'Transparent pricing', desc: 'See your earnings upfront.' },
                  { title: 'Secure payment after completion', desc: 'Guaranteed payment, every time.' },
                ].map((item) => (
                  <div key={item.title} className="flex items-start gap-3">
                    <CheckCircle2 className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                    <div>
                      <h4 className="font-semibold text-gray-900 text-sm">{item.title}</h4>
                      <p className="text-sm text-gray-500">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              <Link
                href="/signup"
                className="inline-flex items-center gap-2 bg-gray-900 hover:bg-gray-800 text-white font-semibold px-7 py-3 rounded-lg transition-all text-sm"
              >
                Find a cleaner
              </Link>
              <p className="text-xs text-gray-400 mt-4">
                Book with confidence. Platform-managed from start to finish.
              </p>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  )
}
