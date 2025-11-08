'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import dayjs from 'dayjs';
import { push, ref } from 'firebase/database';

import { database } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';

export default function PageViewLogger() {
  const { user } = useAuth();
  const pathname = usePathname();
  const lastLoggedSignatureRef = useRef<string | null>(null);
  const uid = user?.uid ?? null;

  useEffect(() => {
    if (!uid || !pathname) {
      return;
    }

    const signature = `${uid}:${pathname}`;
    if (lastLoggedSignatureRef.current === signature) {
      return;
    }

    const logEntry = {
      uid,
      datetime: dayjs().format('YYYYMMDDHHmmss'),
    };

    const logRef = ref(database, 'logs/lunch-resv-next');

    (async () => {
      try {
        lastLoggedSignatureRef.current = signature;
        await push(logRef, logEntry);
      } catch (error) {
        lastLoggedSignatureRef.current = undefined;
        console.error('페이지 로그 기록 중 오류가 발생했습니다.', error);
      }
    })();
  }, [uid, pathname]);

  return null;
}
