/**
 * @file CommentsThread.tsx
 * @description Main comments thread component for requests with editorial design styling
 */

import React, { type ChangeEvent, type RefObject, useEffect, useMemo, useRef, useState } from 'react';
import { apiRequest, resolveApiBaseUrl } from '@utils/apiClient';
import CommentMessage from './CommentMessage';
import CommentMessageGroup from './CommentMessageGroup';
import CommentInput from './CommentInput';
import CommentLoading from './CommentLoading';
import { useLiveData } from "@utils/useLiveData.hook.ts";
import { groupMessages, formatTime, type ChatGroup } from "@components/comments/comments.utils.ts";
import type { RequestComments } from "@components/comments/comments.utils.ts";
import Error from "./Error.tsx";


interface EventResponse {
    success: boolean;
    next?: string;
    data: RequestComments;
}

type PendingMessage = {
    id: string;
    msg: string;
    posted: boolean;
    refreshesAfterPost: number;
};

interface CommentsThreadProps {
    requestId: number;
    name: string;
    currentUserId: number;
    authToken: string;
    apiBaseUrl?: string;
    commentsLoadLimit?: number;
}

interface EDEs {
    msg: string
    path: string
    type: string
    value: string
}

interface ErrorDatils {
    response?: {
        error?: Object
        errors?: EDEs[]
    }
}

/**
 * Main CommentsThread component
 */
