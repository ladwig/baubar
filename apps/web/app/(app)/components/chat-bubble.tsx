'use client'

import { useRef, useEffect, useState, useCallback } from 'react'
import { useChat } from 'ai/react'
import { MessageCircle, X, Send, Loader2, Bot, User, SquarePen } from 'lucide-react'
import type { Message } from 'ai'

const THREAD_KEY = 'baubar:chat:threadId'

export function ChatBubble() {
  const [open, setOpen] = useState(false)
  const [threadId, setThreadId] = useState<string | null>(null)
  const [loadingHistory, setLoadingHistory] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  const { messages, input, handleInputChange, handleSubmit, isLoading, error, setMessages } = useChat({
    api: '/api/v1/agent/chat',
    body: threadId ? { threadId } : undefined,
    onError: (e) => console.error('[useChat error]', e),
  })

  // Load thread history when chat opens for the first time
  const loadHistory = useCallback(async (tid?: string | null) => {
    setLoadingHistory(true)
    try {
      const qs = tid ? `?threadId=${tid}` : ''
      const res = await fetch(`/api/v1/agent/chat${qs}`)
      if (!res.ok) return

      const data = await res.json()

      // Store the resolved thread ID
      if (data.threadId) {
        setThreadId(data.threadId)
        localStorage.setItem(THREAD_KEY, data.threadId)
      }

      // Map DB messages to useChat Message format
      const initialMessages: Message[] = (data.messages ?? []).map(
        (m: { role: string; content: unknown }, i: number) => ({
          id: String(i),
          role: m.role as 'user' | 'assistant',
          content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
        }),
      )
      setMessages(initialMessages)
    } catch (e) {
      console.error('[loadHistory]', e)
    } finally {
      setLoadingHistory(false)
    }
  }, [setMessages])

  // On first open, load history using stored threadId (or default thread)
  useEffect(() => {
    if (!open) return
    if (messages.length > 0) return // already loaded
    const storedId = localStorage.getItem(THREAD_KEY)
    setThreadId(storedId)
    loadHistory(storedId)
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  // Scroll to bottom on new messages
  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, open])

  const handleNewConversation = async () => {
    try {
      const res = await fetch('/api/v1/agent/thread', { method: 'POST' })
      const data = await res.json()
      if (data.threadId) {
        setThreadId(data.threadId)
        localStorage.setItem(THREAD_KEY, data.threadId)
        setMessages([])
      }
    } catch (e) {
      console.error('[newConversation]', e)
    }
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
      {/* Chat panel */}
      {open && (
        <div className="flex flex-col w-[360px] h-[520px] rounded-2xl border border-zinc-200 bg-white shadow-xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100 bg-zinc-900">
            <div className="flex items-center gap-2">
              <Bot className="h-4 w-4 text-white" />
              <span className="text-sm font-medium text-white">Baubar Assistent</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleNewConversation}
                title="Neues Gespräch"
                className="text-zinc-400 hover:text-white transition-colors"
              >
                <SquarePen className="h-4 w-4" />
              </button>
              <button
                onClick={() => setOpen(false)}
                className="text-zinc-400 hover:text-white transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {(loadingHistory) && (
              <div className="flex justify-center items-center h-full">
                <Loader2 className="h-5 w-5 text-zinc-400 animate-spin" />
              </div>
            )}

            {!loadingHistory && messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center gap-2 text-zinc-400">
                <Bot className="h-8 w-8 text-zinc-300" />
                <p className="text-sm">Wie kann ich helfen?</p>
                <p className="text-xs text-zinc-300">
                  Ich kann Projekte suchen, Berichte erstellen und Kontakte nachschlagen.
                </p>
              </div>
            )}

            {!loadingHistory && messages.map((m) => (
              <div
                key={m.id}
                className={`flex gap-2 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {m.role === 'assistant' && (
                  <div className="flex-shrink-0 h-6 w-6 rounded-full bg-zinc-900 flex items-center justify-center mt-0.5">
                    <Bot className="h-3.5 w-3.5 text-white" />
                  </div>
                )}

                <div
                  className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed whitespace-pre-wrap ${
                    m.role === 'user'
                      ? 'bg-zinc-900 text-white rounded-br-sm'
                      : 'bg-zinc-100 text-zinc-800 rounded-bl-sm'
                  }`}
                >
                  {m.content}
                </div>

                {m.role === 'user' && (
                  <div className="flex-shrink-0 h-6 w-6 rounded-full bg-zinc-200 flex items-center justify-center mt-0.5">
                    <User className="h-3.5 w-3.5 text-zinc-600" />
                  </div>
                )}
              </div>
            ))}

            {isLoading && (
              <div className="flex gap-2 justify-start">
                <div className="flex-shrink-0 h-6 w-6 rounded-full bg-zinc-900 flex items-center justify-center">
                  <Bot className="h-3.5 w-3.5 text-white" />
                </div>
                <div className="bg-zinc-100 rounded-2xl rounded-bl-sm px-3.5 py-2.5">
                  <Loader2 className="h-4 w-4 text-zinc-400 animate-spin" />
                </div>
              </div>
            )}

            {error && (
              <p className="text-xs text-red-500 text-center">
                {error.message || 'Fehler beim Senden.'}
              </p>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <form
            onSubmit={handleSubmit}
            className="flex items-end gap-2 px-3 py-3 border-t border-zinc-100"
          >
            <textarea
              value={input}
              onChange={handleInputChange}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleSubmit(e as unknown as React.FormEvent)
                }
              }}
              placeholder="Nachricht eingeben..."
              rows={1}
              disabled={isLoading || loadingHistory}
              className="flex-1 resize-none rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-900 disabled:opacity-50 max-h-28 overflow-y-auto"
            />
            <button
              type="submit"
              disabled={isLoading || loadingHistory || !input.trim()}
              className="flex-shrink-0 h-9 w-9 rounded-xl bg-zinc-900 flex items-center justify-center text-white hover:bg-zinc-700 disabled:opacity-40 transition-colors"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </div>
      )}

      {/* Toggle button */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="h-14 w-14 rounded-full bg-zinc-900 text-white shadow-lg hover:bg-zinc-700 flex items-center justify-center transition-colors"
      >
        {open ? <X className="h-5 w-5" /> : <MessageCircle className="h-6 w-6" />}
      </button>
    </div>
  )
}
