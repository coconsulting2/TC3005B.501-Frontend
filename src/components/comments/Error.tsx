export interface ErrorProps {
    error: string;
}

export default function ({error}: ErrorProps) {
    return <div
        className="px-6 py-3 bg-error-50 border-t border-error-200 text-error-500 text-sm"
    >
        {error}
    </div>
}