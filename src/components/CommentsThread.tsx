/**
 * @file CommentsThread.tsx
 * @description Main comments thread component for requests with editorial design styling
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { resolveApiBaseUrl } from '@utils/apiClient';
import CommentMessage from './CommentMessage';
import CommentMessageGroup from './CommentMessageGroup';
import CommentInput from './CommentInput';
import CommentLoading from './CommentLoading';

interface LiveDataOptions<T> {
  url: string;
  token: string;
  onError?: (error: Error) => void;
  parse?: (raw: string) => T;
}

interface Comment {
  pageIndex: number;
  at: string;
  user_key: number | string;
  content: string;
}

interface RequestComments {
  users: Record<string, { name: string; role: string }>;
  messages: Comment[];
}

interface EventResponse {
  success: boolean;
  data: RequestComments;
}

type ChatGroup = {
  send: boolean;
  name?: string;
  role?: string;
  messages: Comment[];
};

type PendingMessage = {
  id: string;
  msg: string;
  posted: boolean;
  refreshesAfterPost: number;
};

/**
 * Custom hook for streaming live data via Server-Sent Events
 */
function useLiveData<T = unknown>({
  url,
  token,
  onError,
  parse = JSON.parse,
}: LiveDataOptions<T>): T | null {
  const [data, setData] = useState<T | null>(null);
  const parseRef = useRef(parse);
  const onErrorRef = useRef(onError);
  parseRef.current = parse;
  onErrorRef.current = onError;

  useEffect(() => {
    const controller = new AbortController();

    async function start(): Promise<void> {
      let res: Response;

      try {
        res = await fetch(url, {
          signal: controller.signal,
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch (e) {
        if ((e as Error).name !== 'AbortError') {
          onErrorRef.current?.(e as Error);
        }
        return;
      }

      if (!res.ok) {
        onErrorRef.current?.(new Error(`HTTP ${res.status}: ${res.statusText}`));
        return;
      }

      if (!res.body) {
        onErrorRef.current?.(new Error('Response body is null'));
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });

          for (const line of chunk.split('\n')) {
            if (!line.startsWith('data: ')) continue;
            const raw = line.slice(6).trim();
            if (!raw || raw === '[DONE]') continue;

            try {
              setData(parseRef.current(raw) as T);
            } catch (parseError) {
              onErrorRef.current?.(parseError as Error);
            }
          }
        }
      } catch (e) {
        if ((e as Error).name !== 'AbortError') {
          onErrorRef.current?.(e as Error);
        }
      } finally {
        reader.releaseLock();
      }
    }

    start();
    return () => controller.abort();
  }, [url, token]);

  return data;
}

/**
 * Groups consecutive messages from the same sender
 */
function groupMessages(
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

/**
 * Format datetime to HH:MM
 */
function formatTime(date: string): string {
  const d = new Date(date);
  const hours = d.getHours().toString().padStart(2, '0');
  const minutes = d.getMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}

interface CommentsThreadProps {
  requestId: number;
  currentUserId: number;
  authToken: string;
  apiBaseUrl?: string;
}

/**
 * Main CommentsThread component
 */
export default function CommentsThread({
  requestId,
  currentUserId,
  authToken,
  apiBaseUrl = resolveApiBaseUrl(),
}: CommentsThreadProps): React.ReactElement {
  const streamUrl = `${apiBaseUrl}/solicitudes/${requestId}/comments/stream?user_id=${currentUserId}&limit=200`;

  const data: RequestComments | null = useLiveData({
    url: streamUrl,
    token: authToken,
    parse: (raw) => {
      const json: EventResponse = JSON.parse(raw);
      json.data.messages.reverse();
      return json.data;
    },
  });

  const groupedMessages = useMemo(() => (data ? groupMessages(data.messages, data.users, currentUserId) : []), [data, currentUserId]);

  const [pendingMessages, setPendingMessages] = useState<PendingMessage[]>([]);
  const [msg, setMsg] = useState('');
  const [newMessageAlert, setNewMessageAlert] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const prevDataSignature = useRef<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const scrollBottom = () => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (!data) return;

    const signature = JSON.stringify({
      users: data.users,
      messages: data.messages.map(({ pageIndex, at, user_key, content }) => ({
        pageIndex,
        at,
        user_key,
        content,
      })),
    });

    if (prevDataSignature.current === null) {
      prevDataSignature.current = signature;
      return;
    }

    if (prevDataSignature.current !== signature) {
      prevDataSignature.current = signature;
      setNewMessageAlert(true);
      setPendingMessages((prev) =>
        prev
          .map((message) =>
            message.posted ? { ...message, refreshesAfterPost: message.refreshesAfterPost + 1 } : message
          )
          .filter((message) => !(message.posted && message.refreshesAfterPost >= 2))
      );
    }
  }, [data]);

  useEffect(() => {
    scrollBottom();
  }, [pendingMessages]);

  const handleSendMessage = async (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter') return;

    const id = crypto.randomUUID();
    setPendingMessages((prev) => [...prev, { id, msg, posted: false, refreshesAfterPost: 0 }]);
    setMsg('');

    try {
      const postUrl = `${apiBaseUrl}/solicitudes/${requestId}/comments`;
      const response = await fetch(postUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          user_id: currentUserId,
          content: msg,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to send comment');
      }

      setPendingMessages((prev) => prev.map((message) => (message.id === id ? { ...message, posted: true } : message)));
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-lg border border-neutral-200">
      {/* Header */}
      <div className="px-6 py-4 border-b border-neutral-200 bg-surface-white">
        <h3 className="text-lg font-serif font-editorial text-ink">Comentarios de la solicitud</h3>
      </div>

      {/* Messages Container */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
        {!data && <CommentLoading />}

        {groupedMessages.map((group, groupIndex) => (
          <CommentMessageGroup
            key={`${groupIndex}:${group.send ? 'me' : group.name ?? 'user'}`}
            send={group.send}
            name={group.name}
            role={group.role}
          >
            {group.messages.map((m) => (
              <CommentMessage key={m.pageIndex} time={formatTime(m.at)}>
                {m.content}
              </CommentMessage>
            ))}
          </CommentMessageGroup>
        ))}

        {pendingMessages.length > 0 && (
          <CommentMessageGroup send={true} loading={true}>
            {pendingMessages.map((m) => (
              <CommentMessage key={m.id} time={formatTime(new Date().toISOString())}>
                {m.msg}
              </CommentMessage>
            ))}
          </CommentMessageGroup>
        )}

        {newMessageAlert && (
          <button
            onClick={() => {
              scrollBottom();
              setNewMessageAlert(false);
            }}
            aria-label="Scroll to bottom"
            className="fixed bottom-32 right-8 z-50 w-10 h-10 rounded-full bg-primary-500 border border-primary-400 shadow-md flex items-center justify-center hover:bg-primary-400 active:scale-95 hover:cursor-pointer transition-all"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Error Display */}
      {error && (
        <div className="px-6 py-3 bg-error-50 border-t border-error-200 text-error-500 text-sm">{error}</div>
      )}

      {/* Input Footer */}
      <div className="border-t border-neutral-200 px-6 py-4 bg-surface-white">
        <CommentInput onKeyDown={handleSendMessage} value={msg} onChange={(e) => setMsg(e.target.value)} />
      </div>
    </div>
  );
}

