import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Responsible Disclosure Policy — MaidHive',
  description: 'MaidHive\'s policy for responsible security vulnerability disclosure.',
}

export default function DisclosurePage() {
  return (
    <>
      {/* Gradient header */}
      <div
        className="px-6 py-16 text-white text-center"
        style={{
          background: 'radial-gradient(ellipse at 30% 50%, #0088DD 19%, #044EE2 38%, #030016 100%)',
        }}
      >
        <h1 className="text-4xl font-bold mb-3">Responsible Disclosure Policy</h1>
        <p className="text-white/70 text-sm">Last updated: April 2025</p>
      </div>

      {/* Content */}
      <div className="bg-white px-6 py-16">
        <div className="max-w-3xl mx-auto prose prose-gray prose-headings:font-bold prose-headings:text-gray-900 prose-p:text-gray-600 prose-li:text-gray-600 prose-a:text-[#044EE2]">

          <h2>Our Commitment</h2>
          <p>
            MaidHive is committed to keeping our platform and users safe. We welcome reports from security researchers, ethical hackers, and members of the public who identify potential vulnerabilities in our systems.
          </p>
          <p>
            If you believe you have discovered a security vulnerability, we encourage you to report it to us responsibly. We commit to working with you to understand and address the issue promptly.
          </p>

          <h2>Scope</h2>
          <p>This policy applies to the following:</p>
          <ul>
            <li>The MaidHive web application at <strong>maidhive.app</strong> and <strong>maidhive.vercel.app</strong></li>
            <li>The MaidHive API at <strong>maidhive.app/api/v1/*</strong></li>
            <li>Any subdomains operated by MaidHive</li>
          </ul>
          <p>The following are out of scope:</p>
          <ul>
            <li>Third-party services and integrations (Stripe, Supabase, Google)</li>
            <li>Social engineering attacks targeting MaidHive staff or users</li>
            <li>Physical security</li>
            <li>Denial of service (DoS/DDoS) attacks</li>
            <li>Spam or phishing campaigns</li>
          </ul>

          <h2>How to Report</h2>
          <p>
            Please submit vulnerability reports to <a href="mailto:security@maidhive.app">security@maidhive.app</a> with the subject line <strong>&quot;Security Vulnerability Report&quot;</strong>.
          </p>
          <p>Your report should include:</p>
          <ul>
            <li>A description of the vulnerability and its potential impact</li>
            <li>Step-by-step instructions to reproduce the issue</li>
            <li>Any relevant screenshots, videos, or proof-of-concept code</li>
            <li>Your name and contact information (optional, for credit)</li>
          </ul>

          <h2>Our Commitments to You</h2>
          <p>When you report a vulnerability in good faith, we commit to:</p>
          <ul>
            <li>Acknowledge receipt of your report within <strong>3 business days</strong></li>
            <li>Provide an initial assessment and estimated resolution timeline within <strong>10 business days</strong></li>
            <li>Keep you informed of our progress</li>
            <li>Not pursue legal action against you for responsible disclosure</li>
            <li>Credit you publicly (if desired) once the vulnerability is resolved</li>
          </ul>

          <h2>Our Expectations of You</h2>
          <p>In return, we ask that you:</p>
          <ul>
            <li>Do not access, modify, or delete data belonging to other users</li>
            <li>Do not disrupt or degrade the performance of the Service</li>
            <li>Do not publicly disclose the vulnerability until we have had a reasonable opportunity to address it (coordinated disclosure)</li>
            <li>Act in good faith and avoid any actions that could harm MaidHive or its users</li>
          </ul>

          <h2>Safe Harbour</h2>
          <p>
            MaidHive will not take legal action against researchers who discover and report security vulnerabilities in accordance with this policy. We consider activities conducted under this policy to constitute authorised access.
          </p>

          <h2>Contact</h2>
          <p>
            Security reports: <a href="mailto:security@maidhive.app">security@maidhive.app</a><br />
            General enquiries: <a href="mailto:hello@maidhive.app">hello@maidhive.app</a>
          </p>
        </div>
      </div>
    </>
  )
}
