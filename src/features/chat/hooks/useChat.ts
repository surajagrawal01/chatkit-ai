"use client"

import { ChatMessage } from "@/server/ai/types"
import { useCallback, useState } from "react"


export function useChat() {
    const [messages, setMessages] = useState<ChatMessage[]>([])
    const [input, setInput] = useState<string>("")
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const sendMessage = useCallback(async () => {
        const text = input.trim();
        if (!text || loading) return;

        const userMessage: ChatMessage = { role: "user", content: text }

        const nextMessages = [...messages, userMessage];

        setInput('')
        setMessages(nextMessages)
        setError(null)
        setLoading(true)
        try {
            const res = await fetch("/api/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ messages: nextMessages })
            })
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Request Failed")

            setMessages((prev) => [
                ...prev,
                {
                    role: "assistant",
                    content: data.content
                }
            ])
        } catch (error) {
            setError(error instanceof Error ? error.message : "Something went wrong")
        } finally {
            setLoading(false)
        }
    }, [input, loading, messages])

    return { messages, error, loading, sendMessage, setInput, input }
}