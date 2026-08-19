import { ChevronDown } from 'lucide-react'
import { LandingHeader } from '@/components/landing-header'
import Footer from '@/components/footer'

export type FaqAnswerBlock =
  | { type: 'paragraph'; text: string }
  | { type: 'list'; items: string[] }

export type FaqItem = {
  question: string
  answer: FaqAnswerBlock[]
}

export function FaqPage({
  heading,
  supportingText,
  items,
}: {
  heading: string
  supportingText: string
  items: FaqItem[]
}) {
  return (
    <main className="min-h-screen flex flex-col bg-gray-50">
      <LandingHeader />

      <section className="bg-gradient-to-br from-gray-950 via-gray-900 to-primary/30">
        <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:py-20">
          <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl">
            {heading}
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-gray-300 sm:text-lg">
            {supportingText}
          </p>
        </div>
      </section>

      <section className="flex-1 py-14">
        <div className="mx-auto max-w-4xl px-4 sm:px-6">
          <div className="divide-y divide-gray-200 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
            {items.map((item, index) => (
              <details key={item.question} className="group">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-5 text-left transition-colors hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 sm:px-6 [&::-webkit-details-marker]:hidden">
                  <span className="text-base font-semibold text-gray-900">
                    {index + 1}. {item.question}
                  </span>
                  <ChevronDown className="h-5 w-5 shrink-0 text-gray-400 transition-transform group-open:rotate-180" />
                </summary>
                <div className="space-y-4 px-5 pb-6 text-sm leading-relaxed text-gray-600 sm:px-6">
                  {item.answer.map((block, blockIndex) => (
                    block.type === 'paragraph' ? (
                      <p key={blockIndex}>{block.text}</p>
                    ) : (
                      <ul key={blockIndex} className="space-y-2">
                        {block.items.map((listItem) => (
                          <li key={listItem} className="pl-4 before:mr-2 before:content-['-']">
                            {listItem}
                          </li>
                        ))}
                      </ul>
                    )
                  ))}
                </div>
              </details>
            ))}
          </div>
        </div>
      </section>

      <Footer />
    </main>
  )
}
