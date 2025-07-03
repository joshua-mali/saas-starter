'use client';

import { createClient } from '@/lib/supabase/client';
import { useEffect, useState } from 'react';

export interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  completed: boolean;
  required: boolean;
  prerequisite?: string;
  action: string;
  href: string;
}

export interface OnboardingProgress {
  hasClass: boolean;
  hasTermDates: boolean;
  hasStudents: boolean;
  hasCurriculumPlan: boolean;
  hasGrades: boolean;
  loading: boolean;
}

export const useOnboarding = (classId?: string | null) => {
  const [progress, setProgress] = useState<OnboardingProgress>({
    hasClass: false,
    hasTermDates: false,
    hasStudents: false,
    hasCurriculumPlan: false,
    hasGrades: false,
    loading: true,
  });

  const checkProgress = async () => {
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) return;

      // Fetch progress data from API endpoints
      const [classesRes, studentsRes] = await Promise.all([
        fetch('/api/classes'),
        fetch('/api/students'),
      ]);

      const classes = classesRes.ok ? await classesRes.json() : [];
      const students = studentsRes.ok ? await studentsRes.json() : [];

      // If no classId is provided, check global progress
      if (!classId) {
        const hasClass = classes.length > 0;
        const hasTermDates = classes.some((cls: any) => 
          cls.terms && cls.terms.length > 0
        );
        const hasStudents = students.length > 0;
        const hasCurriculumPlan = classes.some((cls: any) => 
          cls.curriculumItems && cls.curriculumItems.length > 0
        );
        const hasGrades = false; // We'll implement this check when needed

        setProgress({
          hasClass,
          hasTermDates,
          hasStudents,
          hasCurriculumPlan,
          hasGrades,
          loading: false,
        });
        return;
      }

      // Class-specific checks when classId is provided
      const currentClass = classes.find((cls: any) => cls.id === classId);
      
      // Check if the specific class exists
      const hasClass = !!currentClass;

      // Check if the specific class has term dates
      const hasTermDates = currentClass ? 
        (currentClass.terms && currentClass.terms.length > 0) : false;

      // Check if the specific class has students enrolled
      const classStudents = students.filter((student: any) => 
        student.classId === classId
      );
      const hasStudents = classStudents.length > 0;

      // Check if the specific class has curriculum planning
      const hasCurriculumPlan = currentClass ? 
        (currentClass.curriculumItems && currentClass.curriculumItems.length > 0) : false;

      // TODO: Check if any grading has been done for this specific class
      const hasGrades = false;

      setProgress({
        hasClass,
        hasTermDates,
        hasStudents,
        hasCurriculumPlan,
        hasGrades,
        loading: false,
      });

    } catch (error) {
      console.error('Error checking onboarding progress:', error);
      setProgress(prev => ({ ...prev, loading: false }));
    }
  };

  useEffect(() => {
    checkProgress();
  }, [classId]); // Re-run when classId changes

  const getSteps = (): OnboardingStep[] => [
    {
      id: 'create-class',
      title: 'Create your first class',
      description: 'Set up a class for your students',
      completed: progress.hasClass,
      required: true,
      action: 'Create Class',
      href: '/dashboard/classes',
    },
    {
      id: 'set-term-dates',
      title: 'Set your term dates',
      description: 'Define the academic terms for planning',
      completed: progress.hasTermDates,
      required: true,
      action: 'Set Term Dates',
      href: classId ? `/dashboard/settings?classId=${classId}` : '/dashboard/settings',
    },
    {
      id: 'add-students',
      title: 'Add students to your class',
      description: 'Enroll students in your class',
      completed: progress.hasStudents,
      required: true,
      prerequisite: 'create-class',
      action: 'Add Students',
      href: classId ? `/dashboard/students?classId=${classId}` : '/dashboard/students',
    },
    {
      id: 'plan-curriculum',
      title: 'Plan your curriculum',
      description: 'Organise your teaching content and timeline',
      completed: progress.hasCurriculumPlan,
      required: true,
      prerequisite: 'set-term-dates',
      action: 'Plan Curriculum',
      href: classId ? `/dashboard/planning?classId=${classId}` : '/dashboard/planning',
    },
    {
      id: 'start-grading',
      title: 'Grade your students',
      description: 'Begin assessing student progress',
      completed: progress.hasGrades,
      required: false,
      prerequisite: 'plan-curriculum',
      action: 'Start Grading',
      href: classId ? `/dashboard/grading?classId=${classId}` : '/dashboard/grading',
    },
  ];

  const steps = getSteps();
  const completedSteps = steps.filter(step => step.completed).length;
  const totalSteps = steps.length;
  const progressPercentage = (completedSteps / totalSteps) * 100;

  // Get the next step to complete
  const getNextStep = (): OnboardingStep | null => {
    for (const step of steps) {
      if (!step.completed) {
        // Check if prerequisite is met
        if (step.prerequisite) {
          const prerequisiteStep = steps.find(s => s.id === step.prerequisite);
          if (prerequisiteStep && !prerequisiteStep.completed) {
            continue; // Skip this step, prerequisite not met
          }
        }
        return step;
      }
    }
    return null; // All steps completed
  };

  const isStepAvailable = (stepId: string): boolean => {
    const step = steps.find(s => s.id === stepId);
    if (!step) return false;
    
    if (step.prerequisite) {
      const prerequisiteStep = steps.find(s => s.id === step.prerequisite);
      return prerequisiteStep ? prerequisiteStep.completed : false;
    }
    
    return true;
  };

  const isOnboardingComplete = () => {
    const requiredSteps = steps.filter(step => step.required);
    return requiredSteps.every(step => step.completed);
  };

  return {
    progress,
    steps,
    completedSteps,
    totalSteps,
    progressPercentage,
    nextStep: getNextStep(),
    isStepAvailable,
    isOnboardingComplete: isOnboardingComplete(),
    loading: progress.loading,
    refreshProgress: checkProgress,
  };
}; 