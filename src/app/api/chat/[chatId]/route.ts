import { NextResponse } from "next/server";
import { getChatById, toChatMessageFromDb } from "@/server/services/chat.service";

export async function GET(
    _req: Request,
    { params }: { params: Promise<{ chatId: string }> }
) {
    try {
        const { chatId } = await params;
        const chat = await getChatById(chatId);

        if (!chat) {
            return NextResponse.json({ error: "Chat not found" }, { status: 404 });
        }

        return NextResponse.json({
            chatId: chat.id,
            title: chat.title,
            messages: chat.messages.map(toChatMessageFromDb),
        });
    } catch (error) {
        console.error("[api/chat/[chatId]]", error);
        return NextResponse.json({ error: "Failed to load chat" }, { status: 500 });
    }
}
