import type { Metadata } from 'next'

export const dynamic = 'force-static'
export const revalidate = false

export const metadata: Metadata = {
  title: 'Responsible Disclosure Policy — MaidHive',
  description: 'MaidHive\u2019s policy for responsible security vulnerability disclosure.',
}

export default function DisclosurePage() {
  return (
    <>
      {/* Header */}
      <div className="bg-gray-950 px-6 py-20 text-center">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-4xl sm:text-5xl font-bold text-white mb-4">Responsible Disclosure Policy</h1>
          <p className="text-gray-400 text-sm">
            Effective Date: 8 April 2026 &middot; Last Updated: 8 April 2026
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="bg-white px-6 py-16">
        <div className="max-w-3xl mx-auto">

          {/* Preamble */}
          <div className="mb-12 text-gray-600 leading-relaxed space-y-4 text-[15px]">
            <p>
              At MaidHive, we take the security of our platform and user data seriously.
            </p>
            <p>
              We welcome responsible security research and encourage individuals to report potential vulnerabilities in a manner that protects our users and the integrity of the platform.
            </p>
            <p>
              This Responsible Disclosure Policy outlines how vulnerabilities should be reported and how MaidHive will respond to such reports.
            </p>
          </div>

          {/* ─── Section 1 ─── */}
          <Section number="1" title="Scope">
            <p>This policy applies to vulnerabilities affecting the following systems operated by MaidHive:</p>
            <BulletList items={[
              'The MaidHive website and web application',
              'User authentication and account access',
              'Booking workflows and booking state management',
              'Messaging systems',
              'Payment-related flows (including Stripe integrations)',
              'APIs and backend services operated by MaidHive',
            ]} />
            <p>The following are out of scope:</p>
            <BulletList items={[
              'Third-party services not controlled by MaidHive (e.g. Stripe, hosting providers)',
              'Issues requiring access to third-party infrastructure',
            ]} />
            <p>Vulnerabilities affecting third-party services should be reported directly to the relevant provider.</p>
          </Section>

          {/* ─── Section 2 ─── */}
          <Section number="2" title="How to Report a Vulnerability">
            <p>If you discover a potential vulnerability, please report it to:</p>
            <div className="bg-gray-50 rounded-xl p-5 my-4">
              <a href="mailto:security@maidhive.app" className="text-primary font-semibold hover:underline">security@maidhive.app</a>
            </div>
            <p>Please include:</p>
            <BulletList items={[
              'A clear description of the vulnerability',
              'Steps required to reproduce the issue',
              'Any supporting evidence (screenshots, logs, or proof-of-concept)',
              'The potential impact of the vulnerability',
            ]} />
            <p>Providing detailed information will help us investigate and resolve the issue more efficiently.</p>
          </Section>

          {/* ─── Section 3 ─── */}
          <Section number="3" title="Responsible Testing Guidelines">
            <p>When conducting security research, you agree to:</p>
            <BulletList items={[
              'Act in good faith and avoid exploiting vulnerabilities beyond what is necessary to demonstrate the issue',
              'Avoid accessing, modifying, or deleting data that does not belong to you',
              'Avoid actions that could negatively impact platform availability (e.g. denial-of-service attacks)',
              'Not attempt social engineering, phishing, or physical security testing',
              'Not publicly disclose the vulnerability until MaidHive has had a reasonable opportunity to investigate and resolve the issue',
            ]} />
            <p>If your testing involves exposure to personal data, you must stop testing immediately and report the issue.</p>
          </Section>

          {/* ─── Section 4 ─── */}
          <Section number="4" title="Our Commitment">
            <p>If you report a vulnerability in accordance with this policy:</p>
            <BulletList items={[
              'We will acknowledge receipt of your report',
              'We will investigate the issue in a timely manner',
              'We will keep you informed of progress where appropriate',
              'We will take reasonable steps to resolve confirmed vulnerabilities',
            ]} />
            <p>MaidHive will not pursue legal action against individuals who act in good faith, comply with this policy, and do not violate applicable laws.</p>
            <p>This protection applies only to activities conducted within the scope and guidelines of this policy.</p>
            <p>We aim to resolve confirmed vulnerabilities within a reasonable timeframe, taking into account the complexity and potential impact of the issue.</p>
          </Section>

          {/* ─── Section 5 ─── */}
          <Section number="5" title="Exclusions">
            <p>The following are generally not considered valid security vulnerabilities:</p>
            <BulletList items={[
              'Spam, phishing, or social engineering campaigns',
              'Issues requiring physical access to a user\u2019s device',
              'Missing best-practice configurations without a demonstrated exploit',
              'Rate limiting or brute force concerns without clear evidence of impact',
              'Issues affecting third-party platforms not controlled by MaidHive',
            ]} />
          </Section>

          {/* ─── Section 6 ─── */}
          <Section number="6" title="No Bug Bounty Program">
            <p>MaidHive does not currently operate a public bug bounty program.</p>
            <p>Submission of a vulnerability report does not entitle the reporter to financial compensation unless explicitly agreed in writing.</p>
            <p>MaidHive may, at its discretion, acknowledge or thank individuals who report valid vulnerabilities.</p>
          </Section>

          {/* ─── Section 7 ─── */}
          <Section number="7" title="Legal Notice">
            <p>This policy does not grant any rights or authorisation to:</p>
            <BulletList items={[
              'Access data without authorisation',
              'Perform testing outside the defined scope',
              'Violate applicable laws or regulations',
            ]} />
            <p>Any activities that breach this policy or applicable laws may result in legal action.</p>
          </Section>

          {/* ─── Section 8 ─── */}
          <Section number="8" title="Contact">
            <p>For all security-related matters, please contact:</p>
            <div className="bg-gray-50 rounded-xl p-6 mt-4">
              <p>Email: <a href="mailto:security@maidhive.app" className="text-primary font-semibold hover:underline">security@maidhive.app</a></p>
            </div>
          </Section>

        </div>
      </div>
    </>
  )
}

/* ─── Helper components ─── */

function Section({ number, title, children }: { number: string; title: string; children: React.ReactNode }) {
  return (
    <section className="mb-16">
      <div className="flex items-baseline gap-3 mb-6 pb-4 border-b border-gray-100">
        <span className="text-sm font-mono text-primary font-semibold">{number}.</span>
        <h2 className="text-2xl font-bold text-gray-900">{title}</h2>
      </div>
      <div className="space-y-4 text-[15px] text-gray-600 leading-relaxed">{children}</div>
    </section>
  )
}

function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="list-disc pl-6 space-y-1.5 my-3">
      {items.map((item, i) => (
        <li key={i} className="text-gray-600">{item}</li>
      ))}
    </ul>
  )
}
