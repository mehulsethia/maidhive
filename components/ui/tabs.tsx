'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

interface TabsContextValue {
  active: string
  setActive: (v: string) => void
}
const TabsCtx = React.createContext<TabsContextValue>({ active: '', setActive: () => {} })

interface TabsProps {
  defaultValue?: string
  value?: string
  onValueChange?: (v: string) => void
  children: React.ReactNode
  className?: string
}

function Tabs({ defaultValue = '', value, onValueChange, children, className }: TabsProps) {
  const [internalActive, setInternalActive] = React.useState(defaultValue)
  const isControlled = value !== undefined
  const active = isControlled ? value : internalActive

  const setActive = React.useCallback((v: string) => {
    if (!isControlled) setInternalActive(v)
    onValueChange?.(v)
  }, [isControlled, onValueChange])

  return (
    <TabsCtx.Provider value={{ active, setActive }}>
      <div className={cn('', className)}>{children}</div>
    </TabsCtx.Provider>
  )
}

function TabsList({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={cn('inline-flex h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground', className)}>
      {children}
    </div>
  )
}

function TabsTrigger({ value, children, className }: { value: string; children: React.ReactNode; className?: string }) {
  const { active, setActive } = React.useContext(TabsCtx)
  return (
    <button
      onClick={() => setActive(value)}
      className={cn(
        'inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50',
        active === value ? 'bg-background text-foreground shadow-sm' : 'hover:bg-background/50',
        className,
      )}
    >
      {children}
    </button>
  )
}

function TabsContent({ value, children, className }: { value: string; children: React.ReactNode; className?: string }) {
  const { active } = React.useContext(TabsCtx)
  if (active !== value) return null
  return <div className={cn('mt-4', className)}>{children}</div>
}

export { Tabs, TabsList, TabsTrigger, TabsContent }
