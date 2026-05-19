import { CleanerShell } from '@/components/cleaner-shell'
import { SessionProvider } from '@/components/providers/session-provider'
import { bootstrapServerSession } from '@/server/session-bootstrap'

export default async function CleanerLayout({ children }: { children: React.ReactNode }) {
  const initialSession = await bootstrapServerSession({ role: 'cleaner' })
  return (
    <SessionProvider initialSession={initialSession}>
      <CleanerShell>{children}</CleanerShell>
    </SessionProvider>
  )
}
