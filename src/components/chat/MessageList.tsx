import { ChatMessage } from "@/server/ai/types";
import { useEffect, useRef } from "react";

interface MessageListProps {
    messages: ChatMessage[];
    loading: boolean;
}

export function MessageList({
    messages,
    loading,
}: MessageListProps) {

    const bottomRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({
            behavior: "smooth",
        });
    }, [messages, loading]);


    return (
        <div className="h-full overflow-y-auto">
            <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
                {messages.map((message, index) => {
                    const isUser = message.role === "user";

                    return (
                        <div
                            key={index}
                            className={`flex ${isUser ? "justify-end" : "justify-start"
                                }`}
                        >
                            <div
                                className={`max-w-[75%] rounded-2xl px-4 py-3 whitespace-pre-wrap ${isUser
                                    ? "bg-blue-600 text-white"
                                    : "bg-zinc-800 text-zinc-100"
                                    }`}
                            >
                                {typeof message.content === "string"
                                    ? message.content
                                    : "No Answer"}
                            </div>
                        </div>
                    );
                })}

                {loading && (
                    <div className="flex justify-start">
                        <div className="bg-zinc-800 rounded-2xl px-4 py-3">
                            Thinking...
                        </div>
                    </div>
                )}

                <div ref={bottomRef} />
            </div>
        </div>
    );
}