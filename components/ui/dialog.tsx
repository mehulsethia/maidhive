'use client'

import * as React from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'
import { X } from 'lucide-react'

interface DialogProps {
  open: boolean
  onClose: () => void
  children: React.ReactNode
  className?: string
}

function Dialog({ open, onClose, children, className }: DialogProps) {
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
    return () => setMounted(false)
  }, [])

  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    if (open) document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose])

  React.useEffect(() => {
    if (!open) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [open])

  if (!open || !mounted) return null

  return createPortal(
    <div className="fixed inset-0 z-[120]">
      <div className="absolute inset-0 bg-black/45 backdrop-blur-[1px]" onClick={onClose} />
      <div className="absolute inset-0 overflow-y-auto p-3 sm:p-4">
        <div className="flex min-h-full items-end justify-center py-1 sm:items-center sm:py-8">
          <div
            role="dialog"
            aria-modal="true"
            className={cn(
              'relative z-10 w-full max-w-md max-h-[calc(100dvh-1rem)] overflow-y-auto rounded-2xl border border-slate-200 bg-background p-5 shadow-2xl sm:max-h-[calc(100dvh-4rem)] sm:p-6',
              className,
            )}
          >
            <button onClick={onClose} className="absolute right-4 top-4 rounded-md p-1 text-muted-foreground hover:bg-slate-100 hover:text-foreground">
              <X className="h-5 w-5" />
            </button>
            {children}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}

function DialogTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h2 className={cn('text-lg font-semibold mb-4', className)} {...props} />
}

export { Dialog, DialogTitle }
