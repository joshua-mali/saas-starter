import { getTeacherClasses, getTeamClasses, getUserTeam } from '@/app/actions/get-classes';
import { createClient } from '@/lib/supabase/server';
import { ClassSelectorClient } from './class-selector-client'; // Client component for handling interaction

export type SimpleClass = { id: string; name: string };

async function ClassSelector() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return null; // No user, don't render selector
    }

    const userTeamId = await getUserTeam(user.id);
    if (!userTeamId) {
        console.error("[ClassSelector] User is not part of any team.");
        return null; // No team, don't render selector
    }

    // Fetch classes concurrently
    const [userTaughtClasses, allTeamClasses] = await Promise.all([
        getTeacherClasses(user.id),
        getTeamClasses(userTeamId)
    ]);

    if (allTeamClasses.length === 0) {
        return null; // No classes in the team to select
    }

    return (
        <ClassSelectorClient 
            userTaughtClasses={userTaughtClasses}
            allTeamClasses={allTeamClasses}
        />
    );
}

export default ClassSelector; 