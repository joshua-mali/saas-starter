# Grade Tracker Application

## Project Overview

The Grade Tracker Application is a comprehensive tool designed for schools to manage teacher accounts and track student progress. It uses Basejump for team/school management and Supabase for authentication and data storage.

### Key Features

- **Multi-School Support**: System handles multiple schools with subscription-based teacher limits
- **Role-Based Access**: Separate workflows for admins and teachers
- **Curriculum Planning**: Teachers can allocate content groups to teaching blocks/weeks for their classes
- **Flexible Assessment**: Grade at either content point or content group level
- **Automated Reporting**: Generates averages and summaries at different curriculum levels

## User Management Workflow

1. **Initial Registration**
   - Users sign up through standard authentication
   - Default role is 'user'
   - Contact admin (MALI) for school admin verification

2. **School Admin Setup**
   - Admin verifies school representative
   - Updates user role to 'admin'
   - Admin creates school profile and selects subscription tier
   - Subscription tier determines maximum number of teacher accounts

3. **Teacher Invitation Process**
   - School admin invites teachers via email
   - System checks against subscription teacher limit
   - Teachers receive email invitation with secure token
   - New teachers complete profile setup (name, contact, subjects)

4. **Access Levels**
   - School Admin:
     - Manage school profile
     - Invite/manage teachers
     - View all classes and reports
   - Teachers:
     - Manage assigned classes
     - Record student assessments
     - Generate reports for their classes

## Technical Architecture

### Authentication & User Management
- **Supabase Auth**: Handles user authentication
- **Basejump**: Manages school teams and roles
- **Custom Tables**:
  - `teacher_profiles`: Additional teacher information
  - `basejump.accounts`: School information and limits
  - `basejump.account_user`: User-school relationships

### Database Structure

1. **School Management**
   - `basejump.accounts`:
     - School details (name, address, contact)
     - Subscription limits (max_teachers)
     - Current teacher count
   - `basejump.account_user`:
     - User-school relationships
     - Role assignments (admin/teacher)
   - `teacher_profiles`:
     - Teacher-specific information
     - Subject specializations

2. **Academic Structure**
   - Stages (e.g., Stage 1 = Year 1 and 2)
   - Subjects
   - Focus Areas
   - Focus Groups
   - Content Groups
   - Content Points

3. **Assessment Structure**
   - Grade Scales (Extensive=5, Thorough=4, Sound=3, Basic=2, Elementary=1)
   - Student Assessments
   - Class Curriculum Plans

## Security Model

1. **Role-Based Access Control**
   - Supabase RLS policies
   - Basejump team permissions
   - Custom middleware checks

2. **Data Segregation**
   - School-level isolation
   - Teacher-specific views
   - Student data protection

3. **Invitation System**
   - Secure token-based invites
   - 7-day expiration
   - Subscription limit enforcement

## Development Guidelines

### Code Organization
- Client components marked with 'use client'
- Server-side authentication checks
- Proper error handling and loading states

### API Design
- RESTful endpoints for data operations
- Secure role verification
- Rate limiting and request validation

### Testing Strategy
- Unit tests for core functionality
- Integration tests for user flows
- Security testing for role enforcement

## Deployment Considerations

1. **Environment Setup**
   - Supabase project configuration
   - Environment variables
   - Build optimization

2. **Security Checks**
   - Authentication flow testing
   - Role permission verification
   - Data access validation

3. **Performance**
   - Query optimization
   - Proper indexing
   - Caching strategies

Remember to implement features incrementally, ensuring each component works properly before moving to the next. The system should remain extensible to accommodate future enhancements.
