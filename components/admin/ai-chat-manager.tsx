"use client"

import { useEffect, useRef, useState, type FormEvent } from "react"
import { Loader2, Send, Sparkles, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

type ChatMessage = {
  role: "user" | "assistant"
  content: string
  timestamp: Date
  success?: boolean
}

const exampleCommands = ["Mark item as sold", "Update price", "Add stock"]

export function AiChatManager() {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [inputValue, setInputValue] = useState("")
  const [isThinking, setIsThinking] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault()
        setIsOpen((open) => !open)
      }
    }
    window.addEventListener("keydown", handleShortcut)
    return () => window.removeEventListener("keydown", handleShortcut)
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, isThinking])

  const sendCommand = async (event?: FormEvent<HTMLFormElement>, command = inputValue) => {
    event?.preventDefault()
    const trimmedCommand = command.trim()
    if (!trimmedCommand || isThinking) return

    setMessages((current) => [
      ...current,
      { role: "user", content: trimmedCommand, timestamp: new Date() },
    ])
    setInputValue("")
    setIsThinking(true)
    try {
      const response = await fetch("/api/ai/chat-manage", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command: trimmedCommand }),
      })
      const data = await response.json().catch(() => null)
      if (!response.ok) {
        throw new Error(data?.error || "The command could not be completed.")
      }
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content: data?.message || "Command complete.",
          timestamp: new Date(),
          success: data?.success === true,
        },
      ])
    } catch (error) {
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content: error instanceof Error ? error.message : "The command could not be completed.",
          timestamp: new Date(),
          success: false,
        },
      ])
    } finally {
      setIsThinking(false)
    }
  }

  return (
    <div className="fixed bottom-5 right-5 z-50">
      {isOpen ? (
        <section
          aria-label="AI Store Assistant"
          className="flex h-96 w-[min(20rem,calc(100vw-2.5rem))] flex-col overflow-hidden rounded-2xl border border-[#e5e7eb] bg-white shadow-xl"
        >
          <header className="flex items-center justify-between rounded-t-2xl bg-[#2563eb] px-4 py-3 text-white">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              <h2 className="text-sm font-semibold">AI Store Assistant</h2>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              aria-label="Close AI Store Assistant"
              className="rounded p-1 hover:bg-white/15"
            >
              <X className="h-4 w-4" />
            </button>
          </header>

          <div className="flex-1 space-y-3 overflow-y-auto p-3" aria-live="polite">
            {messages.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center text-center">
                <Sparkles className="h-7 w-7 text-[#2563eb]" />
                <p className="mt-2 text-sm text-[#6b7280]">Ask me to manage your store</p>
                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  {exampleCommands.map((example) => (
                    <button
                      key={example}
                      type="button"
                      onClick={() => setInputValue(`${example}: `)}
                      className="rounded-full bg-[#f3f4f6] px-2.5 py-1 text-xs text-[#4b5563] hover:bg-[#e5e7eb]"
                    >
                      {example}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((message, index) => (
                <div
                  key={`${message.timestamp.getTime()}-${index}`}
                  className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <p
                    className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                      message.role === "user"
                        ? "rounded-br-sm bg-[#2563eb] text-white"
                        : `rounded-bl-sm ${
                            message.success === false
                              ? "bg-[#fffbeb] text-[#92400e]"
                              : message.success
                                ? "bg-[#f0fdf4] text-[#166534]"
                                : "bg-[#f3f4f6] text-[#111827]"
                          }`
                    }`}
                  >
                    {message.content}
                  </p>
                </div>
              ))
            )}
            {isThinking && (
              <div className="flex justify-start">
                <div className="flex items-center gap-1 rounded-2xl rounded-bl-sm bg-[#f3f4f6] px-3 py-3">
                  {[0, 1, 2].map((dot) => (
                    <span
                      key={dot}
                      className="h-2 w-2 animate-bounce rounded-full bg-[#9ca3af]"
                      style={{ animationDelay: `${dot * 120}ms` }}
                    />
                  ))}
                  <span className="sr-only">Thinking</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <form onSubmit={(event) => void sendCommand(event)} className="flex gap-2 border-t border-[#e5e7eb] p-3">
            <Input
              value={inputValue}
              onChange={(event) => setInputValue(event.target.value)}
              placeholder="e.g. Mark the red bag as sold..."
              aria-label="Store management command"
              className="min-w-0 flex-1 rounded-xl border-[#e5e7eb] px-3 py-2 text-sm"
            />
            <Button
              type="submit"
              disabled={!inputValue.trim() || isThinking}
              aria-label="Send command"
              className="rounded-xl bg-[#2563eb] px-3 py-2 text-white hover:bg-[#1d4ed8]"
            >
              {isThinking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </form>
        </section>
      ) : (
        <Button
          type="button"
          onClick={() => setIsOpen(true)}
          className="h-12 w-12 rounded-full bg-[#2563eb] p-0 text-white shadow-lg hover:bg-[#1d4ed8]"
          aria-label="Open AI Assistant (Ctrl+K)"
          title="AI Assistant (Ctrl+K)"
        >
          <Sparkles className="h-5 w-5" />
        </Button>
      )}
    </div>
  )
}
