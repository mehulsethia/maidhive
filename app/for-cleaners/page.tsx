import Link from 'next/link'
import Image from 'next/image'
import { LandingHeader } from '@/components/landing-header'
import { ScrollReveal, StaggerChildren } from '@/components/scroll-reveal'
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
      <section className="relative bg-gradient-to-br from-gray-950 via-gray-900 to-primary/30 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_80%,rgba(59,91,219,0.15),transparent_50%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(59,91,219,0.1),transparent_50%)]" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-20 lg:py-28">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left */}
            <div className="animate-fade-in">
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white tracking-tight leading-[1.1] mb-6">
                Become a MaidHive Cleaner
              </h1>
              <p className="text-lg text-gray-300 leading-relaxed mb-8 max-w-lg">
                Set your hourly rate, accept bookings on your schedule, and get
                paid securely through the platform.
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
                  'Transparent platform fee — no hidden deductions',
                  'Secure payouts after completed jobs',
                  'Build your reputation with real reviews',
                ].map((item) => (
                  <div key={item} className="flex items-center gap-3">
                    <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />
                    <span className="text-sm text-gray-300">{item}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Right — Hero image */}
            <div className="relative hidden lg:block animate-fade-in-right">
              <div className="relative rounded-2xl overflow-hidden shadow-2xl aspect-[4/3]">
                <Image
                  src="/images/hero-cleaner.png"
                  alt="Professional cleaner hero preview"
                  fill
                  className="object-cover"
                  priority
                  sizes="(min-width: 1024px) 50vw, 100vw"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-gray-900/40 to-transparent" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── How it works ─── */}
      <section id="how-it-works" className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <ScrollReveal className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              How it works
            </h2>
            <p className="text-gray-500 text-lg">Get started in four simple steps</p>
          </ScrollReveal>

          <StaggerChildren className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8" stagger={120}>
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
          </StaggerChildren>
        </div>
      </section>

      {/* ─── Clear earnings ─── */}
      <section className="py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            {/* Left content */}
            <ScrollReveal animation="fade-right">
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
            </ScrollReveal>

            {/* Right — Earnings image */}
            <ScrollReveal animation="fade-left" className="relative rounded-2xl overflow-hidden shadow-xl border border-gray-100 aspect-[4/3]">
              <Image
                src="/images/Earnings-cleaner.png"
                alt="Cleaner earnings breakdown"
                fill
                className="object-cover"
                sizes="(min-width: 1024px) 50vw, 100vw"
              />
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* ─── Why cleaners choose MaidHive ─── */}
      <section className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <ScrollReveal className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              Why cleaners choose MaidHive
            </h2>
            <p className="text-gray-500 text-lg">
              A fair, structured platform built for independent professionals
            </p>
          </ScrollReveal>

          <StaggerChildren className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6" stagger={100}>
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
          </StaggerChildren>
        </div>
      </section>

      {/* ─── Work on your terms ─── */}
      <section className="py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <ScrollReveal className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              Work on your terms
            </h2>
            <p className="text-gray-500 text-lg">
              MaidHive gives you control over your schedule and the jobs you accept.
              Build your business, your way.
            </p>
          </ScrollReveal>

          <div className="grid md:grid-cols-2 gap-8">
            <ScrollReveal animation="fade-right" className="bg-white rounded-2xl p-8 border border-gray-100 shadow-sm">
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
            </ScrollReveal>

            <ScrollReveal animation="fade-left" className="bg-white rounded-2xl p-8 border border-gray-100 shadow-sm">
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
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* ─── CTA Banner ─── */}
      <section className="bg-gradient-to-br from-gray-950 via-gray-900 to-primary/30 py-20">
        <ScrollReveal className="max-w-3xl mx-auto px-4 sm:px-6 text-center" animation="zoom-in">
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
        </ScrollReveal>
      </section>

      {/* ─── Cross-sell to client ─── */}
      <section className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            {/* Image */}
            <ScrollReveal animation="fade-right" className="relative rounded-2xl overflow-hidden aspect-[4/3] shadow-xl">
              <Image
                src="/images/trusted-cleaner.avif"
                alt="Clean modern home"
                fill
                className="object-cover"
                sizes="(min-width: 1024px) 50vw, 100vw"
              />
            </ScrollReveal>

            {/* Content */}
            <ScrollReveal animation="fade-left">
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
            </ScrollReveal>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  )
}
