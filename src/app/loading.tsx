import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Loading factory overview">
      <div className="border-b border-obsidian/15 px-5 py-14 sm:px-8">
        <div className="mx-auto grid max-w-[1600px] gap-10 lg:grid-cols-12">
          <div className="lg:col-span-8">
            <Skeleton className="h-4 w-52" />
            <Skeleton className="mt-8 h-20 w-full max-w-3xl sm:h-28" />
            <Skeleton className="mt-4 h-20 w-4/5 max-w-2xl sm:h-28" />
          </div>
          <div className="space-y-4 lg:col-span-4">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-10 w-2/3" />
            <Skeleton className="h-10 w-1/2" />
            <Skeleton className="h-16 w-full" />
          </div>
        </div>
      </div>
      <div className="grid lg:grid-cols-12">
        <div className="space-y-4 px-5 py-10 sm:px-8 lg:col-span-4">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </div>
        <div className="flex h-64 items-end gap-2 px-5 py-10 sm:px-8 lg:col-span-8">
          {[42, 58, 51, 70, 63, 78, 55, 66, 47, 60, 39, 52].map((height, index) => (
            <Skeleton key={index} className="flex-1" style={{ height: `${height}%` }} />
          ))}
        </div>
      </div>
      <div className="space-y-4 border-t border-obsidian/15 px-5 py-10 sm:px-8">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-5/6" />
        <Skeleton className="h-12 w-3/4" />
      </div>
    </div>
  );
}
