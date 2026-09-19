import { NextResponse } from "next/server";
import { getAIProvider } from "@/server/ai/provider";
import type { ChatMessage } from "@/server/ai/types";
import { getClientIdentifier } from "@/lib/rate-limit/identifier";
import { rateLimiter } from "@/lib/rate-limit/rate-limiter";

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const messages = body.messages as ChatMessage[];

        if (!Array.isArray(messages) || messages.length === 0) {
            return NextResponse.json(
                { error: "messages can not be a empty array" },
                { status: 400 }
            )
        }

        if (messages.length > 50) {
            return NextResponse.json(
                { error: "Too many messages" },
                { status: 400 }
            );
        }


        // 1. Identify client
        const identifier = getClientIdentifier(req);

        // 2. Check rate limit
        const result = await rateLimiter.limit(identifier);

        // Provide a safe fallback timestamp (e.g., 60 seconds from now) if resetAt is missing
        const resetTime = result?.resetAt ? new Date(result.resetAt) : new Date(Date.now() + 60000);

        // Format the date object into a clean "12-hour AM/PM" format
        const localizedTime = resetTime.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        });

        // 3. Reject if limit exceeded
        if (!result.allowed) {
            return NextResponse.json(
                {
                    error: `Too many requests, try after ${localizedTime}`,
                    retryAfter: Math.ceil(
                        (result?.resetAt - Date.now()) / 1000
                    ),
                },
                {
                    status: 429,
                }
            );
        }

        const ai = await getAIProvider();
        //for json - one time response
        // const content = await ai.generateReply(messages);
        // return NextResponse.json({ content })

        // `req.signal` is the Web-standard AbortSignal for this request. the moment the client disconnects 
        // — Stop button clicked, tab/browser closed, or the network connection just drops. We hand it straight to 
        // the provider so it can cancel the upstream Gemini call instead of letting it run to completion for nobody.
        const stream = await ai.generateReplyStream(messages, { signal: req.signal });
        return new Response(stream, {
            headers: {
                "Content-Type": "text/plain",
                "Cache-Control": "no-cache",
            }
        });
    } catch (error) {
        if (req.signal.aborted || (error instanceof DOMException && error.name === "AbortError")) {
            // it isn't a failure, it's an intentional cancel.
            return new Response(null, { status: 499 });
        }

        console.error("[api/chat]", error);
        return NextResponse.json(
            { error: "Failed to generate reply" },
            { status: 500 }
        );
    }
}