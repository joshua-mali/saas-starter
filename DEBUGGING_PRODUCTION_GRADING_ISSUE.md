# Debugging Guide: Grading Page Goes Blank in Production

## Issue Description
When saving a grade in the Vercel deployed app, the page goes blank and loses all content. This doesn't happen locally. Refreshing the page brings the content back.

## Debugging Steps

### 1. Check Vercel Function Logs
1. Go to your Vercel dashboard
2. Navigate to your project
3. Click on "Functions" tab
4. Look for logs around the time you save a grade
5. Check for any errors in the server action logs

### 2. Check Browser Console Logs
1. Open browser DevTools (F12)
2. Go to Console tab
3. Try saving a grade
4. Look for error messages, especially those starting with:
   - `[saveAssessment]`
   - `[handleGradeChange]`
   - `[ErrorBoundary]`
   - `[GradingPage]`

### 3. Check Network Tab
1. Open DevTools Network tab
2. Try saving a grade
3. Look for failed requests (red status codes)
4. Check the server action request and response

### 4. Environment Variables Check
Ensure these environment variables are properly set in Vercel:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `DATABASE_URL`

### 5. Database Connection Issues
Common production database issues:
- Connection timeouts
- Connection pool exhaustion
- SSL certificate issues
- Foreign key constraint violations

### 6. Check for UUID Format Issues
The code uses UUIDs extensively. Check if:
- Database UUID format is consistent
- Client-side generated IDs match database expectations
- UUID validation is working correctly

## Common Fixes

### Fix 1: Add Error Boundaries
✅ **Already implemented** - Error boundaries have been added to catch React crashes.

### Fix 2: Enhanced Logging
✅ **Already implemented** - Comprehensive logging has been added to track the issue.

### Fix 3: Improved Error Handling
✅ **Already implemented** - Better error handling in server actions and client components.

### Fix 4: Check Supabase RLS Policies
If using Row Level Security, ensure policies allow:
- Reading assessments for the user's classes
- Creating/updating assessments for the user's classes
- Reading related tables (students, classes, etc.)

### Fix 5: Database Timeout Settings
Add connection timeout settings in your database configuration:

```typescript
// In your database connection file
const db = drizzle(connection, {
  schema,
  connection: {
    connectionTimeoutMillis: 30000,
    idleTimeoutMillis: 30000,
    max: 10, // Maximum connections in pool
  }
});
```

### Fix 6: Server Action Timeout
In `next.config.js`, add:

```javascript
module.exports = {
  experimental: {
    serverActions: {
      timeout: 30, // 30 seconds
    },
  },
};
```

## Monitoring Commands

### View Vercel Logs in Real-time
```bash
vercel logs --follow
```

### Check Specific Function Logs
```bash
vercel logs --function grading-actions
```

## Database Queries to Check

### Check for Orphaned Records
```sql
-- Check for assessments without valid enrollments
SELECT sa.* FROM student_assessments sa
LEFT JOIN student_enrollments se ON sa.student_enrollment_id = se.id
WHERE se.id IS NULL;

-- Check for assessments without valid curriculum plans
SELECT sa.* FROM student_assessments sa
LEFT JOIN class_curriculum_plan ccp ON sa.class_curriculum_plan_id = ccp.id
WHERE ccp.id IS NULL;
```

### Check Grade Scale Constraints
```sql
-- Ensure grade scales exist for the class
SELECT DISTINCT sa.grade_scale_id, gs.name
FROM student_assessments sa
LEFT JOIN grade_scales gs ON sa.grade_scale_id = gs.id
WHERE gs.id IS NULL;
```

## Quick Fixes to Try

### 1. Add Timeout Handling
```typescript
// In your server action, wrap database calls with timeout
const result = await Promise.race([
  db.insert(studentAssessments).values(data),
  new Promise((_, reject) => 
    setTimeout(() => reject(new Error('Database timeout')), 10000)
  )
]);
```

### 2. Add Retry Logic
```typescript
// Retry failed database operations
async function withRetry<T>(operation: () => Promise<T>, retries = 3): Promise<T> {
  for (let i = 0; i < retries; i++) {
    try {
      return await operation();
    } catch (error) {
      if (i === retries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
    }
  }
  throw new Error('Max retries exceeded');
}
```

### 3. Check Memory Usage
Large grading tables might cause memory issues:
- Implement pagination for large class lists
- Use React.memo for expensive components
- Consider virtual scrolling for large tables

## What to Look For in Logs

### Server-side Errors
- Database connection errors
- UUID validation failures
- Foreign key constraint violations
- Authentication/authorization failures
- Timeout errors

### Client-side Errors
- State management issues
- Network request failures
- Component rendering errors
- Memory leaks

## If the Issue Persists

1. **Enable Vercel Error Monitoring**: Add `@vercel/analytics` for better error tracking
2. **Add Sentry**: Implement Sentry for comprehensive error monitoring
3. **Database Monitoring**: Use your database provider's monitoring tools
4. **Performance Monitoring**: Check for memory and CPU usage spikes

## Contact Information
If you continue experiencing issues, please provide:
1. Browser console logs during the error
2. Vercel function logs
3. Network tab screenshots
4. Your environment variables (without sensitive values)

## Immediate Actions to Take

1. **Check Vercel logs right now** - Look for recent errors
2. **Test with browser DevTools open** - Capture the exact error
3. **Check database connection** - Verify it's working in production
4. **Review environment variables** - Ensure they match your local setup

The enhanced logging we've added will help pinpoint exactly where the failure occurs. Follow the console logs in order to track the issue down! 