import { redirect } from 'next/navigation';

/** Root URL → redirect to the protected dashboard. */
export default function RootPage() {
  redirect('/dashboard');
}
