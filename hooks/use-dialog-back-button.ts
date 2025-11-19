'use client';

import { useEffect, useRef } from 'react';

/**
 * 모바일에서 뒤로가기 버튼을 눌렀을 때 팝업이 닫히도록 처리하는 훅
 * 
 * @param open - 팝업이 열려있는지 여부
 * @param onClose - 팝업을 닫는 콜백 함수
 */
export function useDialogBackButton(open: boolean, onClose: () => void) {
  const historyStateRef = useRef<number | null>(null);

  useEffect(() => {
    if (open) {
      // 팝업이 열릴 때 히스토리 엔트리 추가
      const stateId = Date.now();
      historyStateRef.current = stateId;
      window.history.pushState({ dialog: true, stateId }, '');

      // popstate 이벤트 리스너 등록
      const handlePopState = (event: PopStateEvent) => {
        // 뒤로가기 버튼이 눌렸을 때
        if (historyStateRef.current !== null) {
          onClose();
          historyStateRef.current = null;
        }
      };

      window.addEventListener('popstate', handlePopState);

      return () => {
        window.removeEventListener('popstate', handlePopState);
        // 팝업이 닫힐 때 추가한 히스토리 엔트리 제거
        if (historyStateRef.current !== null) {
          // 현재 히스토리 상태가 우리가 추가한 것인지 확인
          if (window.history.state?.stateId === historyStateRef.current) {
            window.history.back();
          }
          historyStateRef.current = null;
        }
      };
    } else {
      // 팝업이 닫힐 때 히스토리 정리
      if (historyStateRef.current !== null) {
        // popstate 이벤트가 아닌 다른 방법으로 닫힌 경우
        if (window.history.state?.dialog && window.history.state?.stateId === historyStateRef.current) {
          window.history.back();
        }
        historyStateRef.current = null;
      }
    }
  }, [open, onClose]);
}

