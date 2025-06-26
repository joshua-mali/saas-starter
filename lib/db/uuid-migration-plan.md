# UUID Migration Plan for SaaS Starter

## Overview
Convert tenant-specific tables from `serial` integer IDs to UUIDv7 for better security, scalability, and multi-tenancy support.

## Tables to Convert to UUID

### High Priority (Tenant-specific, user-facing)
1. **students** - Most critical for privacy
2. **classes** - Exposed in URLs
3. **student_enrollments** - Links students to classes
4. **student_assessments** - Contains sensitive grade data
5. **teacher_comments** - Contains private teacher notes

### Medium Priority (Internal relationships)
6. **class_teachers** - Teacher-class relationships
7. **class_curriculum_plan** - Class planning data
8. **terms** - Academic terms (tenant-specific)

### Keep as Integer (Reference data, performance-critical)
- **teams** - Already has proper access control
- **stages, subjects, outcomes, focus_areas, focus_groups, content_groups, content_points** - Curriculum reference data
- **grade_scales** - Lookup table

## Migration Steps

### Phase 1: Enable UUIDv7 Support
```sql
-- Enable uuid-ossp extension for UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create UUIDv7 generation function (when available in pg_idkit)
-- For now, we'll use UUIDv4 as fallback
```

### Phase 2: Add UUID Columns (Additive Changes)
```sql
-- Add new UUID columns alongside existing integer IDs
ALTER TABLE students ADD COLUMN uuid_id UUID DEFAULT gen_random_uuid();
ALTER TABLE classes ADD COLUMN uuid_id UUID DEFAULT gen_random_uuid();
-- ... repeat for other tables
```

### Phase 3: Populate UUIDs and Update References
```sql
-- Generate UUIDs for existing records
UPDATE students SET uuid_id = gen_random_uuid() WHERE uuid_id IS NULL;
-- Update all foreign key references to use UUIDs
```

### Phase 4: Switch Application Code
- Update TypeScript types
- Modify queries to use UUID columns
- Update API endpoints to accept/return UUIDs

### Phase 5: Remove Integer Columns
```sql
-- Drop old integer columns and constraints
ALTER TABLE students DROP COLUMN id;
ALTER TABLE students RENAME COLUMN uuid_id TO id;
-- Add primary key constraint to UUID column
```

## Benefits After Migration

### Security
- ✅ No information disclosure about business metrics
- ✅ Cannot enumerate resources by guessing IDs
- ✅ Better tenant isolation

### Scalability  
- ✅ Can generate IDs offline/client-side
- ✅ Easy data migration between systems
- ✅ No sequence bottlenecks

### Multi-tenancy
- ✅ Globally unique identifiers across all tenants
- ✅ Reduced risk of cross-tenant data access bugs

## Implementation Notes

### UUIDv7 vs UUIDv4
- **UUIDv7**: Time-ordered, better for database performance
- **UUIDv4**: Random, good security but worse for indexes
- **Recommendation**: Use UUIDv7 when available, UUIDv4 as fallback

### Database Performance
- PostgreSQL handles UUIDs well (unlike MySQL which prefers integers)
- Index size will increase (~2x), but this is acceptable for the security benefits
- Consider using `btree` indexes on UUID columns for optimal performance

### Application Changes Required
1. Update Drizzle schema definitions
2. Modify API routes to handle UUID parameters
3. Update frontend to work with UUID strings instead of numbers
4. Update any hardcoded ID references in tests

## Timeline Estimate
- **Phase 1-2**: 1-2 days (schema changes)
- **Phase 3-4**: 3-5 days (application updates)  
- **Phase 5**: 1 day (cleanup)
- **Total**: ~1 week with proper testing 