import { relations } from 'drizzle-orm';
import {
  boolean,
  date,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar
} from 'drizzle-orm/pg-core';

const authSchema = 'auth';
export const authUsers = pgTable('users', {
    id: uuid('id').primaryKey(),
  }, (table) => ({ schema: authSchema })
);

export const profiles = pgTable('profiles', {
  id: uuid('id').primaryKey().references(() => authUsers.id, { onDelete: 'cascade' }),
  full_name: text('full_name'),
  email: varchar('email', { length: 255 }).unique(),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const teams = pgTable('teams', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  stripeCustomerId: text('stripe_customer_id').unique(),
  stripeSubscriptionId: text('stripe_subscription_id').unique(),
  stripeProductId: text('stripe_product_id'),
  planName: varchar('plan_name', { length: 50 }),
  subscriptionStatus: varchar('subscription_status', { length: 20 }),
  teacherLimit: integer('teacher_limit').notNull().default(3),
});

export const teamMembers = pgTable('team_members', {
  id: serial('id').primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => authUsers.id, { onDelete: 'cascade' }),
  teamId: integer('team_id')
    .notNull()
    .references(() => teams.id, { onDelete: 'cascade' }),
  role: varchar('role', { length: 50 }).notNull(),
  joinedAt: timestamp('joined_at').notNull().defaultNow(),
});

export const activityLogs = pgTable('activity_logs', {
  id: serial('id').primaryKey(),
  teamId: integer('team_id')
    .notNull()
    .references(() => teams.id, { onDelete: 'cascade' }),
  userId: uuid('user_id')
      .references(() => authUsers.id, { onDelete: 'set null' }),
  action: text('action').notNull(),
  timestamp: timestamp('timestamp').notNull().defaultNow(),
  ipAddress: varchar('ip_address', { length: 45 }),
});

