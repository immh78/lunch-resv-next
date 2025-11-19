'use client';

import { useEffect, useRef } from 'react';

// 전역 팝업 스택 관리자
type DialogHandler = {
  id: string;
  onClose: () => void;
};

class DialogStackManager {
  private stack: DialogHandler[] = [];
  private historyPushed = false;
  private isHandlingPopState = false;
  private ignoreNextPopState = false;

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('popstate', this.handlePopState);
    }
  }

  private handlePopState = (event: PopStateEvent) => {
    // pushState 직후 발생하는 이벤트는 무시
    if (this.ignoreNextPopState) {
      this.ignoreNextPopState = false;
      return;
    }

    // 이미 처리 중이면 무시
    if (this.isHandlingPopState) {
      return;
    }

    // 스택이 비어있으면 무시 (일반적인 페이지 뒤로가기 허용)
    if (this.stack.length === 0) {
      this.historyPushed = false;
      return;
    }

    // 가장 최근에 열린 팝업 닫기
    this.isHandlingPopState = true;
    const topDialog = this.stack[this.stack.length - 1];
    if (topDialog) {
      topDialog.onClose();
      this.stack.pop();
    }

    // 아직 다른 팝업이 열려있으면 히스토리 엔트리를 다시 추가
    // 이렇게 하면 다음 뒤로가기 버튼 클릭도 처리할 수 있음
    if (this.stack.length > 0) {
      this.ignoreNextPopState = true;
      window.history.pushState({ dialog: true }, '');
      setTimeout(() => {
        this.ignoreNextPopState = false;
      }, 50);
    } else {
      // 모든 팝업이 닫혔을 때 히스토리 상태만 업데이트
      this.historyPushed = false;
    }

    // 다음 이벤트 루프에서 플래그 리셋
    setTimeout(() => {
      this.isHandlingPopState = false;
    }, 0);
  };

  register(id: string, onClose: () => void) {
    // 이미 등록되어 있으면 제거 후 다시 추가 (최상단으로 이동)
    this.unregister(id);
    
    this.stack.push({ id, onClose });

    // 첫 번째 팝업이 열릴 때만 히스토리 엔트리 추가
    if (!this.historyPushed) {
      this.ignoreNextPopState = true;
      window.history.pushState({ dialog: true }, '');
      
      // pushState 직후 발생할 수 있는 popstate 이벤트를 무시하기 위한 추가 지연
      setTimeout(() => {
        this.ignoreNextPopState = false;
      }, 50);
      
      this.historyPushed = true;
    }
  }

  unregister(id: string) {
    const index = this.stack.findIndex((dialog) => dialog.id === id);
    if (index !== -1) {
      this.stack.splice(index, 1);
    }

    // 모든 팝업이 닫혔을 때 히스토리 상태만 업데이트
    // popstate 이벤트로 닫힌 경우가 아니라면 히스토리를 건드리지 않음
    if (this.stack.length === 0 && !this.isHandlingPopState) {
      this.historyPushed = false;
    }
  }

  cleanup() {
    if (typeof window !== 'undefined') {
      window.removeEventListener('popstate', this.handlePopState);
    }
    this.stack = [];
    this.historyPushed = false;
  }
}

// 싱글톤 인스턴스
const dialogStackManager = typeof window !== 'undefined' ? new DialogStackManager() : null;

/**
 * 모바일에서 뒤로가기 버튼을 눌렀을 때 팝업이 닫히도록 처리하는 훅
 * 
 * @param open - 팝업이 열려있는지 여부
 * @param onClose - 팝업을 닫는 콜백 함수
 */
export function useDialogBackButton(open: boolean, onClose: () => void) {
  const dialogIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!dialogStackManager) {
      return;
    }

    if (open) {
      // 고유 ID 생성
      if (!dialogIdRef.current) {
        dialogIdRef.current = `dialog-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
      }

      // 팝업 스택에 등록
      dialogStackManager.register(dialogIdRef.current, onClose);

      return () => {
        // 팝업이 닫힐 때 스택에서 제거
        if (dialogIdRef.current) {
          dialogStackManager.unregister(dialogIdRef.current);
        }
      };
    } else {
      // 팝업이 닫힐 때 스택에서 제거
      if (dialogIdRef.current) {
        dialogStackManager.unregister(dialogIdRef.current);
      }
    }
  }, [open, onClose]);
}

