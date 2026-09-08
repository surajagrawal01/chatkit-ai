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

        const userMessage: ChatMessage = { role: "user", content: text, id: crypto.randomUUID() }

        const nextMessages = [...messages, userMessage];

        setInput('')
        setMessages(nextMessages)
        setError(null)
        setLoading(true)

        const assistantId: string = crypto.randomUUID()


        try {
            const res = await fetch("/api/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ messages: nextMessages })
            })
            // const data = await res.json();
            const reader = res.body?.getReader();
            if (!res.ok) throw new Error(data.error || "Request Failed")

            const decoder = new TextDecoder();
            setMessages(prev => [
                ...prev,
                {
                    id: assistantId,
                    role: "assistant",
                    content: ""
                }
            ]);
            let fullResponse: string = ''

            while (true) {

                const { done, value } =
                    await reader.read();

                if (done) break;
                const chunk = decoder.decode(value);
                fullResponse +=
                    chunk

                console.log({ fullResponse });

                setMessages(prev =>
                    prev.map(msg =>
                        msg.id === assistantId
                            ? {
                                ...msg,
                                content: fullResponse
                            }
                            : msg
                    )
                );
            }


        } catch (error) {
            setError(error instanceof Error ? error.message : "Something went wrong")
        } finally {
            setLoading(false)
        }
    }, [input, loading, messages])

    return { messages, error, loading, sendMessage, setInput, input }
}