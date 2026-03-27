import { Skeleton } from './ui/skeleton';

interface LoadingSkeletonProps {
    count?: number;
}

export function LoadingSkeleton({ count = 3 }: LoadingSkeletonProps) {
    return (
        <>
            {Array.from({ length: count }).map((_, index) => (
                <div
                    key={index}
                    className="bg-white rounded-[12px] p-4 border border-gray-200"
                >
                    <div className="space-y-3">
                        <Skeleton className="h-5 w-3/4" />
                        <Skeleton className="h-4 w-1/2" />
                        <div className="flex gap-3">
                            <Skeleton className="h-4 w-20" />
                            <Skeleton className="h-4 w-20" />
                            <Skeleton className="h-4 w-16" />
                        </div>
                    </div>
                </div>
            ))}
        </>
    );
}
