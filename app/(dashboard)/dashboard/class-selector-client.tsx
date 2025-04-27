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

    // Get the current classId from URL search params
    const currentClassId = searchParams.get('classId');

    // Determine the default/selected value for the dropdown
    // Prioritize URL param, then first taught class, then first available class
    const [selectedValue, setSelectedValue] = useState<string>(() => {
        if (currentClassId && allTeamClasses.some(c => c.id.toString() === currentClassId)) {
            return currentClassId;
        }
        if (userTaughtClasses.length > 0) {
            return userTaughtClasses[0].id.toString();
        }
        if (allTeamClasses.length > 0) {
            return allTeamClasses[0].id.toString();
        }
        return ''; // Should not happen if component rendered
    });

    // Effect to update selectedValue if URL changes externally
    useEffect(() => {
        const classIdFromUrl = searchParams.get('classId');
        if (classIdFromUrl && allTeamClasses.some(c => c.id.toString() === classIdFromUrl)) {
            if (classIdFromUrl !== selectedValue) {
                setSelectedValue(classIdFromUrl);
            }
        } else {
             // If URL param is invalid or missing, maybe reset to default?
             // Or keep current selection? Let's keep current selection for now.
             // Consider if resetting to default is better UX.
        }
    }, [searchParams, allTeamClasses, selectedValue]);

    const handleClassChange = (newClassIdString: string) => {
        if (!newClassIdString || newClassIdString === selectedValue) return;

        setSelectedValue(newClassIdString); // Optimistic update

        startTransition(() => {
            const newSearchParams = new URLSearchParams(searchParams.toString());
            newSearchParams.set('classId', newClassIdString);
            // Preserve other search params (like 'week')
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
                            <SelectItem key={cls.id} value={cls.id.toString()}>
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
                        <SelectItem key={cls.id} value={cls.id.toString()}>
                            {cls.name}
                        </SelectItem>
                    ))
                }
            </SelectContent>
        </Select>
    );
} 