export default function CommentsThread({
                                           requestId,
                                           name,
                                           currentUserId,
                                           authToken,
                                           commentsLoadLimit,
                                           apiBaseUrl = resolveApiBaseUrl(),
                                       }: CommentsThreadProps): React.ReactElement {

    const limit: number = commentsLoadLimit ?? 10;
    const streamUrl = `${apiBaseUrl}/solicitudes/${requestId}/comments/stream?user_id=${currentUserId}&limit=${limit}`;
    const loadUrl = `/solicitudes/${requestId}/comments?user_id=${currentUserId}&limit=${limit}`;

    const data: RequestComments | null = useLiveData({
        url: streamUrl,
        token: authToken,
        parse: (raw) => {
            const json: EventResponse = JSON.parse(raw);
            json.data.messages.reverse();
            json.data.next = json.next;
            return json.data;
        },
    });

    const groupedMessages: ChatGroup[] = useMemo(() => (data ? groupMessages(data.messages, data.users, currentUserId) : []), [data, currentUserId]);

    const [pendingMessages, setPendingMessages] = useState<PendingMessage[]>([]);
    const [msg, setMsg] = useState('');
    const [newMessageAlert, setNewMessageAlert] = useState(false);
    const containerRef: RefObject<HTMLDivElement | null> = useRef(null);
    const prevDataSignature: RefObject<string | null> = useRef(null);
    const [error, setError] = useState<string | null>(null);
    const [loadMsg, setLoadMsg] = useState<string>("Load more comments");

    const scrollBottom = () => {
        if (!containerRef.current) return;
        containerRef.current.scroll({
            top: containerRef.current.scrollHeight + 100,
            behavior: 'smooth',
        });
    };

    useEffect(() => {
        if (!data) return;

        const signature = JSON.stringify({
            users: data.users,
            messages: data.messages.map(({pageIndex, at, user_key, content}) => ({
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
                        message.posted ? {...message, refreshesAfterPost: message.refreshesAfterPost + 1} : message
                    )
                    .filter((message) => !(message.posted && message.refreshesAfterPost >= 2))
            );
        }
    }, [data]);

    const handleSendMessage = async (event: React.KeyboardEvent<HTMLInputElement>) => {
        if (event.key !== 'Enter') return;

        const content = msg.trim();
        if (!content) return;

        const id = crypto.randomUUID();
        setPendingMessages((prev) => {
            setTimeout(scrollBottom, 50);
            return [...prev, {id, msg: content, posted: false, refreshesAfterPost: 0}];
        });
        setMsg('');

        try {
            await apiRequest(`/solicitudes/${requestId}/comments`, {
                method: 'POST',
                data: {
                    user_id: currentUserId,
                    content,
                },
                headers: {Authorization: `Bearer ${authToken}`, credentials: "include"},
            });

            setPendingMessages((prev) => prev.map((message) => (message.id === id ? {
                ...message,
                posted: true
            } : message)));
        } catch (err: unknown) {
            let messageText: string = 'No se pudo enviar el comentario';
            if (err && typeof err === 'object' && 'detail' in err) {
                const detail: ErrorDatils | undefined = (err as { detail?: { response?: { error?: string } } }).detail;
                const apiErr: Object | undefined = detail?.response?.error || detail?.response?.errors?.map((e: EDEs) => e.msg);
                if (apiErr) messageText = String(apiErr);
            } else if (err instanceof Error) {
                // @ts-ignore
                messageText = err.message;
            }

            setError(messageText);
            setPendingMessages((prev) => prev.filter((m) => m.id !== id));
            setMsg(content);
        }
    };

    const handleChangeInput = (e: ChangeEvent) => {
        setError(null);
        // @ts-ignore
        setMsg(e?.target?.value);
    };


    // const [allData, setAllData] = useState({users: {}, messages: []});
    const handleLoading = () => {
        setLoadMsg("Loading...");

        console.log(data);
        apiRequest(`${loadUrl}&cursor=${data?.next}`, {headers: {Authorization: `Bearer ${authToken}`}})
            .then((d) => {
                // setAllData(prev => {
                //     let newData = {};
                //
                //     newData.users = {...prev.users, ...d.users}
                //     newData.messages = [...d.comments.messages, ...prev.messages];
                //
                //     return newData;
                // });
                console.log(data, d)
                setLoadMsg("Load more comments");
            });
    }
    //
    // useEffect(() => {
    //     setAllData(prev => {
    //         let newData = {};
    //
    //         newData.users = {...prev.users, ...data?.users}
    //         newData.messages = [...data?.messages, ...prev.messages];
    //
    //         return newData;
    //     });
    // }, [data]);

    return (
        <div className="flex flex-col h-full bg-white rounded-lg border border-neutral-200">
            <div className="px-6 py-4 border-b border-neutral-200 bg-surface-white">
                <h3 className="text-lg font-serif font-editorial text-ink">Comentarios de la solicitud</h3>
            </div>

            <div ref={containerRef}
                 className="min-h-100 min-w-0 max-h-100 flex-1 flex flex-col space-y-6 overflow-y-scroll px-6 py-4 scrollable">
                {!data && <CommentLoading/>}
                {data?.next && (<button
                    className="
                            max-w-fit border border-neutral-300 rounded-lg
                            bg-surface-white text-ink placeholder:text-ink-muted
                            hover:cursor-pointer mx-auto
                            active:outline-none active:ring-2 active:ring-primary-500
                            active:border-primary-500 transition-colors duration-200
                            disabled:opacity-50 disabled:cursor-not-allowed
                            border-t mb-4 mt-0 py-3 px-4
                    "
                    onClick={handleLoading}
                >
                    {loadMsg}
                </button>)}

                {groupedMessages.map((group, groupIndex) => (
                    <CommentMessageGroup
                        key={`${groupIndex}:${group.send ? name : group.name ?? 'user'}`}
                        send={group.send}
                        name={group.name ?? name}
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
                    <CommentMessageGroup send={true} name={name} loading={true}>
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
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-white" viewBox="0 0 24 24"
                             fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
                             strokeLinejoin="round">
                            <polyline points="6 9 12 15 18 9"/>
                        </svg>
                    </button>
                )}
            </div>

            {error && <Error error={error}/>}

            <CommentInput id="1" onKeyDown={handleSendMessage} onChange={handleChangeInput} value={msg}/>
        </div>
    );
}

