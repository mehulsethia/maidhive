'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useEffect, useState } from 'react'
import { LandingHeader } from '@/components/landing-header'
import { CookieConsentBanner } from '@/components/cookie-consent-banner'
import { ScrollReveal, StaggerChildren } from '@/components/scroll-reveal'
import Footer from '@/components/footer'
import {
  Shield,
  CreditCard,
  DollarSign,
  UserCheck,
  ClipboardCheck,
  Star,
  Clock,
  Sparkles,
  Home,
  Building,
  CheckCircle2,
  ArrowRight,
  ChevronRight,
} from 'lucide-react'

const HOW_IT_WORKS_STEPS = [
  {
    step: '01',
    title: 'Approved cleaners',
    desc: 'Browse approved cleaner profiles with real reviews and transparent pricing.',
    icon: UserCheck,
    image: '/images/Property%201=Variant.jpg',
  },
  {
    step: '02',
    title: 'Pick a time that works',
    desc: 'Select from available slots that fit your schedule.',
    icon: Clock,
    image: '/images/Property%202=Time.jpg',
  },
  {
    step: '03',
    title: 'Get your home cleaned',
    desc: 'Your cleaner completes the booked cleaning service at your property.',
    icon: Sparkles,
    image: '/images/Property%203=Cleaning.jpg',
  },
  {
    step: '04',
    title: 'Pay securely after completion',
    desc: 'Your payment is authorised before the booking and only charged after the cleaning is completed.',
    icon: CreditCard,
    image: '/images/Property%204=Giving%20money.jpg',
  },
]

