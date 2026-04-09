'use client'

import { ScheduleEditor } from '@/components/schedule-editor'

export default function AvailabilityPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="marketplace-title text-3xl text-slate-900">Availability</h1>
        <p className="mt-1 text-sm text-slate-500">
          Set your weekly schedule and block specific dates.
        </p>
      </div>
      <ScheduleEditor />
    </div>
  )
}
