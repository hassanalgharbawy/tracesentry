export function LoadingState({ label = "Loading telemetry..." }: { label?: string }) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-6">
      <div className="flex items-center gap-3">
        <span className="h-2.5 w-2.5 rounded-full bg-cyan-300" />
        <p className="text-sm font-medium text-zinc-300">{label}</p>
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <span className="h-16 rounded-md bg-zinc-800/70" />
        <span className="h-16 rounded-md bg-zinc-800/60" />
        <span className="h-16 rounded-md bg-zinc-800/50" />
      </div>
    </div>
  );
}
