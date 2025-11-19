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
  const isHandlingPopStateRef = useRef(false);
  const ignoreNextPopStateRef = useRef(false);

  useEffect(() => {
    if (open) {
      // popstate 이벤트 리스너를 먼저 등록
      const handlePopState = (event: PopStateEvent) => {
        // pushState 직후 발생하는 이벤트는 무시
        if (ignoreNextPopStateRef.current) {
          ignoreNextPopStateRef.current = false;
          return;
        }

        // 이미 처리 중이면 무시
        if (isHandlingPopStateRef.current) {
          return;
        }

        // 뒤로가기 버튼이 눌렸을 때
        if (historyStateRef.current !== null) {
          isHandlingPopStateRef.current = true;
          
          // 팝업을 닫기
          onClose();
          
          // 히스토리 상태 초기화
          historyStateRef.current = null;
          
          // 다음 이벤트 루프에서 플래그 리셋
          setTimeout(() => {
            isHandlingPopStateRef.current = false;
          }, 0);
        }
      };

      window.addEventListener('popstate', handlePopState);

      // 리스너 등록 후 짧은 지연을 두고 pushState 호출
      // 이렇게 하면 pushState 직후 발생하는 popstate 이벤트를 무시할 수 있음
      const timeoutId = setTimeout(() => {
        const stateId = Date.now();
        historyStateRef.current = stateId;
        ignoreNextPopStateRef.current = true;
        window.history.pushState({ dialog: true, stateId }, '');
        
        // pushState 직후 발생할 수 있는 popstate 이벤트를 무시하기 위한 추가 지연
        setTimeout(() => {
          ignoreNextPopStateRef.current = false;
        }, 100);
      }, 0);

      return () => {
        clearTimeout(timeoutId);
        window.removeEventListener('popstate', handlePopState);
        
        // 팝업이 닫힐 때 (컴포넌트 언마운트 또는 open이 false가 될 때)
        // popstate 이벤트로 닫힌 경우가 아니라면 히스토리 정리
        if (historyStateRef.current !== null && !isHandlingPopStateRef.current) {
          const currentState = window.history.state;
          // 현재 히스토리 상태가 우리가 추가한 것인지 확인
          if (currentState?.dialog && currentState?.stateId === historyStateRef.current) {
            // 히스토리에서 제거
            window.history.back();
          }
          historyStateRef.current = null;
        }
      };
    } else {
      // 팝업이 닫힐 때 히스토리 정리 (open이 false가 된 경우)
      if (historyStateRef.current !== null && !isHandlingPopStateRef.current) {
        const currentState = window.history.state;
        // popstate 이벤트가 아닌 다른 방법으로 닫힌 경우
        if (currentState?.dialog && currentState?.stateId === historyStateRef.current) {
          window.history.back();
        }
        historyStateRef.current = null;
      }
    }
  }, [open, onClose]);
}

