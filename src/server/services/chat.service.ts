import { prisma } from "@/lib/db";

export type ChatRole = "user" | "assistant" | "system";

export interface PersistedChat {
    id: string;
    title: string;
    createdAt: Date;
    updatedAt: Date;
    deletedAt: Date | null;
}

export async function listChats() {
    return prisma.chat.findMany({
        where: { deletedAt: null },
        orderBy: { updatedAt: "desc" },
        include: {
            messages: {
                orderBy: { createdAt: "asc" },
            },
        },
    });
}

export async function getChatById(chatId: string) {
    return prisma.chat.findUnique({
        where: { id: chatId },
        include: { messages: { orderBy: { createdAt: "asc" } } },
    });
}

export async function getChatMessages(chatId: string) {
    const chat = await getChatById(chatId);
    return chat?.messages ?? [];
}

export async function createChat(input?: { title?: string; firstMessage?: string }) {
    const firstMessage = input?.firstMessage?.trim();

    const chat = await prisma.chat.create({
        data: {
            title: input?.title ?? (firstMessage ? buildTitleFromText(firstMessage) : "New chat"),
        },
    });

    if (firstMessage) {
        await prisma.message.create({
            data: {
                chatId: chat.id,
                role: "user",
                content: firstMessage,
            },
        });

        await prisma.chat.update({
            where: { id: chat.id },
            data: { updatedAt: new Date() },
        });
    }

    return chat;
}

export async function saveMessage(chatId: string, role: ChatRole, content: string) {
    const trimmed = content.trim();
    if (!trimmed) {
        return null;
    }

    const message = await prisma.message.create({
        data: {
            chatId,
            role,
            content: trimmed,
        },
    });

    await prisma.chat.update({
        where: { id: chatId },
        data: { updatedAt: new Date() },
    });

    return message;
}

export async function saveUserMessage(chatId: string, content: string) {
    return saveMessage(chatId, "user", content);
}

export async function saveAssistantMessage(chatId: string, content: string) {
    return saveMessage(chatId, "assistant", content);
}

export async function ensureChatTitle(chatId: string, fallbackText?: string) {
    const chat = await prisma.chat.findUnique({
        where: { id: chatId },
        select: { title: true, messages: { orderBy: { createdAt: "asc" }, take: 1 } },
    });

    if (!chat) {
        return null;
    }

    if (chat.title !== "New chat") {
        return chat.title;
    }

    const candidate = fallbackText?.trim() ?? chat.messages[0]?.content?.trim();
    if (!candidate) {
        return chat.title;
    }

    const newTitle = buildTitleFromText(candidate);

    await prisma.chat.update({
        where: { id: chatId },
        data: { title: newTitle },
    });

    return newTitle;
}

export function buildTitleFromText(text: string) {
    const cleaned = text.replace(/\s+/g, " ").trim();
    return cleaned.length > 40 ? `${cleaned.slice(0, 37).trim()}...` : cleaned || "New chat";
}

export function toChatMessageFromDb(message: { role: string; content: string; id: string }) {
    const role: ChatRole =
        message.role === "assistant"
            ? "assistant"
            : message.role === "system"
                ? "system"
                : "user";

    return {
        id: message.id,
        role,
        content: message.content,
        status: "done" as const,
    };
}
