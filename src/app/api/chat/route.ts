import { NextResponse } from "next/server";
import { getAIProvider } from "@/server/ai/provider";
import type { ChatMessage } from "@/server/ai/types";

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

        const ai = await getAIProvider();
        const content = await ai.generateReply(messages);
        return NextResponse.json({ content })
    } catch (error) {
        console.error("[api/chat]", error);
        return NextResponse.json(
            { error: "Failed to generate reply" },
            { status: 500 }
        );
    }
}