export default function ClientLandingPage() {
  const [activeHowStepIndex, setActiveHowStepIndex] = useState(0)

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setActiveHowStepIndex((prev) => (prev + 1) % HOW_IT_WORKS_STEPS.length)
    }, 3000)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [])

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
                A better way to book a cleaner
              </h1>
              <p className="text-lg text-gray-300 leading-relaxed mb-8 max-w-lg">
                Book approved cleaners in Larnaca with clear hourly pricing and secure payments &mdash; all managed through MaidHive.
              </p>

              <Link
                href="/signup"
                className="inline-flex items-center gap-2 bg-primary hover:bg-primary/90 text-white font-semibold px-8 py-3.5 rounded-lg text-base transition-all shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30"
              >
                Find a cleaner
                <ArrowRight className="h-4 w-4" />
              </Link>

              <div className="mt-10 flex flex-col gap-3">
                {[
                  'Approved cleaners',
                  'Clear pricing, no hidden fees',
                  'Secure payment after completion',
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
                  src="/images/hero-client.gif"
                  alt="Professional cleaner at work"
                  fill
                  className="object-cover"
                  unoptimized
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
      <section id="how-it-works" className="py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <ScrollReveal className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              See how MaidHive works
            </h2>
            <p className="text-gray-500 text-lg">
              A seamless platform that handles everything
            </p>
          </ScrollReveal>

          <div className="grid lg:grid-cols-2 gap-16 items-center">
            {/* Left — Auto-rotating step image */}
            <ScrollReveal animation="fade-right" className="relative flex items-center justify-center">
              <div className="relative w-full max-w-md">
                <div className="relative bg-white rounded-2xl shadow-xl border border-gray-100 p-4">
                  <div className="relative rounded-xl overflow-hidden aspect-[4/3]">
                    <Image
                      src={HOW_IT_WORKS_STEPS[activeHowStepIndex].image}
                      alt={HOW_IT_WORKS_STEPS[activeHowStepIndex].title}
                      fill
                      className="object-cover"
                      sizes="(min-width: 1024px) 420px, 100vw"
                    />
                  </div>
                  <div className="mt-4 flex items-center justify-center gap-2">
                    {HOW_IT_WORKS_STEPS.map((step, index) => (
                      <span
                        key={step.step}
                        className={`h-2 rounded-full transition-all ${
                          index === activeHowStepIndex ? 'w-8 bg-primary' : 'w-2 bg-gray-300'
                        }`}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </ScrollReveal>

            {/* Right — Steps */}
            <StaggerChildren className="space-y-8" stagger={120} animation="fade-left">
              {HOW_IT_WORKS_STEPS.map((item, index) => (
                <div key={item.step} className="flex gap-5 group">
                  <div className={`shrink-0 w-12 h-12 rounded-xl flex items-center justify-center transition-colors ${
                    index === activeHowStepIndex ? 'bg-primary/20' : 'bg-primary/10 group-hover:bg-primary/20'
                  }`}>
                    <item.icon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className="font-semibold text-gray-900">{item.title}</h3>
                      <span className="text-xs font-mono text-gray-400">{item.step}</span>
                    </div>
                    <p className="text-sm text-gray-500 leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              ))}
            </StaggerChildren>
          </div>
        </div>
      </section>

      {/* ─── Why MaidHive ─── */}
      <section className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <ScrollReveal className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              Why MaidHive
            </h2>
            <p className="text-gray-500 text-lg">
              Approved cleaners, transparent pricing, and platform-managed payments.
            </p>
          </ScrollReveal>

          {/* Top row — 3 cards */}
          <StaggerChildren className="grid md:grid-cols-3 gap-6 mb-6" stagger={100}>
            {[
              {
                icon: UserCheck,
                title: 'Choose an approved cleaner',
                desc: 'Browse approved cleaner profiles with real reviews and transparent hourly rates. Cleaners submit identification as part of onboarding and must be approved before their profile becomes visible to clients.',
                color: 'bg-primary/10 text-primary',
              },
              {
                icon: Shield,
                title: 'Secure platform payments',
                desc: 'Payment is authorised before the booking and only charged after the cleaning is completed.',
                color: 'bg-emerald-50 text-emerald-600',
              },
              {
                icon: DollarSign,
                title: 'Clear pricing',
                desc: 'See the cleaner’s hourly rate and your booking total before you confirm your booking.',
                color: 'bg-amber-50 text-amber-600',
              },
            ].map((f) => (
              <div
                key={f.title}
                className="bg-gray-50 rounded-2xl p-8 hover:shadow-lg transition-all duration-300 border border-gray-100 hover:border-gray-200 group"
              >
                <div className={`w-12 h-12 rounded-xl ${f.color} flex items-center justify-center mb-5 group-hover:scale-110 transition-transform`}>
                  <f.icon className="h-6 w-6" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">{f.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </StaggerChildren>

          {/* Bottom row — 3 cards */}
          <StaggerChildren className="grid md:grid-cols-3 gap-6" stagger={100}>
            {[
              {
                icon: ClipboardCheck,
                title: 'Clear cancellation policies',
                desc: 'Cancellation rules are shown clearly so you know what applies before your booking is confirmed.',
                color: 'bg-blue-50 text-blue-600',
              },
              {
                icon: Shield,
                title: 'Structured dispute handling',
                desc: 'If an issue is reported, MaidHive can review the booking information and available evidence before determining the appropriate outcome.',
                color: 'bg-violet-50 text-violet-600',
              },
              {
                icon: Star,
                title: 'Reviews from completed bookings',
                desc: 'Reviews can only be submitted following completed MaidHive bookings.',
                color: 'bg-rose-50 text-rose-600',
              },
            ].map((f) => (
              <div
                key={f.title}
                className="bg-gray-50 rounded-2xl p-8 hover:shadow-lg transition-all duration-300 border border-gray-100 hover:border-gray-200 group"
              >
                <div className={`w-12 h-12 rounded-xl ${f.color} flex items-center justify-center mb-5 group-hover:scale-110 transition-transform`}>
                  <f.icon className="h-6 w-6" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">{f.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </StaggerChildren>
        </div>
      </section>

      {/* ─── What you can book ─── */}
      <section id="services" className="py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <ScrollReveal className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              What you can book on MaidHive
            </h2>
            <p className="text-gray-500 text-lg">
              All services are booked hourly — choose the number of hours based on your needs.
            </p>
          </ScrollReveal>

          <StaggerChildren className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6" stagger={120}>
            {[
              {
                icon: Home,
                title: 'Regular home cleaning',
                desc: 'Everyday home cleaning for routine cleaning tasks and general upkeep.',
              },
              {
                icon: Sparkles,
                title: 'One-off cleaning',
                desc: 'A thorough clean whenever you need it. Ideal for special occasions, guests arriving or a seasonal refresh.',
              },
              {
                icon: ClipboardCheck,
                title: 'Deep cleaning',
                desc: 'A more intensive clean for homes that need extra attention, including detailed cleaning across key areas of the property.',
              },
              {
                icon: Building,
                title: 'End-of-tenancy cleaning',
                desc: 'A thorough clean for a rental property at the end of a tenancy, covering the key areas that need attention before moving out.',
              },
            ].map((s) => (
              <div
                key={s.title}
                className="bg-white rounded-2xl p-7 border border-gray-100 hover:shadow-lg hover:border-gray-200 transition-all duration-300 group"
              >
                <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center mb-5 group-hover:bg-primary/10 transition-colors">
                  <s.icon className="h-6 w-6 text-gray-600 group-hover:text-primary transition-colors" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">{s.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </StaggerChildren>
        </div>
      </section>

      {/* ─── CTA Banner ─── */}
      <section className="bg-gradient-to-br from-gray-950 via-gray-900 to-primary/30 py-20">
        <ScrollReveal className="max-w-3xl mx-auto px-4 sm:px-6 text-center" animation="zoom-in">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            Ready to book with confidence?
          </h2>
          <Link
            href="/signup"
            className="inline-flex items-center gap-2 bg-white hover:bg-gray-100 text-gray-900 font-semibold px-8 py-3.5 rounded-lg text-base transition-all shadow-lg mt-6"
          >
            Find a cleaner
            <ArrowRight className="h-4 w-4" />
          </Link>
        </ScrollReveal>
      </section>

      {/* ─── Become a cleaner cross-sell ─── */}
      <section className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            {/* Image */}
            <ScrollReveal animation="fade-right" className="relative rounded-2xl overflow-hidden aspect-[4/3] shadow-xl">
              <Image
                src="/images/Become%20a%20Cleaner.png"
                alt="Professional cleaner with cleaning supplies"
                fill
                className="object-cover"
                sizes="(min-width: 1024px) 50vw, 100vw"
              />
            </ScrollReveal>

            {/* Content */}
            <ScrollReveal animation="fade-left">
              <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
                Become a cleaner
              </h2>
              <p className="text-gray-500 text-lg leading-relaxed mb-8">
                Join MaidHive and work with flexible hours, clear earnings and platform-managed payments. Set your own hourly rate and choose the booking requests that work for you.
              </p>

              <div className="space-y-5 mb-10">
                {[
                  { title: 'Choose when you work', desc: 'Set your availability and choose which booking requests you accept.' },
                  { title: 'Set your own hourly rate', desc: 'Choose your rate within MaidHive’s allowed range and receive payouts securely through the platform.' },
                  { title: 'Build your reputation', desc: 'Complete bookings and build your profile through genuine client reviews.' },
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
                href="/for-cleaners"
                className="inline-flex items-center gap-2 bg-primary hover:bg-primary/90 text-white font-semibold px-7 py-3 rounded-lg transition-all shadow-sm hover:shadow-md text-sm"
              >
                Join MaidHive as a cleaner
                <ChevronRight className="h-4 w-4" />
              </Link>
              <p className="text-xs text-gray-400 mt-4">
                Set your availability, accept bookings, and get paid securely through the platform.
              </p>
            </ScrollReveal>
          </div>
        </div>
      </section>

      <Footer />
      <CookieConsentBanner />
    </main>
  )
}
