'use client';

import { useEffect, useRef } from 'react';

// 전역 팝업 스택 관리자
type DialogHandler = {
  id: string;
  onClose: () => void;
  element?: HTMLElement | null;
};

class DialogStackManager {
  private stack: DialogHandler[] = [];
  private historyPushed = false;
  private isHandlingPopState = false;
  private ignoreNextPopState = false;
  private initialHistoryLength = 0;

  constructor() {
    if (typeof window !== 'undefined') {
      this.initialHistoryLength = window.history.length;
      window.addEventListener('popstate', this.handlePopState);
    }
  }

  /**
   * 현재 포커스가 있는 팝업을 찾습니다.
   * Radix UI Dialog는 data-state="open" 속성을 사용하므로 이를 활용합니다.
   * 일반적으로 스택의 최상단 팝업이 포커스를 가지고 있지만,
   * DOM을 확인하여 실제로 열려있는 팝업을 검증합니다.
   */
  private findFocusedDialog(): DialogHandler | null {
    if (this.stack.length === 0) {
      return null;
    }

    // DOM에서 열려있는 모든 다이얼로그 찾기
    const openDialogs = document.querySelectorAll('[role="dialog"][data-state="open"]');
    
    // 스택의 최상단 팝업이 기본값 (가장 최근에 열린 팝업)
    const topHandler = this.stack[this.stack.length - 1];
    
    // DOM에 열린 다이얼로그가 없으면 스택의 최상단 반환
    if (openDialogs.length === 0) {
      return topHandler;
    }

    // 스택을 역순으로 순회하여 실제로 열려있는 팝업 찾기
    // 가장 최근에 등록된 팝업부터 확인
    for (let i = this.stack.length - 1; i >= 0; i--) {
      const handler = this.stack[i];
      
      // 핸들러에 저장된 element가 있고, 그것이 실제로 열려있는지 확인
      const element = handler.element;
      if (element) {
        const isOpen = Array.from(openDialogs).some(
          dialog => dialog === element || dialog.contains(element)
        );
        if (isOpen) {
          return handler;
        }
      }
    }

    // element 매칭이 실패하면 스택의 최상단 반환
    // (일반적으로 스택의 최상단이 포커스를 가짐)
    return topHandler;
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

    // 현재 포커스가 있는 팝업 찾기
    const focusedDialog = this.findFocusedDialog();

    if (!focusedDialog) {
      // 열린 팝업이 없으면 히스토리 엔트리를 다시 추가하여 페이지 이동 방지
      this.ignoreNextPopState = true;
      window.history.pushState({ dialog: true }, '');
      setTimeout(() => {
        this.ignoreNextPopState = false;
      }, 50);
      this.historyPushed = true;
      return;
    }

    // 포커스가 있는 팝업 닫기
    this.isHandlingPopState = true;
    
    // 스택에서 해당 팝업 제거 (unregister가 호출되지 않도록 미리 제거)
    const index = this.stack.findIndex((dialog) => dialog.id === focusedDialog.id);
    if (index !== -1) {
      this.stack.splice(index, 1);
    }

    // 팝업 닫기 콜백 실행
    focusedDialog.onClose();

    // 히스토리 엔트리를 다시 추가하여 페이지 이동 방지
    // 다른 팝업이 열려있거나 모든 팝업이 닫혔어도 항상 히스토리 엔트리를 추가
    // 이렇게 하면 페이지 이동이 아닌 팝업 닫기로 처리됨
    // 약간의 지연을 두어 팝업이 완전히 닫힌 후 히스토리 추가
    setTimeout(() => {
      // 아직 다른 팝업이 열려있거나, 모든 팝업이 닫혔어도 히스토리 엔트리 추가
      // 이렇게 하면 다음 뒤로가기 시에도 팝업 닫기로 처리됨
      this.ignoreNextPopState = true;
      window.history.pushState({ dialog: true }, '');
      setTimeout(() => {
        this.ignoreNextPopState = false;
      }, 50);
      this.historyPushed = true;
      
      // 다음 이벤트 루프에서 플래그 리셋
      setTimeout(() => {
        this.isHandlingPopState = false;
      }, 0);
    }, 10);
  };

  register(id: string, onClose: () => void, element?: HTMLElement | null) {
    // 이미 등록되어 있으면 제거 후 다시 추가 (최상단으로 이동)
    this.unregister(id);
    
    this.stack.push({ id, onClose, element });

    // 각 팝업이 열릴 때마다 히스토리 엔트리 추가
    // 이렇게 하면 각 팝업마다 하나의 히스토리 엔트리가 있어서
    // 뒤로가기 버튼을 누를 때마다 하나의 팝업이 닫힘
    this.ignoreNextPopState = true;
    window.history.pushState({ dialog: true }, '');
    
    // pushState 직후 발생할 수 있는 popstate 이벤트를 무시하기 위한 추가 지연
    setTimeout(() => {
      this.ignoreNextPopState = false;
    }, 50);
    
    this.historyPushed = true;
  }

  updateElement(id: string, element: HTMLElement) {
    const handler = this.stack.find((dialog) => dialog.id === id);
    if (handler) {
      handler.element = element;
    }
  }

  unregister(id: string) {
    // popstate 이벤트로 닫히는 경우는 이미 handlePopState에서 스택에서 제거했으므로
    // 여기서는 스택에 있는지 확인 후 제거
    const index = this.stack.findIndex((dialog) => dialog.id === id);
    if (index !== -1) {
      this.stack.splice(index, 1);
    }

    // popstate 이벤트로 닫히는 경우가 아니고, 모든 팝업이 닫혔을 때만 히스토리 상태 업데이트
    // popstate로 닫히는 경우는 handlePopState에서 히스토리를 관리하므로 여기서는 건드리지 않음
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
  const dialogElementRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!dialogStackManager) {
      return;
    }

    if (open) {
      // 고유 ID 생성
      if (!dialogIdRef.current) {
        dialogIdRef.current = `dialog-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
      }

      // 팝업 스택에 등록 (요소는 나중에 업데이트)
      dialogStackManager.register(dialogIdRef.current, onClose, null);

      // DOM 업데이트 후 다이얼로그 요소 찾기 및 업데이트
      // 약간의 지연을 두어 DOM이 완전히 렌더링된 후 찾기
      setTimeout(() => {
        const dialogs = document.querySelectorAll('[role="dialog"][data-state="open"]');
        // 가장 최근에 추가된 다이얼로그 (마지막 요소)를 찾기
        // 일반적으로 가장 최근에 열린 팝업이 마지막에 추가됨
        if (dialogs.length > 0) {
          // 마지막 요소가 가장 최근에 열린 팝업일 가능성이 높음
          dialogElementRef.current = dialogs[dialogs.length - 1] as HTMLElement;
          // 요소를 찾았으면 스택의 핸들러에 업데이트
          if (dialogIdRef.current && dialogElementRef.current) {
            dialogStackManager.updateElement(dialogIdRef.current, dialogElementRef.current);
          }
        }
      }, 50);

      return () => {
        // 팝업이 닫힐 때 스택에서 제거
        if (dialogIdRef.current) {
          dialogStackManager.unregister(dialogIdRef.current);
        }
        dialogElementRef.current = null;
      };
    } else {
      // 팝업이 닫힐 때 스택에서 제거
      if (dialogIdRef.current) {
        dialogStackManager.unregister(dialogIdRef.current);
      }
      dialogElementRef.current = null;
    }
  }, [open, onClose]);
}

