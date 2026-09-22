import { NextResponse } from "next/server";
import { getAIProvider } from "@/server/ai/provider";
import type { ChatMessage } from "@/server/ai/types";
import { getClientIdentifier } from "@/lib/rate-limit/identifier";
import { rateLimiter } from "@/lib/rate-limit/rate-limiter";
import {
    buildTitleFromText,
    createChat,
    ensureChatTitle,
    saveAssistantMessage,
    saveUserMessage,
} from "@/server/services/chat.service";

export async function GET() {
    try {
        const { listChats } = await import("@/server/services/chat.service");
        const chats = await listChats();

        return NextResponse.json(
            chats.map(chat => ({
                id: chat.id,
                title: chat.title,
                createdAt: chat.createdAt,
                updatedAt: chat.updatedAt,
                messageCount: chat.messages.length,
            }))
        );
    } catch (error) {
        console.error("[api/chat GET]", error);
        return NextResponse.json({ error: "Failed to load chats" }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const messages = body.messages as ChatMessage[];
        const incomingChatId = body.chatId as string | undefined;

        if (!Array.isArray(messages) || messages.length === 0) {
            return NextResponse.json(
                { error: "messages can not be a empty array" },
                { status: 400 }
            );
        }

        if (messages.length > 50) {
            return NextResponse.json(
                { error: "Too many messages" },
                { status: 400 }
            );
        }

        const identifier = getClientIdentifier(req);
        const result = await rateLimiter.limit(identifier);
        const resetTime = result?.resetAt ? new Date(result.resetAt) : new Date(Date.now() + 60000);
        const localizedTime = resetTime.toLocaleTimeString("en-US", {
            hour: "numeric",
            minute: "2-digit",
            hour12: true,
        });

        if (!result.allowed) {
            return NextResponse.json(
                {
                    error: `Too many requests, try after ${localizedTime}`,
                    retryAfter: Math.ceil((result?.resetAt - Date.now()) / 1000),
                },
                { status: 429 }
            );
        }

        let chatId = incomingChatId;

        if (!chatId) {
            const firstUserMessage = messages[messages.length - 1]?.content?.trim();
            const createdChat = await createChat({
                title: firstUserMessage ? buildTitleFromText(firstUserMessage) : "New chat",
            });
            chatId = createdChat.id;
        }

        const latestUserMessage = messages[messages.length - 1];
        if (latestUserMessage?.role === "user" && latestUserMessage.content?.trim()) {
            await saveUserMessage(chatId!, latestUserMessage.content);
            await ensureChatTitle(chatId!, latestUserMessage.content);
        }

        const ai = await getAIProvider();
        const stream = await ai.generateReplyStream(messages, { signal: req.signal });

        const reader = stream.getReader();
        const decoder = new TextDecoder();
        let fullResponse = "";

        const responseStream = new ReadableStream({
            async start(controller) {
                try {
                    while (true) {
                        const { done, value } = await reader.read();

                        if (done) {
                            break;
                        }

                        const chunk = decoder.decode(value, { stream: true });
                        fullResponse += chunk;
                        controller.enqueue(value);
                    }

                    if (chatId && fullResponse.trim()) {
                        await saveAssistantMessage(chatId, fullResponse);
                    }

                    controller.close();
                } catch (error) {
                    if (req.signal.aborted || (error instanceof DOMException && error.name === "AbortError")) {
                        controller.close();
                        return;
                    }
                    controller.error(error);
                }
            },
            cancel() {
                reader.cancel().catch(() => undefined);
            },
        });

        return new Response(responseStream, {
            headers: {
                "Content-Type": "text/plain",
                "Cache-Control": "no-cache",
                "X-Chat-Id": chatId ?? "",
            },
        });
    } catch (error) {
        if (req.signal.aborted || (error instanceof DOMException && error.name === "AbortError")) {
            return new Response(null, { status: 499 });
        }

        console.error("[api/chat]", error);
        return NextResponse.json(
            { error: "Failed to generate reply" },
            { status: 500 }
        );
    }
}