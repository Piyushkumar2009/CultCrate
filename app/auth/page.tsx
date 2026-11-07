'use client';

import { useRouter } from 'next/navigation';
import { AuthScreen } from '@/components/AuthScreen';

export default function AuthPage() {
  const router = useRouter();

  return (
    <AuthScreen
      onReturn={() => router.push('/')}
      onSuccess={() => {
        router.push('/');
      }}
    />
  );
}
