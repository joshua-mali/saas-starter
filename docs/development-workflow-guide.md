# MALI-Ed Development Workflow Guide

## Overview

This guide establishes best practices for developing MALI-Ed safely, moving away from "testing everything live" to proper development workflows with staging environments and comprehensive testing.

## 🏗️ **Environment Setup**

### **Environment Structure**
```
Production  →  Staging  →  Local Development
     ↑           ↑              ↑
 Live Data   Test Data    Local Test Data
```

### **1. Local Development Environment**

#### **Supabase CLI Setup**
```bash
# Install Supabase CLI
npm install -g @supabase/cli

# Initialize Supabase locally
supabase init

# Start local development environment
supabase start

# This gives you:
# - Local PostgreSQL database
# - Local Auth server
# - Local Storage
# - Local Edge Functions
```

#### **Local Environment Variables**
Create `.env.local` for local development:
```env
# Local Supabase (from supabase start output)
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_local_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_local_service_role_key

# Local database connection (for backups/testing)
DATABASE_URL=postgresql://postgres:postgres@localhost:54322/postgres
```

### **2. Staging Environment**

#### **Create Staging Project**
1. **Create a separate Supabase project** for staging
2. **Apply the same migrations** as production
3. **Use staging environment variables**:

```env
# .env.staging
NEXT_PUBLIC_SUPABASE_URL=https://your-staging-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=staging_anon_key
SUPABASE_SERVICE_ROLE_KEY=staging_service_role_key
```

## 📦 **Database Backup Strategy**

### **Before Any Major Changes**

1. **Create Backup Using Script**:
   ```bash
   chmod +x scripts/backup-database.sh
   ./scripts/backup-database.sh
   ```

2. **Verify Backup**:
   ```bash
   # Check backup file exists and has reasonable size
   ls -lh backups/
   ```

3. **Test Restore Process** (on staging first):
   ```bash
   # Restore to staging to verify backup integrity
   psql -h staging-host -U postgres -d postgres -f backup_file.sql
   ```

### **Automated Backup Schedule**

Create a GitHub Action for regular backups:

```yaml
# .github/workflows/backup.yml
name: Database Backup
on:
  schedule:
    - cron: '0 2 * * *'  # Daily at 2 AM
  workflow_dispatch:      # Manual trigger

jobs:
  backup:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Create Database Backup
        run: |
          # Add your backup script here
          ./scripts/backup-database.sh
      - name: Upload Backup to Storage
        # Store backup securely (S3, GitHub artifacts, etc.)
```

## 🧪 **Testing Strategy**

### **1. Database-Level Testing (pgTAP)**