export const invitations = pgTable('invitations', {
  id: serial('id').primaryKey(),
  token: uuid('token').notNull().unique().defaultRandom(),
  teamId: integer('team_id')
    .notNull()
    .references(() => teams.id, { onDelete: 'cascade' }),
  email: varchar('email', { length: 255 }).notNull(),
  role: varchar('role', { length: 50 }).notNull(),
  invitedBy: uuid('invited_by')
    .notNull()
    .references(() => authUsers.id, { onDelete: 'cascade' }),
  invitedAt: timestamp('invited_at', { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  status: varchar('status', { length: 20 }).notNull().default('pending'),
});

export const stages = pgTable('stages', {
    id: serial('id').primaryKey(),
    name: varchar('name', { length: 50 }).notNull().unique(),
    description: text('description'),
    yearLevels: varchar('year_levels', { length: 50 }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const subjects = pgTable('subjects', {
    id: serial('id').primaryKey(),
    name: varchar('name', { length: 100 }).notNull().unique(),
    code: varchar('code', { length: 20 }),
    description: text('description'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const gradeScales = pgTable('grade_scales', {
    id: serial('id').primaryKey(),
    classId: uuid('class_id').notNull().references(() => classes.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 50 }).notNull(),
    numericValue: integer('numeric_value').notNull(),
    description: text('description'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => {
    return {
        // Class-specific unique constraints
        classNameUniqueIdx: uniqueIndex('grade_scales_class_name_unique').on(table.classId, table.name),
        classValueUniqueIdx: uniqueIndex('grade_scales_class_value_unique').on(table.classId, table.numericValue),
    };
});

export const outcomes = pgTable('outcomes', {
  id: serial('id').primaryKey(),
  subjectId: integer('subject_id').notNull().references(() => subjects.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const focusAreas = pgTable('focus_areas', {
  id: serial('id').primaryKey(),
  outcomeId: integer('outcome_id').notNull().references(() => outcomes.id, { onDelete: 'cascade' }),
  stageId: integer('stage_id').notNull().references(() => stages.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const focusGroups = pgTable('focus_groups', {
  id: serial('id').primaryKey(),
  focusAreaId: integer('focus_area_id').notNull().references(() => focusAreas.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const contentGroups = pgTable('content_groups', {
  id: serial('id').primaryKey(),
  focusGroupId: integer('focus_group_id').references(() => focusGroups.id, { onDelete: 'cascade' }),
  focusAreaId: integer('focus_area_id').references(() => focusAreas.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const contentPoints = pgTable('content_points', {
  id: serial('id').primaryKey(),
  contentGroupId: integer('content_group_id').notNull().references(() => contentGroups.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  orderIndex: integer('order_index').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const classes = pgTable('classes', {
  id: uuid('id').primaryKey().defaultRandom(),
  teamId: integer('team_id').notNull().references(() => teams.id, { onDelete: 'cascade' }),
  calendarYear: integer('calendar_year').notNull(),
  stageId: integer('stage_id').notNull().references(() => stages.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 100 }).notNull(),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const students = pgTable('students', {
  id: uuid('id').primaryKey().defaultRandom(),
  teamId: integer('team_id').notNull().references(() => teams.id, { onDelete: 'cascade' }),
  firstName: varchar('first_name', { length: 100 }).notNull(),
  lastName: varchar('last_name', { length: 100 }).notNull(),
  dateOfBirth: timestamp('date_of_birth', { mode: 'date' }),
  externalId: varchar('external_id', { length: 100 }),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const classTeachers = pgTable('class_teachers', {
  id: uuid('id').primaryKey().defaultRandom(),
  classId: uuid('class_id').notNull().references(() => classes.id, { onDelete: 'cascade' }),
  teacherId: uuid('teacher_id').notNull().references(() => authUsers.id, { onDelete: 'cascade' }),
  isPrimary: boolean('is_primary').default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const studentEnrollments = pgTable('student_enrollments', {
  id: uuid('id').primaryKey().defaultRandom(),
  studentId: uuid('student_id').notNull().references(() => students.id, { onDelete: 'cascade' }),
  classId: uuid('class_id').notNull().references(() => classes.id, { onDelete: 'cascade' }),
  enrollmentDate: timestamp('enrollment_date', { mode: 'date' }).notNull().defaultNow(),
  status: varchar('status', { length: 50 }).default('active'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const terms = pgTable('terms', {
  id: uuid('id').primaryKey().defaultRandom(),
  teamId: integer('team_id').notNull().references(() => teams.id, { onDelete: 'cascade' }),
  calendarYear: integer('calendar_year').notNull(),
  termNumber: integer('term_number').notNull(),
  startDate: date('start_date', { mode: 'date' }).notNull(),
  endDate: date('end_date', { mode: 'date' }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => {
  return {
    teamYearTermUnique: uniqueIndex('terms_team_year_term_unique_idx').on(
        table.teamId,
        table.calendarYear,
        table.termNumber
    ),
  };
});

export const classCurriculumPlan = pgTable('class_curriculum_plan', {
  id: uuid('id').primaryKey().defaultRandom(),
  classId: uuid('class_id').notNull().references(() => classes.id, { onDelete: 'cascade' }),
  contentGroupId: integer('content_group_id').notNull().references(() => contentGroups.id, { onDelete: 'cascade' }),
  weekStartDate: date('week_start_date', { mode: 'date' }).notNull(),
  durationWeeks: integer('duration_weeks').notNull().default(1),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const studentAssessments = pgTable('student_assessments', {
    id: uuid('id').primaryKey().defaultRandom(),
    studentEnrollmentId: uuid('student_enrollment_id').notNull().references(() => studentEnrollments.id, { onDelete: 'cascade' }),
    classCurriculumPlanId: uuid('class_curriculum_plan_id').notNull().references(() => classCurriculumPlan.id, { onDelete: 'cascade' }),
    contentGroupId: integer('content_group_id').notNull().references(() => contentGroups.id, { onDelete: 'cascade' }),
    contentPointId: integer('content_point_id').references(() => contentPoints.id, { onDelete: 'cascade' }), // Nullable for group-level grading
    gradeScaleId: integer('grade_scale_id').notNull().references(() => gradeScales.id, { onDelete: 'restrict' }), // Restrict deletion of grade scales if used
    assessmentDate: timestamp('assessment_date', { withTimezone: true }).notNull().defaultNow(),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  }, (table) => {
    return {
      // Unique constraint to prevent duplicate grades for the same student/plan item/point (or student/plan item if point is null)
      // This might need adjustment based on whether re-grading is allowed or creates new records.
      // For now, let's assume one grade per student/plan item/point combination.
      studentPlanPointUniqueIdx: uniqueIndex('student_assessment_unique_idx').on(
        table.studentEnrollmentId,
        table.classCurriculumPlanId,
        table.contentPointId // Including nulls as distinct values if supported, or handle logic elsewhere
      ),
    };
  });

// Teacher Comments - Two types: General notes and Student-specific comments
export const teacherComments = pgTable('teacher_comments', {
  id: uuid('id').primaryKey().defaultRandom(),
  teamId: integer('team_id').notNull().references(() => teams.id, { onDelete: 'cascade' }),
  authorId: uuid('author_id').notNull().references(() => authUsers.id, { onDelete: 'cascade' }),
  commentType: varchar('comment_type', { length: 20 }).notNull(), // 'general' or 'student'
  // For general notes, these will be null:
  studentId: uuid('student_id').references(() => students.id, { onDelete: 'cascade' }),
  classId: uuid('class_id').references(() => classes.id, { onDelete: 'cascade' }),
  // Comment content
  title: varchar('title', { length: 255 }),
  content: text('content').notNull(),
  isPrivate: boolean('is_private').default(true), // Whether only the author can see it
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const nswTermDates = pgTable('nsw_term_dates', {
  id: serial('id').primaryKey(),
  calendarYear: integer('calendar_year').notNull(),
  termNumber: integer('term_number').notNull(),
  termName: varchar('term_name', { length: 50 }).notNull(), // "Term 1", "Term 2", etc.
  startDate: date('start_date').notNull(),
  endDate: date('end_date').notNull(),
  division: varchar('division', { length: 20 }).notNull(), // "Eastern" or "Western"
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  uniqueYearTermDivision: uniqueIndex('nsw_term_dates_unique').on(
    table.calendarYear,
    table.termNumber,
    table.division
  ),
}));

// Add unique constraint for year/term/division combination

export const teamsRelations = relations(teams, ({ many }) => ({
  teamMembers: many(teamMembers),
  activityLogs: many(activityLogs),
  invitations: many(invitations),
  classes: many(classes),
  students: many(students),
  terms: many(terms),
  teacherComments: many(teacherComments),
}));

export const profilesRelations = relations(profiles, ({ one }) => ({
  user: one(authUsers, {
    fields: [profiles.id],
    references: [authUsers.id],
  }),
}));

export const invitationsRelations = relations(invitations, ({ one }) => ({
  team: one(teams, {
    fields: [invitations.teamId],
    references: [teams.id],
  }),
  invitedByUser: one(authUsers, {
    fields: [invitations.invitedBy],
    references: [authUsers.id],
    relationName: 'InvitationInvitedBy',
  }),
}));

export const teamMembersRelations = relations(teamMembers, ({ one }) => ({
  user: one(authUsers, {
    fields: [teamMembers.userId],
    references: [authUsers.id],
    relationName: 'TeamMemberUser',
  }),
  team: one(teams, {
    fields: [teamMembers.teamId],
    references: [teams.id],
  }),
}));

export const activityLogsRelations = relations(activityLogs, ({ one }) => ({
  team: one(teams, {
    fields: [activityLogs.teamId],
    references: [teams.id],
  }),
  user: one(authUsers, {
    fields: [activityLogs.userId],
    references: [authUsers.id],
    relationName: 'ActivityLogUser',
  }),
}));

export const authUsersRelations = relations(authUsers, ({ one, many }) => ({
  profile: one(profiles, {
    fields: [authUsers.id],
    references: [profiles.id],
    relationName: 'UserProfile'
  }),
  classesTaught: many(classTeachers),
  teacherComments: many(teacherComments),
}));

export const stagesRelations = relations(stages, ({ many }) => ({
    focusAreas: many(focusAreas),
    classes: many(classes),
}));

export const subjectsRelations = relations(subjects, ({ many }) => ({
    outcomes: many(outcomes),
}));

export const outcomesRelations = relations(outcomes, ({ one, many }) => ({
    subject: one(subjects, { fields: [outcomes.subjectId], references: [subjects.id] }),
    focusAreas: many(focusAreas),
}));

export const focusAreasRelations = relations(focusAreas, ({ one, many }) => ({
  stage: one(stages, { fields: [focusAreas.stageId], references: [stages.id] }),
  outcome: one(outcomes, { fields: [focusAreas.outcomeId], references: [outcomes.id] }),
  focusGroups: many(focusGroups),
}));

export const focusGroupsRelations = relations(focusGroups, ({ one, many }) => ({
  focusArea: one(focusAreas, { fields: [focusGroups.focusAreaId], references: [focusAreas.id] }),
  contentGroups: many(contentGroups),
}));

export const contentGroupsRelations = relations(contentGroups, ({ one, many }) => ({
  focusGroup: one(focusGroups, { fields: [contentGroups.focusGroupId], references: [focusGroups.id] }),
  contentPoints: many(contentPoints),
  classCurriculumPlanItems: many(classCurriculumPlan),
}));

export const contentPointsRelations = relations(contentPoints, ({ one, many }) => ({
  contentGroup: one(contentGroups, { fields: [contentPoints.contentGroupId], references: [contentGroups.id] }),
  assessments: many(studentAssessments), // Add relation from content point to assessments
}));

export const classesRelations = relations(classes, ({ one, many }) => ({
  team: one(teams, { fields: [classes.teamId], references: [teams.id] }),
  stage: one(stages, { fields: [classes.stageId], references: [stages.id] }),
  classTeachers: many(classTeachers),
  studentEnrollments: many(studentEnrollments),
  classCurriculumPlanItems: many(classCurriculumPlan),
  teacherComments: many(teacherComments),
  gradeScales: many(gradeScales),
}));

export const studentsRelations = relations(students, ({ one, many }) => ({
  team: one(teams, { fields: [students.teamId], references: [teams.id] }),
  studentEnrollments: many(studentEnrollments),
  teacherComments: many(teacherComments),
}));

export const classTeachersRelations = relations(classTeachers, ({ one }) => ({
  class: one(classes, { fields: [classTeachers.classId], references: [classes.id] }),
  teacher: one(authUsers, { fields: [classTeachers.teacherId], references: [authUsers.id] }),
}));

export const studentEnrollmentsRelations = relations(studentEnrollments, ({ one, many }) => ({
  student: one(students, { fields: [studentEnrollments.studentId], references: [students.id] }),
  class: one(classes, { fields: [studentEnrollments.classId], references: [classes.id] }),
  assessments: many(studentAssessments), // Add relation from enrollment to assessments
}));

export const termsRelations = relations(terms, ({ one }) => ({
  team: one(teams, { fields: [terms.teamId], references: [teams.id] }),
}));

export const classCurriculumPlanRelations = relations(classCurriculumPlan, ({ one, many }) => ({
  class: one(classes, { fields: [classCurriculumPlan.classId], references: [classes.id] }),
  contentGroup: one(contentGroups, { fields: [classCurriculumPlan.contentGroupId], references: [contentGroups.id] }),
  assessments: many(studentAssessments), // Add relation from plan item to assessments
}))

export const gradeScalesRelations = relations(gradeScales, ({ one, many }) => ({
    class: one(classes, { fields: [gradeScales.classId], references: [classes.id] }),
    assessments: many(studentAssessments), // Add relation from grade scale to assessments
}));

export const studentAssessmentsRelations = relations(studentAssessments, ({ one }) => ({
    studentEnrollment: one(studentEnrollments, { fields: [studentAssessments.studentEnrollmentId], references: [studentEnrollments.id] }),
    classCurriculumPlanItem: one(classCurriculumPlan, { fields: [studentAssessments.classCurriculumPlanId], references: [classCurriculumPlan.id] }),
    contentGroup: one(contentGroups, { fields: [studentAssessments.contentGroupId], references: [contentGroups.id] }),
    contentPoint: one(contentPoints, { fields: [studentAssessments.contentPointId], references: [contentPoints.id] }),
    gradeScale: one(gradeScales, { fields: [studentAssessments.gradeScaleId], references: [gradeScales.id] }),
}));

export const teacherCommentsRelations = relations(teacherComments, ({ one }) => ({
    team: one(teams, { fields: [teacherComments.teamId], references: [teams.id] }),
    author: one(authUsers, { fields: [teacherComments.authorId], references: [authUsers.id] }),
    student: one(students, { fields: [teacherComments.studentId], references: [students.id] }),
    class: one(classes, { fields: [teacherComments.classId], references: [classes.id] }),
}));

export type Profile = typeof profiles.$inferSelect;
export type NewProfile = typeof profiles.$inferInsert;

export type Team = typeof teams.$inferSelect;
export type NewTeam = typeof teams.$inferInsert;
export type TeamMember = typeof teamMembers.$inferSelect;
export type NewTeamMember = typeof teamMembers.$inferInsert;
export type ActivityLog = typeof activityLogs.$inferSelect;
export type NewActivityLog = Omit<typeof activityLogs.$inferInsert, 'userId'> & { userId: string };
export type Invitation = typeof invitations.$inferSelect;
export type NewInvitation = Omit<typeof invitations.$inferInsert, 'invitedBy'> & { invitedBy: string };

export type TeamDataWithMembers = Team & {
  teamMembers: (TeamMember & {
  })[];
};

export enum ActivityType {
  SIGN_UP = 'SIGN_UP',
  SIGN_IN = 'SIGN_IN',
  SIGN_OUT = 'SIGN_OUT',
  UPDATE_PASSWORD = 'UPDATE_PASSWORD',
  DELETE_ACCOUNT = 'DELETE_ACCOUNT',
  UPDATE_ACCOUNT = 'UPDATE_ACCOUNT',
  CREATE_TEAM = 'CREATE_TEAM',
  REMOVE_TEAM_MEMBER = 'REMOVE_TEAM_MEMBER',
  INVITE_TEAM_MEMBER = 'INVITE_TEAM_MEMBER',
  ACCEPT_INVITATION = 'ACCEPT_INVITATION',
}

export type Stage = typeof stages.$inferSelect;
export type NewStage = typeof stages.$inferInsert;
export type Subject = typeof subjects.$inferSelect;
export type NewSubject = typeof subjects.$inferInsert;
export type GradeScale = typeof gradeScales.$inferSelect;
export type NewGradeScale = typeof gradeScales.$inferInsert;

export type FocusArea = typeof focusAreas.$inferSelect;
export type NewFocusArea = typeof focusAreas.$inferInsert;
export type FocusGroup = typeof focusGroups.$inferSelect;
export type NewFocusGroup = typeof focusGroups.$inferInsert;
export type ContentGroup = typeof contentGroups.$inferSelect;
export type NewContentGroup = typeof contentGroups.$inferInsert;
export type ContentPoint = typeof contentPoints.$inferSelect;
export type NewContentPoint = typeof contentPoints.$inferInsert;

export type Class = typeof classes.$inferSelect;
export type NewClass = typeof classes.$inferInsert;
export type Student = typeof students.$inferSelect;
export type NewStudent = typeof students.$inferInsert;
export type ClassTeacher = typeof classTeachers.$inferSelect;
export type NewClassTeacher = typeof classTeachers.$inferInsert;
export type StudentEnrollment = typeof studentEnrollments.$inferSelect;
export type NewStudentEnrollment = typeof studentEnrollments.$inferInsert;

export type Outcome = typeof outcomes.$inferSelect;
export type NewOutcome = typeof outcomes.$inferInsert;

export type Term = typeof terms.$inferSelect;
export type NewTerm = typeof terms.$inferInsert;
export type ClassCurriculumPlanItem = typeof classCurriculumPlan.$inferSelect;
export type NewClassCurriculumPlanItem = typeof classCurriculumPlan.$inferInsert;

export type StudentAssessment = typeof studentAssessments.$inferSelect;
export type NewStudentAssessment = typeof studentAssessments.$inferInsert;

export type TeacherComment = typeof teacherComments.$inferSelect;

export type NSWTermDate = typeof nswTermDates.$inferSelect;
export type NewTeacherComment = typeof teacherComments.$inferInsert;
