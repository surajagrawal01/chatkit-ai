"use client";

import { ChatMessage } from "@/server/ai/types";
import { useCallback, useEffect, useRef, useState } from "react";

interface ChatSummary {
    id: string;
    title: string;
    updatedAt: string;
    messageCount: number;
}

export function useChat() {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState<string>("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [chatId, setChatId] = useState<string | null>(null);
    const [chats, setChats] = useState<ChatSummary[]>([]);
    const [listLoading, setListLoading] = useState(false);

    // Holds the controller for whichever request is currently in flight, if any. Aborting it is what tells the browser to close the fetch, which in turn drops the connection to /api/chat, which is what flips req.signal.aborted server-side and cancels the Gemini call — see route.ts and gemini.provider.ts for the rest of that chain.
    const abortControllerRef = useRef<AbortController | null>(null);

    const fetchChats = useCallback(async () => {
        setListLoading(true);
        try {
            const res = await fetch("/api/chat");
            if (!res.ok) throw new Error("Could not load chats");
            const data = await res.json();
            setChats(data);
        } catch (err) {
            console.error(err);
        } finally {
            setListLoading(false);
        }
    }, []);

    const loadChat = useCallback(async (targetChatId: string) => {
        setLoading(true);
        setError(null);

        try {
            const res = await fetch(`/api/chat/${targetChatId}`);
            if (!res.ok) {
                const data = await res.json().catch(() => null);
                throw new Error(data?.error || "Failed to load conversation");
            }

            const data = await res.json();
            setChatId(targetChatId);
            setMessages(data.messages ?? []);
            setInput("");
        } catch (err) {
            const message = err instanceof Error ? err.message : "Something went wrong";
            setError(message);
        } finally {
            setLoading(false);
        }
    }, []);

    const newChat = useCallback(async () => {
        setChatId(null);
        setMessages([]);
        setInput("");
        setError(null);
        await fetchChats();
    }, [fetchChats]);

    const selectChat = useCallback((targetChatId: string) => {
        void loadChat(targetChatId);
    }, [loadChat]);

    const updateMessage = useCallback((id: string, patch: Partial<ChatMessage>) => {
        setMessages(prev => prev.map(msg => (msg.id === id ? { ...msg, ...patch } : msg)));
    }, []);

    const sendMessage = useCallback(async () => {
        const text = input.trim();
        if (!text || loading) return;

        const userMessage: ChatMessage = { role: "user", content: text, id: crypto.randomUUID(), status: "done" };
        const nextMessages = [...messages, userMessage];

        setInput("");
        setMessages(nextMessages);
        setError(null);
        setLoading(true);

        const assistantId: string = crypto.randomUUID()

        // One AbortController per request. Aborting it is what tells the browser to close
        // the fetch, which in turn drops the connection to /api/chat, which is what flips
        // req.signal.aborted server-side and cancels the Gemini call
        const controller = new AbortController();
        abortControllerRef.current = controller;

        let fullResponse = "";

        try {
            const res = await fetch("/api/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ messages: nextMessages, chatId }),
                signal: controller.signal,
            });

            const responseChatId = res.headers.get("X-Chat-Id");
            if (responseChatId) {
                setChatId(responseChatId);
            }

            if (!res.ok) {
                // Body hasn't been touched yet at this point, so it's still safe to read as JSON.
                const data = await res.json().catch(() => null);
                throw new Error(data?.error || `Request failed (${res.status})`);
            }

            const reader = res.body?.getReader();
            if (!reader) throw new Error("No response body");

            const decoder = new TextDecoder();
            setMessages(prev => [
                ...prev,
                {
                    id: assistantId,
                    role: "assistant",
                    content: "",
                    status: "streaming",
                },
            ]);

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value);
                fullResponse += chunk;
                updateMessage(assistantId, { content: fullResponse });
            }

            updateMessage(assistantId, { status: "done" });
            await fetchChats();
        } catch (err) {
            const wasAborted = err instanceof DOMException && err.name === "AbortError";

            if (wasAborted) {
                // Intentional cancel (Stop button, or the cleanup effect below on unmount) —
                // not a failure, so no red error banner
                updateMessage(assistantId, { status: "stopped" });
            } else {
                const message = err instanceof Error ? err.message : "Something went wrong";
                setError(message);
                // If we'd already created the assistant bubble and were mid-stream when the
                // failure hit, mark it errored too instead of leaving it stuck on "streaming".
                setMessages(prev =>
                    prev.some(m => m.id === assistantId)
                        ? prev.map(m => (m.id === assistantId ? { ...m, status: "error" } : m))
                        : prev
                );
            }
        } finally {
            setLoading(false);
            abortControllerRef.current = null;
        }
    }, [chatId, fetchChats, input, loading, messages, updateMessage]);

    // User-facing "Stop" action — aborts whatever request is currently in flight, if any.
    const stopGeneration = useCallback(() => {
        abortControllerRef.current?.abort();
    }, []);
    // Covers the "browser tab/app view closed" and "navigated away mid-stream" cases: if this
    // hook's component unmounts while a request is still in flight, cancel it.

    useEffect(() => {
        void fetchChats();
        return () => {
            abortControllerRef.current?.abort();
        };
    }, [fetchChats]);

    return {
        messages,
        error,
        loading,
        chats,
        activeChatId: chatId,
        selectChat,
        newChat,
        sendMessage,
        stopGeneration,
        setInput,
        input,
        listLoading,
    };
}
