import type { PreviewSnapshot } from "@/lib/domain/preview";

export function ActivityLog({ activity }: { activity: PreviewSnapshot["activity"] }) {
  return (
    <section className="border-b border-obsidian/15 px-5 py-10 sm:px-8 sm:py-12">
      <div className="mx-auto grid max-w-[1600px] gap-8 lg:grid-cols-12">
        <div className="lg:col-span-4">
          <p className="mono-label text-rust">06 / Recent activity</p>
          <h2 className="mt-4 text-2xl font-semibold leading-tight tracking-tight sm:text-3xl">
            A ledger of movements.
          </h2>
          <p className="mt-5 max-w-sm text-xs leading-6 text-obsidian/55">
            Preview events shown in reverse chronological order. Event logging is not yet connected.
          </p>
        </div>
        <ol className="border-l border-obsidian/15 pl-6 lg:col-span-8">
          {activity.map((event) => (
            <li key={event.id} className="relative pb-6 last:pb-0">
              <span className="absolute -left-[1.6rem] top-1.5 h-2 w-2 bg-forest" aria-hidden="true" />
              <div className="flex flex-col gap-2 sm:flex-row sm:items-baseline sm:gap-6">
                <time className="w-14 shrink-0 font-mono text-xs text-machine tabular">{event.time}</time>
                <div>
                  <p className="text-sm font-medium">{event.title}</p>
                  <p className="mt-1 font-mono text-[10px] uppercase tracking-label text-machine">
                    {event.detail}
                  </p>
                </div>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
