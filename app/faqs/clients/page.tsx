import type { Metadata } from 'next'
import { FaqPage, type FaqItem } from '@/components/faq-page'

export const metadata: Metadata = {
  title: 'Client FAQs | MaidHive',
  description: 'Everything you need to know about booking and managing a clean through MaidHive.',
}

const clientFaqs: FaqItem[] = [
  {
    question: 'How does booking a cleaner work?',
    answer: [
      {
        type: 'paragraph',
        text: 'Choose an approved cleaner, select an available date and time and enter your booking details. At the final step, you’ll be asked to authorise your payment method before the booking request is sent to the cleaner. The cleaner can then accept, decline or, where available, propose an alternative time. If the cleaner accepts, your booking is confirmed.',
      },
    ],
  },
  {
    question: 'How are cleaners approved on MaidHive?',
    answer: [
      {
        type: 'paragraph',
        text: 'Cleaners complete MaidHive’s onboarding process, which includes submitting identification and required profile information. Their application must then be approved by MaidHive before their profile can become visible to clients.',
      },
      {
        type: 'paragraph',
        text: 'Approval does not mean that MaidHive employs the cleaner or guarantees the quality or outcome of their services.',
      },
    ],
  },
  {
    question: 'What cleaning services can I book?',
    answer: [
      { type: 'paragraph', text: 'MaidHive offers four core cleaning-service types:' },
      {
        type: 'list',
        items: [
          'Regular home cleaning — everyday home cleaning for routine cleaning tasks and general upkeep.',
          'One-off cleaning — a thorough clean whenever you need it, such as before guests arrive or for a seasonal refresh.',
          'Deep cleaning — a more intensive clean for homes that need extra attention.',
          'End-of-tenancy cleaning — a thorough clean for a rental property at the end of a tenancy before moving out.',
        ],
      },
      {
        type: 'paragraph',
        text: 'You can provide additional information about what you need when making your booking.',
      },
    ],
  },
  {
    question: 'How much does a booking cost?',
    answer: [
      {
        type: 'paragraph',
        text: 'Each cleaner sets their own hourly rate within MaidHive’s permitted range. A secure booking & support fee is also added to the booking.',
      },
      {
        type: 'paragraph',
        text: 'You will see the full booking total, including the secure booking & support fee, before you authorise your payment.',
      },
    ],
  },
  {
    question: 'When am I charged?',
    answer: [
      {
        type: 'paragraph',
        text: 'Your payment method is authorised as part of the booking process. Payment is captured after the cleaning is completed in accordance with MaidHive’s payment process.',
      },
      {
        type: 'paragraph',
        text: 'If a payment authorisation needs to be renewed before a future booking, MaidHive may ask you to complete a new authorisation.',
      },
    ],
  },
  {
    question: 'Can I cancel or reschedule a booking?',
    answer: [
      {
        type: 'paragraph',
        text: 'Yes. Available cancellation and rescheduling options depend on how long remains before the booking starts.',
      },
      {
        type: 'paragraph',
        text: 'Any applicable cancellation charge or refund will be shown or handled according to MaidHive’s cancellation policy. Where rescheduling is available, the other party may need to accept the proposed new time.',
      },
    ],
  },
  {
    question: 'Do cleaners bring their own cleaning supplies?',
    answer: [
      {
        type: 'paragraph',
        text: 'This depends on the cleaner. MaidHive shows whether the cleaner brings cleaning supplies or whether you need to provide them. Check this information before booking so you know what arrangement applies to your clean.',
      },
    ],
  },
  {
    question: 'What if a cleaner requires transport or pick-up?',
    answer: [
      {
        type: 'paragraph',
        text: 'A cleaner’s profile may indicate that they require pick-up for a booking. If you choose a cleaner who requires pick-up, you will need to confirm the transport arrangement as part of the booking process.',
      },
    ],
  },
  {
    question: 'How can I communicate with my cleaner?',
    answer: [
      {
        type: 'paragraph',
        text: 'Once your booking is confirmed, you can communicate with your cleaner through MaidHive’s booking chat. Contact details may also become available closer to the scheduled booking time to help with practical arrangements for the clean.',
      },
    ],
  },
  {
    question: 'What happens if my cleaner doesn’t arrive?',
    answer: [
      {
        type: 'paragraph',
        text: 'If your cleaner does not attend the booking, report the issue through MaidHive. MaidHive can review the booking information and available evidence and apply the appropriate no-show and refund rules.',
      },
    ],
  },
  {
    question: 'What if there is a problem with my booking?',
    answer: [
      {
        type: 'paragraph',
        text: 'You can report an issue through MaidHive within the applicable reporting period after the booking. MaidHive can review relevant booking information and available evidence before determining the appropriate outcome under its policies.',
      },
    ],
  },
  {
    question: 'Can I leave a review?',
    answer: [
      {
        type: 'paragraph',
        text: 'Yes. Reviews can be submitted following completed MaidHive bookings. This helps ensure reviews come from clients who have actually booked through the platform.',
      },
    ],
  },
]

export default function ClientFaqPage() {
  return (
    <FaqPage
      heading="Client FAQs"
      supportingText="Everything you need to know about booking and managing a clean through MaidHive."
      items={clientFaqs}
    />
  )
}