Based on the [Supabase testing documentation](https://supabase.com/docs/guides/local-development/testing/overview), use pgTAP for database-level testing:

```bash
# Run database tests
supabase test db

# Run specific test file
supabase test db supabase/tests/rls-policies.test.sql
```

**Key Benefits**:
- Tests run in transactions (automatically rolled back)
- Fast execution
- Tests database logic directly
- Perfect for RLS policy testing

### **2. Application-Level Testing**

```bash
# Install testing dependencies
npm install --save-dev vitest @vitest/ui

# Add test scripts to package.json
{
  "scripts": {
    "test": "vitest",
    "test:ui": "vitest --ui",
    "test:rls": "vitest tests/rls-integration.test.ts"
  }
}
```

**Run Tests**:
```bash
# Run all tests
npm test

# Run RLS-specific tests
npm run test:rls

# Run tests with UI
npm run test:ui
```

### **3. End-to-End Testing Setup**

```bash
# Install Playwright for E2E testing
npm install --save-dev @playwright/test

# Add E2E test command
npm run test:e2e
```

## 🔄 **Development Workflow**

### **Daily Development Process**

1. **Start Local Environment**:
   ```bash
   supabase start
   npm run dev
   ```

2. **Make Changes**:
   - Develop features locally
   - Test against local database
   - Use local auth for user testing

3. **Test Changes**:
   ```bash
   # Run database tests
   supabase test db
   
   # Run application tests
   npm test
   
   # Test specific features
   npm run test:rls
   ```

4. **Deploy to Staging**:
   ```bash
   # Deploy database changes
   supabase db push --linked --include-all
   
   # Deploy app to staging (Vercel/Netlify)
   git push staging main
   ```

5. **Test on Staging**:
   - Test with realistic data
   - Test user workflows
   - Performance testing

6. **Deploy to Production**:
   ```bash
   # Only after staging approval
   git push production main
   ```

### **Feature Development Workflow**

1. **Create Feature Branch**:
   ```bash
   git checkout -b feature/rls-implementation
   ```

2. **Develop Locally**:
   - Work on local Supabase instance
   - Write tests alongside features
   - Use test-driven development

3. **Database Changes**:
   ```bash
   # Create migration for schema changes
   supabase migration new add_rls_policies
   
   # Apply locally
   supabase db reset
   ```

4. **Test Thoroughly**:
   ```bash
   # Database tests
   supabase test db
   
   # Integration tests
   npm test
   
   # Manual testing
   npm run dev
   ```

5. **Code Review**:
   - Create pull request
   - Automated tests run in CI
   - Manual review process

6. **Staging Deployment**:
   - Deploy to staging environment
   - Run full test suite
   - Manual acceptance testing

7. **Production Deployment**:
   - Create backup
   - Deploy database changes
   - Deploy application
   - Monitor for issues

## ⚡ **Quick Commands Reference**

### **Development**
```bash
# Start everything locally
supabase start && npm run dev

# Reset local database (fresh start)
supabase db reset

# Apply new migrations
supabase migration up

# Generate types
supabase gen types typescript --local > types/database.types.ts
```

### **Testing**
```bash
# Test everything
npm test && supabase test db

# Test RLS policies specifically
supabase test db supabase/tests/rls-policies.test.sql

# Test application with RLS
npm run test:rls
```

### **Database Management**
```bash
# Create backup
./scripts/backup-database.sh

# View database status
supabase status

# Open database in browser
supabase dashboard
```

## 🛡️ **RLS Development Best Practices**

### **1. Test-First Approach**
- Write RLS tests before implementing policies
- Test both positive and negative cases
- Verify cross-team isolation

### **2. Incremental Implementation**
```bash
# Enable RLS on one table at a time
ALTER TABLE students ENABLE ROW LEVEL SECURITY;

# Test thoroughly before moving to next table
supabase test db tests/students-rls.test.sql

# Continue with remaining tables
```

### **3. Performance Monitoring**
```sql
-- Monitor query performance after RLS
SELECT query, mean_time, calls 
FROM pg_stat_statements 
WHERE mean_time > 100 
ORDER BY mean_time DESC;
```

## 🚨 **Troubleshooting Common Issues**

### **Local Development Issues**

**Issue**: "Connection refused" to local Supabase
```bash
# Solution: Restart Supabase
supabase stop
supabase start
```

**Issue**: Database schema out of sync
```bash
# Solution: Reset local database
supabase db reset
```

### **RLS Testing Issues**

**Issue**: Tests pass locally but fail in staging
```bash
# Solution: Check environment-specific data
# Ensure test data exists in staging
# Verify user IDs match between environments
```

**Issue**: "Row-level security policy violation"
```bash
# Solution: Check authentication context
# Verify user is signed in
# Check team membership
# Review policy conditions
```

### **Performance Issues**

**Issue**: Slow queries after RLS implementation
```sql
-- Solution: Add indexes for RLS conditions
CREATE INDEX idx_students_team_id ON students(team_id);
CREATE INDEX idx_classes_team_id ON classes(team_id);
```

## 📊 **Monitoring & Analytics**

### **Development Metrics**
- Test coverage percentage
- Query performance benchmarks
- Security policy violations
- Feature deployment frequency

### **Production Monitoring**
- Database performance metrics
- User access patterns
- Security audit logs
- Error rates and types

## 🎯 **Success Criteria**

You'll know your development workflow is successful when:

✅ **No more testing in production**
✅ **All changes tested locally first**
✅ **Staging environment mirrors production**
✅ **Automated tests catch regressions**
✅ **Quick rollback capabilities**
✅ **Regular backups and disaster recovery**
✅ **Security-first development approach**

---

This workflow ensures that your MALI-Ed application is developed safely, tested thoroughly, and deployed confidently while maintaining the highest security standards. 