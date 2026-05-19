import { ClientShell } from '@/components/client-shell'
import { SessionProvider } from '@/components/providers/session-provider'
import { bootstrapServerSession } from '@/server/session-bootstrap'

export default async function ClientLayout({ children }: { children: React.ReactNode }) {
  const initialSession = await bootstrapServerSession({ role: 'client' })
  return (
    <SessionProvider initialSession={initialSession}>
      <ClientShell>{children}</ClientShell>
    </SessionProvider>
  )
}
