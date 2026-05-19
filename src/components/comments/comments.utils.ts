import { resolveApiBaseUrl } from "@utils/apiClient.ts";
import React from "react";

interface Comment {
    pageIndex: number;
    at: string;
    user_key: number | string;
    content: string;
}

interface RequestComments {
    users: Record<string, { name: string; role: string }>;
    next?: string;
    messages: Comment[];
}

type ChatGroup = {
    send: boolean;
    name?: string;
    role?: string;
    messages: Comment[];
};

export type {
    Comment,
    RequestComments,
    ChatGroup
}


/**
 * Format datetime to HH:MM
 */
export function formatTime(date: string): string {
    const d = new Date(date);
    const hours = d.getHours().toString().padStart(2, '0');
    const minutes = d.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
}

/**
 * Groups consecutive messages from the same sender
 */
export function groupMessages(
    messages: Comment[],
    users: RequestComments['users'],
    currentUserId: number | string
): ChatGroup[] {
    return messages.reduce<ChatGroup[]>((groups, message) => {
        const send = message.user_key === currentUserId;
        const previous = groups.at(-1);
        const user = users[String(message.user_key)];

        if (previous && previous.send === send && previous.name === user?.name && previous.role === user?.role) {
            previous.messages.push(message);
            return groups;
        }

        groups.push({
            send,
            name: user?.name,
            role: user?.role,
            messages: [message],
        });

        return groups;
    }, []);
}
