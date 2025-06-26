'use client';

import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from "@/components/ui/select";
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';
import type { SimpleClass } from './class-selector'; // Import the type

interface ClassSelectorClientProps {
    userTaughtClasses: SimpleClass[];
    allTeamClasses: SimpleClass[];
}

export function ClassSelectorClient({ 
    userTaughtClasses, 
    allTeamClasses 
}: ClassSelectorClientProps) {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const [isPending, startTransition] = useTransition();

    const [selectedValue, setSelectedValue] = useState<string>(() => {
        const classIdFromUrl = searchParams.get('classId');
        if (classIdFromUrl && allTeamClasses.some(c => c.id === classIdFromUrl)) {
            return classIdFromUrl;
        }
        if (userTaughtClasses.length > 0) {
            return userTaughtClasses[0].id;
        }
        if (allTeamClasses.length > 0) {
            return allTeamClasses[0].id;
        }
        return ''; // Should not happen if component rendered
    });

    // Effect to synchronize URL with default selection on initial load if needed
    useEffect(() => {
        const classIdFromUrl = searchParams.get('classId');
        // If URL has no classId, but we have a valid default selectedValue
        if (!classIdFromUrl && selectedValue && allTeamClasses.some(c => c.id === selectedValue)) {
            startTransition(() => {
                const newSearchParams = new URLSearchParams(searchParams.toString());
                newSearchParams.set('classId', selectedValue);
                // Replace the URL state instead of pushing a new entry
                // to avoid back-button confusion on initial load.
                router.replace(`${pathname}?${newSearchParams.toString()}`, { scroll: false }); 
            });
        }
        // Run only once when selectedValue is determined or searchParams change initially
    }, [selectedValue, searchParams, pathname, router, allTeamClasses]);

    // Effect to update selectedValue if URL changes externally (e.g., back/forward)
    useEffect(() => {
        const classIdFromUrl = searchParams.get('classId');
        if (classIdFromUrl && allTeamClasses.some(c => c.id === classIdFromUrl)) {
            if (classIdFromUrl !== selectedValue) {
                setSelectedValue(classIdFromUrl);
            }
        } 
        // We don't necessarily need an else here now, because the initial load effect
        // should handle setting the URL if it was missing.
    }, [searchParams, allTeamClasses, selectedValue]); // Keep selectedValue dependency?

    const handleClassChange = (newClassIdString: string) => {
        if (!newClassIdString || newClassIdString === selectedValue) return;

        setSelectedValue(newClassIdString); // Optimistic update

        startTransition(() => {
            const newSearchParams = new URLSearchParams(searchParams.toString());
            newSearchParams.set('classId', newClassIdString);
            router.push(`${pathname}?${newSearchParams.toString()}`);
        });
    };

    return (
        <Select
            value={selectedValue}
            onValueChange={handleClassChange}
            disabled={isPending}
        >
            <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Select Class..." />
            </SelectTrigger>
            <SelectContent>
                {/* Optionally group taught classes first */}
                {userTaughtClasses.length > 0 && (
                    <>
                        <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">My Classes</div>
                        {userTaughtClasses.map((cls) => (
                            <SelectItem key={cls.id} value={cls.id}>
                                {cls.name}
                            </SelectItem>
                        ))}
                        <div className="my-1 h-px bg-muted"></div> {/* Separator */}
                        <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">Other Team Classes</div>
                    </>
                )}
                {allTeamClasses
                    .filter(cls => !userTaughtClasses.some(taught => taught.id === cls.id)) // Filter out already listed taught classes
                    .map((cls) => (
                        <SelectItem key={cls.id} value={cls.id}>
                            {cls.name}
                        </SelectItem>
                    ))
                }
            </SelectContent>
        </Select>
    );
} 