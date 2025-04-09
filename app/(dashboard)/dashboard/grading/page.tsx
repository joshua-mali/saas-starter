import { redirectToClassPage } from '@/lib/redirects/classRedirect';

export default async function GradingRedirectPage() {
  return redirectToClassPage('grading');
}
