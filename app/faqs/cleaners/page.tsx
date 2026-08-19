import type { Metadata } from 'next'
import { FaqPage, type FaqItem } from '@/components/faq-page'

export const metadata: Metadata = {
  title: 'Cleaner FAQs | MaidHive',
  description: 'Everything you need to know about working independently through MaidHive.',
}

const cleanerFaqs: FaqItem[] = [
  {
    question: 'How do I become a cleaner on MaidHive?',
    answer: [
      {
        type: 'paragraph',
        text: 'Create a cleaner account and complete the required onboarding process, including your profile information, required identification and the cleaner onboarding quiz. Your application must be approved by MaidHive before your cleaner profile can go live and receive booking requests.',
      },
      {
        type: 'paragraph',
        text: 'MaidHive does not guarantee a particular approval timeframe.',
      },
    ],
  },
  {
    question: 'Do I work for MaidHive?',
    answer: [
      {
        type: 'paragraph',
        text: 'No. Cleaners using MaidHive provide cleaning services independently through the platform. MaidHive operates the marketplace and does not employ cleaners to provide the cleaning services booked by clients.',
      },
      {
        type: 'paragraph',
        text: 'You are responsible for ensuring that you are legally permitted to work in Cyprus and provide cleaning services independently.',
      },
    ],
  },
  {
    question: 'Can I choose my own hourly rate?',
    answer: [
      {
        type: 'paragraph',
        text: 'Yes. You set your own hourly cleaning rate within MaidHive’s permitted rate range. Clients can see your rate before requesting a booking with you.',
      },
    ],
  },
  {
    question: 'Does MaidHive deduct a platform fee from my hourly earnings?',
    answer: [
      {
        type: 'paragraph',
        text: 'No. Your cleaner rate is the amount used to calculate your earnings for the cleaning service you provide. MaidHive’s platform fee is charged separately to the client rather than deducted as a percentage from your stated hourly rate.',
      },
      {
        type: 'paragraph',
        text: 'You can see what you are due to earn from a booking before accepting it.',
      },
    ],
  },
  {
    question: 'Can I choose when I work?',
    answer: [
      {
        type: 'paragraph',
        text: 'Yes. You control your availability and can update the times you are available to receive bookings. MaidHive does not require you to work a minimum number of hours.',
      },
    ],
  },
  {
    question: 'How do I receive bookings?',
    answer: [
      {
        type: 'paragraph',
        text: 'Clients choose a cleaner and send that cleaner a booking request. MaidHive does not currently operate a general pool of open jobs for cleaners to browse.',
      },
      {
        type: 'paragraph',
        text: 'You can review the booking request and accept or decline it. Where available, you may also propose an alternative time.',
      },
    ],
  },
  {
    question: 'Do I have to accept every booking request?',
    answer: [
      {
        type: 'paragraph',
        text: 'No. You choose which booking requests you accept. Review the booking information before deciding whether the job works for you.',
      },
      {
        type: 'paragraph',
        text: 'Once you accept a booking request and the booking is confirmed, MaidHive’s cancellation and no-show rules apply.',
      },
    ],
  },
  {
    question: 'When do I get paid?',
    answer: [
      {
        type: 'paragraph',
        text: 'Your payout is released after the 24-hour post-job reporting window, provided there is no unresolved payment or dispute issue.',
      },
      {
        type: 'paragraph',
        text: 'The time it takes for funds to reach your account after release can depend on the payment provider and your financial institution.',
      },
    ],
  },
  {
    question: 'Can I cancel a booking after accepting it?',
    answer: [
      {
        type: 'paragraph',
        text: 'Yes, but cleaner cancellations are subject to MaidHive’s cancellation rules and may affect your platform standing, particularly for late cancellations or no-shows.',
      },
      {
        type: 'paragraph',
        text: 'Only accept bookings you reasonably expect to be able to complete.',
      },
    ],
  },
  {
    question: 'Do I need to provide cleaning supplies?',
    answer: [
      {
        type: 'paragraph',
        text: 'You can indicate on your cleaner profile whether you bring cleaning supplies or whether the client must provide them. This information is shown to clients when they book with you, so keep your selection up to date.',
      },
    ],
  },
  {
    question: 'What if I need the client to pick me up?',
    answer: [
      {
        type: 'paragraph',
        text: 'You can indicate your transport situation on MaidHive, including whether you require pick-up. Where pick-up is required, the client must agree to the arrangement for the booking.',
      },
      {
        type: 'paragraph',
        text: 'Keep your transport information accurate so clients can make an informed choice before booking you.',
      },
    ],
  },
  {
    question: 'What happens if there is a problem during or after a booking?',
    answer: [
      {
        type: 'paragraph',
        text: 'Use MaidHive’s booking tools and chat to keep relevant communication connected to the booking. If an issue is reported, MaidHive can review available booking information and evidence and apply the relevant platform policies.',
      },
    ],
  },
]

export default function CleanerFaqPage() {
  return (
    <FaqPage
      heading="Cleaner FAQs"
      supportingText="Everything you need to know about working independently through MaidHive."
      items={cleanerFaqs}
    />
  )
}
