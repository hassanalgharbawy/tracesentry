import { AlertCircle } from "lucide-react";

export function ErrorNotice({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-100">
      <div className="flex gap-3">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-300" aria-hidden="true" />
        <p className="leading-6">{message}</p>
      </div>
    </div>
  );
}
