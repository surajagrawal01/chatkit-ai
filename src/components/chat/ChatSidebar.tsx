export interface ChatSummary {
    id: string;
    title: string;
    updatedAt: Date | string;
    messageCount: number;
}

interface ChatSidebarProps {
    chats: ChatSummary[];
    activeChatId: string | null;
    onSelectChat: (chatId: string) => void;
    onNewChat: () => void;
    loading: boolean;
}

export function ChatSidebar({
    chats,
    activeChatId,
    onSelectChat,
    onNewChat,
    loading,
}: ChatSidebarProps) {
    return (
        <aside className="flex h-full w-80 shrink-0 flex-col border-r border-zinc-800 bg-zinc-950/70">
            <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-4">
                <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-400">
                    Chats
                </h2>
                <button
                    type="button"
                    onClick={onNewChat}
                    className="rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm text-zinc-200 transition hover:border-zinc-500 hover:bg-zinc-800"
                >
                    New
                </button>
            </div>

            <div className="flex-1 overflow-y-auto px-3 py-3">
                {loading ? (
                    <div className="space-y-2">
                        {[1, 2, 3].map(item => (
                            <div key={item} className="h-12 animate-pulse rounded-xl bg-zinc-800/80" />
                        ))}
                    </div>
                ) : chats.length === 0 ? (
                    <div className="mt-6 rounded-xl border border-dashed border-zinc-700 bg-zinc-900/60 p-4 text-sm text-zinc-400">
                        No chats yet. Start a new conversation.
                    </div>
                ) : (
                    <div className="space-y-2">
                        {chats.map(chat => {
                            const isActive = chat.id === activeChatId;

                            return (
                                <button
                                    key={chat.id}
                                    type="button"
                                    onClick={() => onSelectChat(chat.id)}
                                    className={`w-full rounded-xl border px-3 py-3 text-left transition ${isActive
                                            ? "border-blue-500/60 bg-blue-500/10 text-white"
                                            : "border-transparent bg-zinc-900/70 text-zinc-200 hover:border-zinc-700 hover:bg-zinc-900"
                                        }`}
                                >
                                    <div className="truncate text-sm font-medium">{chat.title || "New chat"}</div>
                                    <div className="mt-1 flex items-center justify-between text-[11px] text-zinc-400">
                                        <span>{chat.messageCount} messages</span>
                                        <span>
                                            {new Date(chat.updatedAt).toLocaleDateString(undefined, {
                                                month: "short",
                                                day: "numeric",
                                            })}
                                        </span>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>
        </aside>
    );
}
