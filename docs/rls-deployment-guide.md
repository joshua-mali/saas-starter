# RLS Security Implementation Guide for MALI-Ed

## Overview

This guide outlines the implementation of Row Level Security (RLS) policies for the MALI-Ed application. The security model is based on **team-based multi-tenancy** where users belong to teams (schools/organizations) and have role-based access within those teams.

## Security Architecture

### Multi-Tenant Model
- **Teams**: Top-level organizational units (schools, districts, etc.)
- **Team Members**: Users belong to one team with specific roles
- **Role-Based Access**: Different permissions based on user roles within teams

### User Roles
1. **Owner/Admin**: Full team management access
2. **Teacher**: Access to assigned classes and students
3. **Member**: Basic team access (future expansion)

## Pre-Deployment Checklist

### 1. Backup Your Database
```bash
# Create a full backup before applying RLS policies
# This cannot be undone easily!
pg_dump your_database > backup_before_rls.sql
```

### 2. Test in Development First
- ✅ Apply policies to development/staging environment
- ✅ Test all user flows and permissions
- ✅ Verify no data access issues
- ✅ Check query performance impact

### 3. Review Current Data Access Patterns
- ✅ Audit existing queries in your application
- ✅ Identify any queries that might be blocked by RLS
- ✅ Update queries to be RLS-compliant

## Implementation Steps

### Step 1: Apply RLS Policies

1. **Connect to your Supabase SQL Editor**
2. **Run the RLS policies file:**
   ```sql
   -- Execute lib/db/rls-policies.sql in your Supabase SQL Editor
   ```

3. **Verify policies are applied:**
   ```sql
   -- Check that RLS is enabled on tables
   SELECT schemaname, tablename, rowsecurity 
   FROM pg_tables 
   WHERE schemaname = 'public' 
   AND rowsecurity = true;
   
   -- List all policies
   SELECT schemaname, tablename, policyname, cmd, qual 
   FROM pg_policies 
   WHERE schemaname = 'public';
   ```

### Step 2: Update Your Application Code

#### Authentication Context
Ensure your application always includes proper authentication context:

```typescript
// Example: Always use authenticated client
const supabase = createClient(url, anonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true
  }
});
```

#### Query Patterns
Update queries to be RLS-friendly:

```typescript
// ❌ This might not work with RLS
const { data } = await supabase
  .from('students')
  .select('*');

// ✅ This works with RLS (policies automatically filter)
const { data } = await supabase
  .from('students')
  .select('*')
  .eq('team_id', userTeamId); // Optional: explicit filter for performance
```

### Step 3: Error Handling

Add proper error handling for RLS policy violations:

```typescript
try {
  const { data, error } = await supabase
    .from('students')
    .select('*');
    
  if (error) {
    if (error.code === 'PGRST116') {
      // RLS policy violation
      console.error('Access denied by security policy');
      // Handle gracefully - redirect to appropriate page
    }
  }
} catch (error) {
  // Handle RLS-related errors
}
```

## Security Model Details

### Core Principles

1. **Team Isolation**: Users can only access data within their team
2. **Role-Based Permissions**: Different access levels based on user roles
3. **Teacher-Class Association**: Teachers can only access their assigned classes
4. **Secure Functions**: Performance-optimized security functions

### Policy Breakdown

#### User & Team Management
- **Profiles**: Users can only access their own profile
- **Teams**: Members can view their team, admins can manage
- **Team Members**: View team members, admins can manage memberships
- **Invitations**: Admins can manage, users can view their own invitations

#### Educational Data
- **Classes**: Team members can view, admins can manage all, teachers can update their classes
- **Students**: Team members can view all, teachers can view their class students
- **Assessments**: Teachers can manage assessments for their classes
- **Curriculum Plans**: Teachers can manage plans for their classes

#### Global/Shared Data
- **Curriculum Content** (stages, subjects, outcomes, etc.): Currently unrestricted
- **Grade Scales**: Global access (could be restricted if needed)

## Performance Considerations

### Optimizations Implemented

1. **Security Definer Functions**: Pre-computed user context for better performance
2. **Efficient Queries**: Policies use indexed columns where possible
3. **Minimal Joins**: Reduced complex joins in policy definitions

### Monitoring Performance

```sql
-- Monitor slow queries after RLS implementation
SELECT query, mean_time, calls 
FROM pg_stat_statements 
WHERE mean_time > 100 
ORDER BY mean_time DESC;
```

## Testing Strategy

### Test Scenarios

1. **User Isolation**: 
   - User A cannot see User B's team data
   - Cross-team data access is blocked

2. **Role-Based Access**:
   - Teachers can only modify their assigned classes
   - Admins can access all team data
   - Students data is properly restricted

3. **Edge Cases**:
   - Users not in any team
   - Multiple team memberships (if applicable)
   - Expired or invalid sessions

### Testing Script Example

```sql
-- Test as different users
SELECT auth.uid(); -- Should return current user ID
SELECT auth.get_user_team_id(); -- Should return user's team ID
SELECT auth.is_team_admin(); -- Should return boolean

-- Test data access
SELECT COUNT(*) FROM students; -- Should only return team students
SELECT COUNT(*) FROM classes WHERE team_id != (SELECT auth.get_user_team_id()); -- Should be 0
```

## Rollback Plan

If issues arise after deployment:

### Emergency Rollback
```sql
-- EMERGENCY: Disable RLS on all tables (temporary fix)
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE teams DISABLE ROW LEVEL SECURITY;
-- ... repeat for all tables

-- Remove all policies
DROP POLICY IF EXISTS "policy_name" ON table_name;
-- ... repeat for all policies
```

### Staged Rollback
1. Disable RLS on specific problematic tables
2. Fix and re-enable one table at a time
3. Monitor and verify each step

## Post-Deployment Monitoring

### Daily Checks (First Week)
- Monitor error logs for RLS policy violations
- Check query performance metrics
- Verify user access patterns are working correctly

### Weekly Checks (First Month)
- Review any reported access issues
- Analyze query performance trends
- Update policies if needed

### Security Audit
- Regular review of policy effectiveness
- Test with different user scenarios
- Update policies as application evolves

## Common Issues & Solutions

### Issue: "row-level security policy violation"
**Solution**: Check user authentication and team membership

### Issue: Slow query performance
**Solution**: Add appropriate indexes, optimize policy conditions

### Issue: Users can't access expected data
**Solution**: Verify team membership and role assignments

### Issue: Application breaks after RLS deployment
**Solution**: Update queries to handle RLS, add proper error handling

## Additional Security Recommendations

1. **Enable Audit Logging**: Track all data access and modifications
2. **Regular Security Reviews**: Monthly review of policies and access patterns
3. **Principle of Least Privilege**: Only grant minimum necessary permissions
4. **Monitor Failed Access Attempts**: Alert on suspicious access patterns

## Support & Resources

- [Supabase RLS Documentation](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Postgres RLS Official Docs](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
- Application-specific RLS policies: `lib/db/rls-policies.sql`

---

**⚠️ Important**: RLS is a critical security feature. Test thoroughly before production deployment and have a rollback plan ready. 