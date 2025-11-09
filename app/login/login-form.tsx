'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';

import { useAuth } from '@/contexts/AuthContext';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Spinner } from '@/components/ui/spinner';

function LoginFormContent() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, resetPassword } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnUrl = searchParams.get('returnUrl') || '/';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(email, password);
      router.push(returnUrl);
    } catch (err) {
      const error = err as Error;
      setError(error.message || '로그인에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!email) {
      setError('이메일을 입력해주세요.');
      return;
    }

    try {
      await resetPassword(email);
      setError('');
    } catch (err) {
      const error = err as Error;
      setError(error.message || '비밀번호 재설정 이메일 전송에 실패했습니다.');
    }
  };

  return (
    <Card className="w-full border-border/80 bg-card/95 backdrop-blur-sm">
      <CardHeader className="items-center text-center">
        <CardTitle className="text-2xl font-semibold">로그인</CardTitle>
        <CardDescription>포장 예약 서비스를 이용하려면 로그인하세요.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="email">이메일</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">비밀번호</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <Spinner size="sm" />
                로그인 중
              </span>
            ) : (
              '로그인'
            )}
          </Button>
        </form>

        <div className="flex flex-col items-center gap-3 text-sm text-muted-foreground">
          <button
            type="button"
            className="text-primary underline-offset-4 transition hover:underline"
            onClick={handleResetPassword}
          >
            비밀번호를 잊으셨나요?
          </button>
          <Link
            href="/signup"
            className="text-primary underline-offset-4 transition hover:underline"
          >
            회원가입
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

export default function LoginForm() {
  return (
    <Suspense
      fallback={
        <Card className="w-full">
          <CardContent className="flex h-48 items-center justify-center">
            <Spinner size="lg" />
          </CardContent>
        </Card>
      }
    >
      <LoginFormContent />
    </Suspense>
  );
}
