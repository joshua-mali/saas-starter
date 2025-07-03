'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { OnboardingStep } from '@/lib/hooks/use-onboarding';
import { Check, ChevronRight, Clock, Lock } from 'lucide-react';
import Link from 'next/link';

interface ProgressStepperProps {
  steps: OnboardingStep[];
  nextStep: OnboardingStep | null;
  progressPercentage: number;
  onRefresh: () => void;
}

export function ProgressStepper({ steps, nextStep, progressPercentage, onRefresh }: ProgressStepperProps) {
  const getStepIcon = (step: OnboardingStep, index: number) => {
    if (step.completed) {
      return <Check className="h-4 w-4 text-white" />;
    }
    
    if (nextStep?.id === step.id) {
      return <Clock className="h-4 w-4 text-white" />;
    }
    
    // Check if step is locked (prerequisite not met)
    const isLocked = step.prerequisite && !steps.find(s => s.id === step.prerequisite)?.completed;
    if (isLocked) {
      return <Lock className="h-3 w-3 text-gray-400" />;
    }
    
    return <span className="text-sm font-medium text-gray-600">{index + 1}</span>;
  };

  const getStepStatus = (step: OnboardingStep) => {
    if (step.completed) return 'completed';
    if (nextStep?.id === step.id) return 'current';
    
    const isLocked = step.prerequisite && !steps.find(s => s.id === step.prerequisite)?.completed;
    if (isLocked) return 'locked';
    
    return 'available';
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg font-semibold text-[var(--color-dark-grey)]">
              Getting Started
            </CardTitle>
            <CardDescription>
              Complete these steps to set up your classroom
            </CardDescription>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-[var(--color-brand)]">
              {Math.round(progressPercentage)}%
            </div>
            <div className="text-xs text-gray-500">Complete</div>
          </div>
        </div>
        
        {/* Progress bar */}
        <div className="w-full bg-gray-200 rounded-full h-2 mt-4">
          <div 
            className="bg-[var(--color-brand)] h-2 rounded-full transition-all duration-300 ease-in-out"
            style={{ width: `${progressPercentage}%` }}
          />
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {steps.map((step, index) => {
          const status = getStepStatus(step);
          const isNext = nextStep?.id === step.id;
          
          return (
            <div
              key={step.id}
              className={`flex items-center space-x-4 p-4 rounded-lg border ${
                status === 'completed' 
                  ? 'bg-green-50 border-green-200' 
                  : status === 'current'
                  ? 'bg-[var(--color-ivory)] border-[var(--color-brand)]'
                  : status === 'locked'
                  ? 'bg-gray-50 border-gray-200 opacity-60'
                  : 'bg-white border-gray-200'
              }`}
            >
              {/* Step icon */}
              <div
                className={`flex items-center justify-center w-8 h-8 rounded-full ${
                  status === 'completed'
                    ? 'bg-green-500'
                    : status === 'current'
                    ? 'bg-[var(--color-brand)]'
                    : status === 'locked'
                    ? 'bg-gray-300'
                    : 'bg-gray-200'
                }`}
              >
                {getStepIcon(step, index)}
              </div>
              
              {/* Step content */}
              <div className="flex-1">
                <h3 className={`font-medium ${
                  status === 'locked' ? 'text-gray-400' : 'text-[var(--color-dark-grey)]'
                }`}>
                  {step.title}
                  {step.required && (
                    <span className="text-red-500 ml-1">*</span>
                  )}
                </h3>
                <p className={`text-sm ${
                  status === 'locked' ? 'text-gray-400' : 'text-gray-600'
                }`}>
                  {step.description}
                </p>
                
                {step.prerequisite && status === 'locked' && (
                  <p className="text-xs text-gray-400 mt-1">
                    Complete "{steps.find(s => s.id === step.prerequisite)?.title}" first
                  </p>
                )}
              </div>
              
              {/* Action button */}
              <div>
                {status === 'completed' ? (
                  <div className="text-green-600 text-sm font-medium">
                    ✓ Done
                  </div>
                ) : status === 'locked' ? (
                  <div className="text-gray-400 text-sm">
                    Locked
                  </div>
                ) : (
                  <Button
                    asChild
                    variant={isNext ? "default" : "outline"}
                    size="sm"
                    className={isNext ? 
                      "bg-[var(--color-brand)] hover:bg-[var(--color-brand)]/90 text-white" : 
                      ""
                    }
                  >
                    <Link href={step.href} className="flex items-center space-x-2">
                      <span>{step.action}</span>
                      <ChevronRight className="h-3 w-3" />
                    </Link>
                  </Button>
                )}
              </div>
            </div>
          );
        })}
        
        {/* Refresh button */}
        <div className="pt-4 border-t">
          <Button
            variant="ghost"
            size="sm"
            onClick={onRefresh}
            className="text-[var(--color-charcoal)] hover:text-[var(--color-brand)]"
          >
            Refresh Progress
          </Button>
        </div>
      </CardContent>
    </Card>
  );
} 