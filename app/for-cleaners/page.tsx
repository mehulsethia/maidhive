import Link from 'next/link'
import Image from 'next/image'
import { LandingHeader } from '@/components/landing-header'
import { ScrollReveal, StaggerChildren } from '@/components/scroll-reveal'
import Footer from '@/components/footer'
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  CreditCard,
  Euro,
  FileCheck,
  Handshake,
  Shield,
  Star,
} from 'lucide-react'

export default function CleanerLandingPage() {
  return (
    <main className="min-h-screen flex flex-col">
      <LandingHeader />

      {/* Hero */}
      <section className="relative bg-gradient-to-br from-gray-950 via-gray-900 to-primary/30 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_80%,rgba(59,91,219,0.15),transparent_50%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(59,91,219,0.1),transparent_50%)]" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-20 lg:py-28">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="animate-fade-in">
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white tracking-tight leading-[1.1] mb-6">
                Become a MaidHive Cleaner
              </h1>
              <p className="text-lg text-gray-300 leading-relaxed mb-8 max-w-lg">
                Set your own hourly rate, choose when you work, and receive booking requests that fit your availability.
              </p>

              <Link
                href="/signup?role=cleaner"
                className="inline-flex items-center gap-2 bg-primary hover:bg-primary/90 text-white font-semibold px-8 py-3.5 rounded-lg text-base transition-all shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30"
              >
                Apply as a cleaner
                <ArrowRight className="h-4 w-4" />
              </Link>

              <div className="mt-10 flex flex-col gap-3">
                {[
                  'Flexible hours — choose when you work',
                  'Set your own hourly rate',
                  'No platform fees deducted from your earnings',
                  'Build your reputation with real client reviews',
                ].map((item) => (
                  <div key={item} className="flex items-center gap-3">
                    <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />
                    <span className="text-sm text-gray-300">{item}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative hidden lg:block animate-fade-in-right">
              <div className="rounded-2xl border border-white/15 bg-white/95 p-6 shadow-2xl">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Booking request</p>
                <div className="mt-5 rounded-xl border border-gray-200 bg-gray-50 p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="font-semibold text-gray-900">One-off cleaning</h3>
                      <p className="mt-1 text-sm text-gray-500">Saturday, 10:00 AM</p>
                    </div>
                    <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">New</span>
                  </div>
                  <div className="mt-5 grid grid-cols-3 gap-3 text-sm">
                    <div>
                      <p className="text-gray-500">Rate</p>
                      <p className="font-semibold text-gray-900">€10/hr</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Duration</p>
                      <p className="font-semibold text-gray-900">3 hours</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Earnings</p>
                      <p className="font-semibold text-gray-900">€30.00</p>
                    </div>
                  </div>
                  <button className="mt-6 w-full rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-white">
                    Accept request
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <ScrollReveal className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              How it works
            </h2>
          </ScrollReveal>

          <StaggerChildren className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8" stagger={120}>
            {[
              {
                step: '1',
                title: 'Apply and get approved',
                desc: 'Complete your cleaner application and submit the required onboarding information. MaidHive reviews your application before your profile can go live.',
              },
              {
                step: '2',
                title: 'Set your availability',
                desc: 'Choose the days and times you want to work and keep your availability updated whenever your schedule changes.',
              },
              {
                step: '3',
                title: 'Respond to booking requests',
                desc: 'Receive booking requests from clients and accept the ones that fit your availability.',
              },
              {
                step: '4',
                title: 'Complete jobs and get paid',
                desc: 'Complete your booking through MaidHive. Your payout is released after the 24-hour reporting window, provided there is no unresolved payment or dispute issue.',
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
          </StaggerChildren>
        </div>
      </section>

      {/* Clear earnings */}
      <section className="py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <ScrollReveal animation="fade-right">
              <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
                Clear earnings, no surprises
              </h2>
              <p className="text-gray-500 text-lg leading-relaxed mb-8">
                Set your own hourly rate and see exactly what you will earn from a booking before you accept it. MaidHive does not deduct a platform fee from your hourly earnings.
              </p>

              <div className="space-y-5">
                {[
                  {
                    icon: Euro,
                    title: 'Cleaner sets their hourly rate',
                    desc: 'Choose your hourly rate within MaidHive’s permitted range and update it as your profile develops.',
                  },
                  {
                    icon: FileCheck,
                    title: 'Know your earnings before accepting',
                    desc: 'Every booking request shows the duration and your expected earnings before you decide whether to accept it.',
                  },
                  {
                    icon: CreditCard,
                    title: 'No platform fee deducted from your earnings',
                    desc: 'Your cleaner earnings are based on the hourly rate you set and the booked duration. MaidHive’s platform fee is charged separately to the client.',
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
            </ScrollReveal>

            <ScrollReveal animation="fade-left" className="rounded-2xl border border-gray-100 bg-white p-8 shadow-xl">
              <p className="text-sm font-medium text-gray-500">Example: 3-hour clean</p>
              <div className="mt-6 space-y-4 rounded-xl border border-gray-200 p-5">
                <div className="flex items-center justify-between gap-4 text-sm">
                  <span className="text-gray-600">Cleaner hourly rate:</span>
                  <span className="font-semibold text-gray-900">€10/hour</span>
                </div>
                <div className="flex items-center justify-between gap-4 text-sm">
                  <span className="text-gray-600">Booking duration:</span>
                  <span className="font-semibold text-gray-900">3 hours</span>
                </div>
                <div className="border-t border-gray-200 pt-4 flex items-center justify-between gap-4">
                  <span className="font-semibold text-gray-900">Cleaner earnings:</span>
                  <span className="text-2xl font-bold text-primary">€30.00</span>
                </div>
              </div>
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* Why cleaners choose MaidHive */}
      <section className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <ScrollReveal className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              Why cleaners choose MaidHive
            </h2>
          </ScrollReveal>

          <StaggerChildren className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6" stagger={100}>
            {[
              {
                icon: CalendarDays,
                title: 'Flexible working',
                desc: 'Set your availability and choose which booking requests you want to accept.',
              },
              {
                icon: Euro,
                title: 'Clear earnings',
                desc: 'See the booking duration, your hourly rate and expected earnings before accepting a request.',
              },
              {
                icon: CreditCard,
                title: 'Platform-handled payments',
                desc: 'Client payments are managed through MaidHive, so you do not need to collect payment directly from the client.',
              },
              {
                icon: Shield,
                title: 'Clear cancellation rules',
                desc: 'Structured cancellation and no-show rules help protect both cleaners and clients when plans change.',
              },
              {
                icon: Handshake,
                title: 'Dispute support',
                desc: 'Bookings can be reported through MaidHive where a payment, no-show or service issue needs review.',
              },
              {
                icon: Star,
                title: 'Build your reputation',
                desc: 'Completed bookings and genuine client reviews help you build your profile and reputation on MaidHive.',
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
          </StaggerChildren>
        </div>
      </section>

      {/* Work on your terms */}
      <section className="py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <ScrollReveal className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              Work on your terms
            </h2>
            <p className="text-gray-500 text-lg">
              Choose when you’re available and decide which booking requests work for you.
            </p>
          </ScrollReveal>

          <div className="grid md:grid-cols-2 gap-8">
            <ScrollReveal animation="fade-right" className="bg-white rounded-2xl p-8 border border-gray-100 shadow-sm">
              <h3 className="font-semibold text-gray-900 text-lg mb-4">Choose when you work</h3>
              <p className="text-sm text-gray-500 leading-relaxed mb-6">
                Set your availability by day and time and update it whenever your schedule changes.
              </p>
              <ul className="space-y-3">
                {[
                  'No minimum hours required',
                  'Work the days and times that suit you',
                  'Block unavailable dates when needed',
                ].map((item) => (
                  <li key={item} className="flex items-center gap-3 text-sm text-gray-600">
                    <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </ScrollReveal>

            <ScrollReveal animation="fade-left" className="bg-white rounded-2xl p-8 border border-gray-100 shadow-sm">
              <h3 className="font-semibold text-gray-900 text-lg mb-4">Choose your bookings</h3>
              <p className="text-sm text-gray-500 leading-relaxed mb-6">
                Review each booking request before accepting it, including the booking time, duration and relevant job details.
              </p>
              <ul className="space-y-3">
                {[
                  'Accept only the requests that work for you',
                  'Build relationships with repeat clients',
                  'No requirement to accept every request',
                ].map((item) => (
                  <li key={item} className="flex items-center gap-3 text-sm text-gray-600">
                    <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-gradient-to-br from-gray-950 via-gray-900 to-primary/30 py-20">
        <ScrollReveal className="max-w-3xl mx-auto px-4 sm:px-6 text-center" animation="zoom-in">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            Ready to grow your cleaning business?
          </h2>
          <p className="text-gray-300 text-lg mb-4 max-w-xl mx-auto">
            Join MaidHive and build your cleaning business with flexible bookings, clear earnings and platform support.
          </p>

          <Link
            href="/signup?role=cleaner"
            className="inline-flex items-center gap-2 border-2 border-white/80 text-white hover:bg-white hover:text-gray-900 font-semibold px-8 py-3.5 rounded-full text-base transition-all mt-6"
          >
            Apply as a cleaner
            <ArrowRight className="h-4 w-4" />
          </Link>
        </ScrollReveal>
      </section>

      {/* Cross-sell to client */}
      <section className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <ScrollReveal animation="fade-right" className="relative rounded-2xl overflow-hidden aspect-[4/3] shadow-xl">
              <Image
                src="/images/Become%20a%20Cleaner.png"
                alt="Cleaner carrying out general cleaning inside a home"
                fill
                className="object-cover"
                sizes="(min-width: 1024px) 50vw, 100vw"
              />
            </ScrollReveal>

            <ScrollReveal animation="fade-left">
              <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
                Looking for a cleaner instead?
              </h2>
              <p className="text-gray-500 text-lg leading-relaxed mb-8">
                Book approved cleaners in Larnaca with clear hourly pricing and secure payments through MaidHive.
              </p>

              <div className="space-y-5 mb-10">
                {[
                  { title: 'Approved local cleaners', desc: 'Browse approved cleaner profiles and choose who you want to book.' },
                  { title: 'Clear hourly pricing', desc: 'See the cleaner’s hourly rate before you send a booking request.' },
                  { title: 'Secure payments', desc: 'Payments are handled securely through MaidHive.' },
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
            </ScrollReveal>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  )
}
