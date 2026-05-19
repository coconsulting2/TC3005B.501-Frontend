import { useRef, useState, useEffect } from "react";


export interface LiveDataOptions<T> {
    url: string;
    token: string;
    onError?: (error: Error) => void;
    parse?: (raw: string) => T;
}

/**
 * Custom hook for streaming live data via Server-Sent Events
 */
export function useLiveData<T = unknown>({
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

        start().then();
        return () => controller.abort();
    }, [url, token]);

    return data;
}
