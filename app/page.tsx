import Link from 'next/link'

export default function LandingPage() {
  return (
    <main className="min-h-screen">
      {/* Nav */}
      <nav className="border-b px-6 py-4 flex items-center justify-between">
        <span className="text-xl font-bold text-primary">MaidHive</span>
        <div className="flex gap-4">
          <Link href="/login" className="text-sm text-muted-foreground hover:text-foreground">
            Log in
          </Link>
          <Link
            href="/signup"
            className="text-sm bg-primary text-primary-foreground px-4 py-2 rounded-md hover:opacity-90"
          >
            Get started
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="px-6 py-24 text-center max-w-3xl mx-auto">
        <h1 className="text-5xl font-bold tracking-tight mb-6">
          Book trusted cleaners,<br />on your schedule.
        </h1>
        <p className="text-xl text-muted-foreground mb-10">
          MaidHive connects you with verified, professional cleaners in your area.
          Transparent pricing, secure payments, guaranteed quality.
        </p>
        <div className="flex gap-4 justify-center">
          <Link
            href="/signup"
            className="bg-primary text-primary-foreground px-8 py-3 rounded-md text-lg font-medium hover:opacity-90"
          >
            Book a cleaner
          </Link>
          <Link
            href="/signup?role=cleaner"
            className="border px-8 py-3 rounded-md text-lg font-medium hover:bg-muted"
          >
            Become a cleaner
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="px-6 py-16 bg-muted">
        <div className="max-w-5xl mx-auto grid md:grid-cols-3 gap-8">
          {[
            { title: 'Verified cleaners', body: 'Every cleaner is background-checked and approved by our team.' },
            { title: 'Secure payments', body: 'Pay upfront, funds released only after your job is complete.' },
            { title: 'Flexible scheduling', body: 'Book same-day or plan weeks ahead. Manage everything online.' },
          ].map((f) => (
            <div key={f.title} className="bg-background p-6 rounded-lg border">
              <h3 className="font-semibold text-lg mb-2">{f.title}</h3>
              <p className="text-muted-foreground text-sm">{f.body}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  )
}
