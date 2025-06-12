# App To Do List

## P1: Critical Bugs & UI Issues

1.  **DONE - Class Dropdown on Home Page:**
    *   ~~Investigate why the class dropdown appears on `/`.~~
    *   ~~Ensure it's only rendered on pages where it's needed (e.g., dashboard pages).~~ *(Resolved by conditional rendering based on `pathname.startsWith('/dashboard')` excluding `/dashboard` itself)*
2.  **DONE - Signup Feedback:**
    *   ~~Modify signup logic (`app/(login)/actions.ts`) to check if an email already exists.~~
    *   ~~Provide clear feedback to the user if the account exists, suggesting sign-in instead.~~ *(Resolved using RPC call to check email before signup)*
3.  **Grading Page Week Navigation Buttons:**
    *   Debug the `handlePreviousWeek` and `handleNextWeek` functions in `app/(dashboard)/dashboard/grading/client.tsx`.
    *   Fix the logic for disabling/enabling buttons and correct week navigation. *(Still outstanding - left arrow disabled, right arrow navigates incorrectly despite server-side fallback logic changes).*
4.  **Students Page Class Selection:**
    *   Remove the local 'Select Class' dropdown from `app/(dashboard)/dashboard/students/client.tsx`.
    *   Ensure the page correctly uses the global class selector state.
5.  **Classes Page Stage Dropdown Format:**
    *   Locate the stage selection dropdown in `app/(dashboard)/dashboard/classes/client.tsx`.
    *   Remove the empty parentheses `()` from the displayed stage options.
6.  **User Menu Dropdown Persistence:** *(NEW)*
    *   Investigate why the user menu dropdown in the header remains open after clicking the "Dashboard" link within it.
    *   Ensure the dropdown closes upon navigation or item selection.

## P2: Core Functionality Enhancements

7.  **Persist Global Class ID in URL:** *(NEW)*
    *   Update the global class selector (`app/(dashboard)/dashboard/class-selector-client.tsx`) to append/update the `classId` query parameter in the URL upon selection.
    *   Modify relevant page components (Planning, Grading, Students) to read `classId` primarily from the URL search parameters.
    *   Ensure navigation between these pages preserves the selected `classId` in the URL.
8.  **Class-Specific Grading Scale:**
    *   Update database schema: Add a table for `class_grading_scales` linking scales/display names to `classes`. Remove/deprecate team-level scale settings if necessary.
    *   Modify backend logic (`app/(dashboard)/dashboard/settings/actions.ts`?) to manage class-specific scales.
    *   Update the settings page (`app/(dashboard)/dashboard/settings/page.tsx`) UI to allow editing scales per class.
    *   Adjust grading page (`app/(dashboard)/dashboard/grading/client.tsx`) to fetch and use the correct class-specific scale.
9.  **Grading Notes:**
    *   Update database schema: Add a `notes` column (text type) to the `student_assessments` table or create a separate `assessment_notes` table linking to `student_assessments`.
    *   Modify grading page UI (`app/(dashboard)/dashboard/grading/client.tsx`):
        *   Add a text input/textarea associated with each grade input.
        *   Implement saving/updating notes via actions (`app/(dashboard)/dashboard/grading/actions.ts`).
        *   Add a visual indicator (e.g., icon) to grades that have notes.
10. **Display Pending Invites:**
    *   Modify backend logic to fetch pending invites for the current team/account.
    *   Update the team members/settings section (`app/(dashboard)/dashboard/team-settings.tsx`?) to display pending invites.
    *   Implement functionality (action and UI button) to cancel a pending invite.
11. **Quick Notes Function on Home Page:** *(NEW)*
    *   Add quick notes functionality to the home/dashboard page for class-specific notes.
    *   Update database schema: Create a `class_notes` table with columns for `id`, `class_id`, `user_id`, `content`, `created_at`, `updated_at`.
    *   Implement UI component on the home page with textarea for adding/editing notes specific to the selected class.
    *   Add backend actions for saving, updating, and retrieving class notes.
    *   **Future Enhancement**: Implement "@student_name" tagging system:
        *   Parse note content for "@student_name" mentions during save.
        *   Create `student_tagged_notes` table linking notes to specific students.
        *   Add tagged notes display to individual student profiles.
        *   Implement autocomplete for student names when typing "@" in notes.

## P3: UX Improvements & Content Updates

12. **Planning Page Allocated Items:**
    *   Modify the data fetching logic (`app/(dashboard)/dashboard/planning/page.tsx` or `actions.ts`) or client-side filtering (`app/(dashboard)/dashboard/planning/client.tsx`) to separate allocated content groups.
    *   Display allocated groups at the bottom of the list with a visual divider.
13. **Grading Page Week Display Format:**
    *   Update the logic generating the week dropdown options in `app/(dashboard)/dashboard/grading/client.tsx`.
    *   Format options like "Week X Term Y (Start Date)".
14. **Home Page Content Update:**
    *   Replace boilerplate text and images on the main landing page (`app/(dashboard)/page.tsx`).
    *   Incorporate user-provided images and app-specific information. 