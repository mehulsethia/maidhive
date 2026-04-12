'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { Send } from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { messagesApi } from '@/lib/api'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import type { MessageRead } from '@/types'
import { toast } from 'sonner'

interface ChatProps {
  bookingId: string
  currentUserId: string
}

export function Chat({ bookingId, currentUserId }: ChatProps) {
  const [messages, setMessages] = useState<MessageRead[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Scroll to bottom whenever messages change
  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  // Load message history
  useEffect(() => {
    messagesApi
      .getHistory(bookingId)
      .then(r => setMessages(r.data ?? []))
      .catch(() => toast.error('Failed to load messages'))
      .finally(() => setLoading(false))
  }, [bookingId])

  useEffect(() => {
    if (!loading) scrollToBottom()
  }, [messages, loading, scrollToBottom])

  // Supabase Realtime: listen for new messages on this booking
  useEffect(() => {
    const supabase = createClient()

    const channel = supabase
      .channel(`messages:${bookingId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `booking_id=eq.${bookingId}`,
        },
        (payload) => {
          const newMsg = payload.new as MessageRead
          // Only append if we don't already have this message (avoid duplicates from optimistic update)
          setMessages(prev =>
            prev.some(m => m.id === newMsg.id) ? prev : [...prev, newMsg],
          )
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [bookingId])

  async function handleSend() {
    const content = input.trim()
    if (!content || sending) return

    // Optimistic update
    const tempId = `temp-${Date.now()}`
    const optimistic: MessageRead = {
      id: tempId,
      booking_id: bookingId,
      sender_id: currentUserId,
      content,
      is_read: false,
      created_at: new Date().toISOString(),
    }
    setMessages(prev => [...prev, optimistic])
    setInput('')
    inputRef.current?.focus()

    setSending(true)
    try {
      const res = await messagesApi.send(bookingId, content)
      // Replace temp with confirmed message
      if (res.data) {
        setMessages(prev => prev.map(m => (m.id === tempId ? res.data! : m)))
      }
    } catch (err: any) {
      // Rollback optimistic update
      setMessages(prev => prev.filter(m => m.id !== tempId))
      toast.error(err.message ?? 'Failed to send message')
      setInput(content) // restore
    } finally {
      setSending(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  if (loading) {
    return (
      <div className="space-y-2 p-4">
        <Skeleton className="h-12 w-3/4 rounded-2xl" />
        <Skeleton className="h-12 w-2/3 rounded-2xl" />
        <Skeleton className="h-12 w-4/5 rounded-2xl" />
      </div>
    )
  }

  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border bg-background" style={{ height: 420 }}>
      {/* Header */}
      <div className="px-4 py-3 border-b bg-muted/40 text-sm font-medium shrink-0">
        In-booking chat
      </div>

      {/* Message list */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <p className="text-center text-xs text-muted-foreground py-8">
            No messages yet. Start the conversation!
          </p>
        )}
        {messages.map(msg => {
          const isOwn = msg.sender_id === currentUserId
          return (
            <div
              key={msg.id}
              className={cn('flex', isOwn ? 'justify-end' : 'justify-start')}
            >
              <div
                className={cn(
                  'max-w-[75%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed break-words',
                  isOwn
                    ? 'bg-primary text-primary-foreground rounded-br-sm'
                    : 'bg-muted text-foreground rounded-bl-sm',
                )}
              >
                {msg.content}
                <p
                  className={cn(
                    'text-[10px] mt-1',
                    isOwn ? 'text-primary-foreground/60 text-right' : 'text-muted-foreground',
                  )}
                >
                  {new Date(msg.created_at).toLocaleTimeString('en-IE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Nicosia' })}
                  {isOwn && msg.is_read && <span className="ml-1">✓✓</span>}
                </p>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="flex shrink-0 items-end gap-2 border-t bg-background p-3">
        <textarea
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message… (Enter to send)"
          rows={1}
          className="max-h-24 flex-1 resize-none overflow-y-auto rounded-xl border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          style={{ minHeight: 38 }}
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || sending}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground transition-all duration-200 hover:-translate-y-0.5 hover:opacity-95 disabled:opacity-40"
          aria-label="Send message"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
