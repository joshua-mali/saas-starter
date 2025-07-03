'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PartyPopper, Star } from 'lucide-react';
import Link from 'next/link';

interface CompletionCelebrationProps {
  userName?: string;
}

export function CompletionCelebration({ userName }: CompletionCelebrationProps) {
  const firstName = userName ? userName.split(' ')[0] : 'there';

  return (
    <Card className="w-full border-green-200 bg-gradient-to-br from-green-50 to-emerald-50">
      <CardHeader className="text-center pb-4">
        <div className="flex justify-center mb-4">
          <div className="bg-green-100 p-3 rounded-full">
            <PartyPopper className="h-8 w-8 text-green-600" />
          </div>
        </div>
        
        <CardTitle className="text-2xl font-bold text-green-800">
          🎉 Congratulations, {firstName}!
        </CardTitle>
        <CardDescription className="text-green-700 text-base">
          You've successfully set up your MALI-Ed classroom. You're ready to start teaching!
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Achievement badges */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div className="text-center p-3 bg-white/60 rounded-lg border border-green-200">
            <div className="text-2xl mb-1">🏫</div>
            <div className="text-xs font-medium text-green-700">Class Created</div>
          </div>
          <div className="text-center p-3 bg-white/60 rounded-lg border border-green-200">
            <div className="text-2xl mb-1">📅</div>
            <div className="text-xs font-medium text-green-700">Terms Set</div>
          </div>
          <div className="text-center p-3 bg-white/60 rounded-lg border border-green-200">
            <div className="text-2xl mb-1">👥</div>
            <div className="text-xs font-medium text-green-700">Students Added</div>
          </div>
          <div className="text-center p-3 bg-white/60 rounded-lg border border-green-200">
            <div className="text-2xl mb-1">📚</div>
            <div className="text-xs font-medium text-green-700">Curriculum Planned</div>
          </div>
          <div className="text-center p-3 bg-white/60 rounded-lg border border-green-200">
            <div className="text-2xl mb-1">🚀</div>
            <div className="text-xs font-medium text-green-700">Ready to Go!</div>
          </div>
          <div className="text-center p-3 bg-white/60 rounded-lg border border-green-200">
            <div className="text-2xl mb-1">✨</div>
            <div className="text-xs font-medium text-green-700">All Complete!</div>
          </div>
        </div>

        {/* What's next section */}
        <div className="bg-white/80 p-6 rounded-lg border border-green-200">
          <h3 className="font-semibold text-green-800 mb-3 flex items-center">
            <Star className="h-4 w-4 mr-2" />
            What's Next?
          </h3>
          
          <div className="space-y-3">
            <div className="flex items-start space-x-3">
              <div className="bg-[var(--color-brand)] text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center mt-0.5">
                1
              </div>
              <div>
                <p className="font-medium text-green-800">Start grading your students</p>
                <p className="text-sm text-green-600">Begin assessing student progress and track their learning journey.</p>
              </div>
            </div>
            
            <div className="flex items-start space-x-3">
              <div className="bg-[var(--color-brand)] text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center mt-0.5">
                2
              </div>
              <div>
                <p className="font-medium text-green-800">Generate detailed reports</p>
                <p className="text-sm text-green-600">View comprehensive analytics of your class performance.</p>
              </div>
            </div>
            
            <div className="flex items-start space-x-3">
              <div className="bg-[var(--color-brand)] text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center mt-0.5">
                3
              </div>
              <div>
                <p className="font-medium text-green-800">Add more classes</p>
                <p className="text-sm text-green-600">Scale your teaching with additional classes and students.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex flex-col sm:flex-row gap-3">
          <Button
            asChild
            className="bg-[var(--color-brand)] hover:bg-[var(--color-brand)]/90 text-white flex-1"
          >
            <Link href="/dashboard/grading">
              Start Grading Students
            </Link>
          </Button>
          
          <Button
            asChild
            variant="outline"
            className="border-green-300 text-green-700 hover:bg-green-50 flex-1"
          >
            <Link href="/dashboard/report">
              View Reports
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
} 