"use client";

import { useChat } from "@/features/chat/hooks/useChat";
import { MessageList } from "./MessageList";
import { ChatInput } from "./ChatInput";

export function Chat() {
    const {
        messages,
        input,
        setInput,
        loading,
        error,
        sendMessage,
        stopGeneration,
    } = useChat();

    return (
        <div className="flex h-screen flex-col bg-zinc-950 text-white">
            <header className="border-b border-zinc-800 px-6 py-4">
                <h1 className="text-xl font-semibold">
                    ChatKit
                </h1>
            </header>

            <div className="flex-1 overflow-hidden">
                <MessageList
                    messages={messages}
                    loading={loading}
                />

                {error && (
                    <div className="px-4 pb-4">
                        <div className="max-w-4xl mx-auto">
                            <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                                {error}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <ChatInput
                value={input}
                onChange={setInput}
                onSend={sendMessage}
                onStop={stopGeneration}
                loading={loading}
            />
        </div>
    );
}