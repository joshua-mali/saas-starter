# App To Do List

## P1: Critical Bugs & UI Issues

1.  **Class Dropdown on Home Page:**
    *   Investigate why the class dropdown appears on `/`.
    *   Ensure it's only rendered on pages where it's needed (e.g., dashboard pages).
2.  **Signup Feedback:**
    *   Modify signup logic (`app/(login)/actions.ts`) to check if an email already exists.
    *   Provide clear feedback to the user if the account exists, suggesting sign-in instead.
3.  **Grading Page Week Navigation Buttons:**
    *   Debug the `handlePreviousWeek` and `handleNextWeek` functions in `app/(dashboard)/dashboard/grading/client.tsx`.
    *   Fix the logic for disabling/enabling buttons and correct week navigation.
4.  **Students Page Class Selection:**
    *   Remove the local 'Select Class' dropdown from `app/(dashboard)/dashboard/students/client.tsx`.
    *   Ensure the page correctly uses the global class selector state.
5.  **Classes Page Stage Dropdown Format:**
    *   Locate the stage selection dropdown in `app/(dashboard)/dashboard/classes/client.tsx`.
    *   Remove the empty parentheses `()` from the displayed stage options.

## P2: Core Functionality Enhancements

6.  **Class-Specific Grading Scale:**
    *   Update database schema: Add a table for `class_grading_scales` linking scales/display names to `classes`. Remove/deprecate team-level scale settings if necessary.
    *   Modify backend logic (`app/(dashboard)/dashboard/settings/actions.ts`?) to manage class-specific scales.
    *   Update the settings page (`app/(dashboard)/dashboard/settings/page.tsx`) UI to allow editing scales per class.
    *   Adjust grading page (`app/(dashboard)/dashboard/grading/client.tsx`) to fetch and use the correct class-specific scale.
7.  **Grading Notes:**
    *   Update database schema: Add a `notes` column (text type) to the `student_assessments` table or create a separate `assessment_notes` table linking to `student_assessments`.
    *   Modify grading page UI (`app/(dashboard)/dashboard/grading/client.tsx`):
        *   Add a text input/textarea associated with each grade input.
        *   Implement saving/updating notes via actions (`app/(dashboard)/dashboard/grading/actions.ts`).
        *   Add a visual indicator (e.g., icon) to grades that have notes.
8.  **Display Pending Invites:**
    *   Modify backend logic to fetch pending invites for the current team/account.
    *   Update the team members/settings section (`app/(dashboard)/dashboard/team-settings.tsx`?) to display pending invites.
    *   Implement functionality (action and UI button) to cancel a pending invite.

## P3: UX Improvements & Content Updates

9.  **Planning Page Allocated Items:**
    *   Modify the data fetching logic (`app/(dashboard)/dashboard/planning/page.tsx` or `actions.ts`) or client-side filtering (`app/(dashboard)/dashboard/planning/client.tsx`) to separate allocated content groups.
    *   Display allocated groups at the bottom of the list with a visual divider.
10. **Grading Page Week Display Format:**
    *   Update the logic generating the week dropdown options in `app/(dashboard)/dashboard/grading/client.tsx`.
    *   Format options like "Week X Term Y (Start Date)".
11. **Home Page Content Update:**
    *   Replace boilerplate text and images on the main landing page (`app/page.tsx` or similar).
    *   Incorporate user-provided images and app-specific information. 