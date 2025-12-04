'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import dayjs from 'dayjs';
import { ref, onValue, set, remove, get, update } from 'firebase/database';
import { toast } from 'sonner';
import html2canvas from 'html2canvas';

import { database } from '@/lib/firebase';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useAuth } from '@/contexts/AuthContext';

import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import { getLucideIcon } from '@/lib/icon-utils';
import { MenuEditDialog, ImageUploadDialog, MenuListDialog, RestaurantKindManageDialog } from '@/app/rest-menu/components';
import * as LucideIcons from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import {
  UtensilsCrossed,
  MoreVertical,
  Phone,
  Navigation,
  MoreHorizontal,
  Share2,
  Receipt,
  Save,
  Trash2,
  X,
  Pencil,
  Clock3,
  PlusCircle,
  XCircle,
  BookOpen,
  Camera,
  EyeOff,
  Eye,
  Palette,
  Tag,
} from 'lucide-react';

type ThemeMode = 'white' | 'black';
type UploadContext = 'edit' | 'create';

interface Restaurant {
  id: string;
  name: string;
  telNo: string;
  kind?: string;
  menuImgId?: string;
  menuUrl?: string;
  naviUrl?: string;
  prepay?: boolean;
}

interface RestaurantMenu {
  name: string;
  img: string;        // Cloudinary 이미지 ID (mobile용)
  thumbnail: string;  // Cloudinary 이미지 ID (thumbnail용)
  cost: number;
  remark: string;
}

interface MenuItem {
  cost: number;
  menu: string;
}

interface EditableMenuItem {
  id: string;
  menu: string;
  cost: number;
  savedIndex?: number; // 저장된 항목의 원본 인덱스
}

interface ReservationData {
  isReceipt: boolean;
  menus: MenuItem[];
}

interface PrepaymentItem {
  amount: number;
  date: string;
}

interface EditablePrepaymentItem {
  id: string;
  amount: number;
  date: string;
  dateValue: Date | null;
  savedIndex?: number; // 저장된 항목의 원본 인덱스
}

interface RestaurantWithReservation extends Restaurant {
  reservationDate?: string;
  reservation?: ReservationData;
  prepaymentTotal?: number;
}

interface MenuHistoryItem {
  menu: string;
  cost: number;
}

type DeleteTarget = 'reservation' | 'prepayment';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

const formatCurrency = (value: number) => value.toLocaleString('ko-KR');

const getNextFriday = (): string => {
  const today = new Date();
  const dayOfWeek = today.getDay();
  let daysUntilFriday = 5 - dayOfWeek;
  if (daysUntilFriday <= 0) {
    daysUntilFriday += 7;
  }
  const nextFriday = new Date(today);
  nextFriday.setDate(today.getDate() + daysUntilFriday);
  return dayjs(nextFriday).format('YYYYMMDD');
};

const compactToDate = (value?: string): Date | null => {
  if (!value || value.length !== 8) {
    return null;
  }
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(4, 6)) - 1;
  const day = Number(value.slice(6, 8));
  if (Number.isNaN(year) || Number.isNaN(month) || Number.isNaN(day)) {
    return null;
  }
  return new Date(year, month, day);
};

const displayToDate = (value?: string): Date | null => {
  if (!value) return null;
  const parts = value.split('.');
  if (parts.length !== 3) return null;
  const [yearStr, monthStr, dayStr] = parts;
  const year = Number(yearStr);
  const month = Number(monthStr) - 1;
  const day = Number(dayStr);
  if (Number.isNaN(year) || Number.isNaN(month) || Number.isNaN(day)) {
    return null;
  }
  return new Date(year, month, day);
};

const dateToDisplay = (date: Date | null): string => {
  if (!date || Number.isNaN(date.getTime())) {
    return '';
  }
  return dayjs(date).format('YYYY.MM.DD');
};

const compactToDisplay = (value?: string): string => dateToDisplay(compactToDate(value));

const displayToCompact = (value: string): string => value.replace(/\./g, '');

const formatShareDate = (value: string): string => {
  const date = compactToDate(value);
  if (!date) return '';
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const weekday = WEEKDAYS[date.getDay()];
  return `${month}.${day}(${weekday})`;
};

const formatShareReservationDate = (value: string): string => {
  const date = displayToDate(value);
  if (!date) return '';
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const weekday = WEEKDAYS[date.getDay()];
  return `${month}.${day} (${weekday})`;
};

// Lucide 아이콘 이름을 SVG 문자열로 변환하는 헬퍼 함수
// 포장예약 페이지와 동일한 로직으로 아이콘을 가져옵니다.
// React 렌더링 중에는 호출하지 않고, 이벤트 핸들러에서만 호출합니다.
const getLucideIconSVG = async (iconName?: string): Promise<string> => {
  if (!iconName || typeof document === 'undefined') return '';
  
  try {
    // getLucideIcon과 동일한 로직으로 아이콘 이름 정규화
    let pascalCaseName: string;
    if (/^[A-Z][a-zA-Z0-9]*$/.test(iconName)) {
      pascalCaseName = iconName;
    } else {
      pascalCaseName = iconName
        .split(/[-_]/)
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join('');
    }
    
    // Lucide 아이콘 컴포넌트 가져오기
    const IconComponent = (LucideIcons as unknown as Record<string, LucideIcon>)[pascalCaseName];
    if (!IconComponent) return '';
    
    // 임시 DOM 요소 생성하여 아이콘 렌더링
    const tempDiv = document.createElement('div');
    tempDiv.style.position = 'absolute';
    tempDiv.style.left = '-9999px';
    tempDiv.style.top = '0';
    tempDiv.style.width = '16px';
    tempDiv.style.height = '16px';
    document.body.appendChild(tempDiv);
    
    // React를 사용하여 아이콘 렌더링
    // 이 함수는 React 렌더링 중이 아닐 때만 호출되어야 합니다.
    // 동적 import를 사용하여 react-dom/client를 가져옵니다.
    const ReactDOMClient = await import('react-dom/client');
    const root = ReactDOMClient.createRoot(tempDiv);
    
    // 아이콘 렌더링
    root.render(
      React.createElement(IconComponent, {
        size: 16,
        strokeWidth: 2,
        color: 'currentColor'
      })
    );
    
    // React 렌더링이 완료될 때까지 대기
    // requestAnimationFrame을 사용하여 다음 프레임까지 대기
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          resolve();
        });
      });
    });
    
    // 렌더링된 SVG 요소 가져오기
    const svgElement = tempDiv.querySelector('svg');
    let svgString = '';
    
    if (svgElement) {
      // SVG 요소를 문자열로 변환
      svgElement.setAttribute('style', 'display: inline-block; vertical-align: middle;');
      svgString = svgElement.outerHTML;
    }
    
    // 정리 (비동기적으로 처리하여 React 렌더링 완료 대기)
    setTimeout(() => {
      try {
        root.unmount();
        if (tempDiv.parentNode) {
          document.body.removeChild(tempDiv);
        }
      } catch (e) {
        // 이미 정리된 경우 무시
      }
    }, 100);
    
    return svgString;
  } catch (error) {
    console.error('Error getting icon SVG:', error);
    return '';
  }
};

// 공유 양식 HTML 생성 함수 (공통)
const generateShareFormHTML = (
  restaurantName: string,
  menuRows: Array<{ menu: string; cost: number }>,
  reservationDate: string,
  prepaymentRows: Array<{ date: string; amount: number }>,
  restaurantKind?: string,
  restaurantIcons?: Record<string, string>,
  iconSVGCache?: Record<string, string>
): string => {
  const formatCurrency = (value: number): string => {
    return new Intl.NumberFormat('ko-KR').format(value);
  };

  const validMenus = menuRows.filter((menu) => menu.menu.trim() && menu.cost > 0);
  const totalAmount = validMenus.reduce((sum, menu) => sum + menu.cost, 0);

  const validPrepayments = prepaymentRows
    .filter((item) => item.amount > 0 && item.date)
    .sort((a, b) => a.date.localeCompare(b.date));
  const prepaymentTotal = validPrepayments.reduce((sum, item) => sum + item.amount, 0);

  const menuRowsCount = validMenus.length || 1;
  const isSingleMenu = validMenus.length === 1;

  // Lucide icon SVG paths
  const iconSVG = {
    utensils: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2v0a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3a2 2 0 0 0 2-2Z"/><path d="M21 15v7"/></svg>',
    clipboard: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M12 11h4"/><path d="M12 16h4"/><path d="M8 11h.01"/><path d="M8 16h.01"/></svg>',
    dollarSign: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" x2="12" y1="2" y2="22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>',
    calendar: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>',
    creditCard: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/></svg>',
    calendarDays: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/><path d="M8 14h.01"/><path d="M12 14h.01"/><path d="M16 14h.01"/><path d="M8 18h.01"/><path d="M12 18h.01"/><path d="M16 18h.01"/></svg>',
    coins: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="8" r="6"/><path d="M18.09 10.37A6 6 0 1 1 10.34 18"/><path d="M7 6h1v4"/><path d="M16 14h1v4"/></svg>',
    sparkles: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/><path d="M5 3v4"/><path d="M19 17v4"/><path d="M3 5h4"/><path d="M17 19h4"/></svg>',
  };

  // 선결제 합계가 예약 금액보다 같거나 많은지 확인
  const showSparkles = prepaymentTotal >= totalAmount;

  // 포장예약 페이지와 동일한 로직으로 식당 아이콘 가져오기
  const restaurantIconName = restaurantKind && restaurantIcons?.[restaurantKind];
  // 캐시에서 아이콘 SVG를 가져오거나, 캐시가 없으면 빈 문자열 반환
  const restaurantIconSVG = restaurantIconName && iconSVGCache?.[restaurantIconName] 
    ? iconSVGCache[restaurantIconName] 
    : '';

  // 식당 아이콘 색상 계산 (선결제 금액 비율에 따라 동적 변경)
  const getRestaurantIconColor = (): string => {
    if (totalAmount === 0) {
      // 예약금액이 0이면 기본 색상 (파란색)
      return 'rgb(37, 0, 170)';
    }
    
    if (prepaymentTotal === 0) {
      // 선결제금액이 0이면 빨간색
      return 'rgb(170, 0, 0)';
    }
    
    if (prepaymentTotal >= totalAmount) {
      // 선결제금액이 예약금액보다 같거나 크면 파란색
      return 'rgb(37, 0, 170)';
    }
    
    // 비율에 따라 선형 보간
    const ratio = Math.min(prepaymentTotal / totalAmount, 1);
    // rgb(170, 0, 0)에서 rgb(37, 0, 170)로 보간
    const r = Math.round(170 - (170 - 37) * ratio);
    const g = 0;
    const b = Math.round(170 * ratio);
    
    return `rgb(${r}, ${g}, ${b})`;
  };

  const iconColor = getRestaurantIconColor();

  const tableHTML = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; padding: 8px; background: #f5f5f5; border-radius: 12px;">
      <div style="background: white; border-radius: 8px; padding: 4px 10px 10px 10px; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; padding-bottom: 12px; border-bottom: 1px solid #e8e8e8;">
          <div style="display: flex; align-items: center; gap: 8px;">
            ${restaurantIconSVG ? `<div style="display: flex; align-items: center; color:${iconColor};margin-bottom: -12px ;margin-right: -4px;  display: inline-block;">${restaurantIconSVG}</div>` : ''}
            <h2 style="align-items: center; margin: 0; font-size: 16px; font-weight: 600; color: #1a1a1a;">${restaurantName}</h2>
          </div>
          ${reservationDate ? `<span style="font-size: 10pt; font-weight: 600; color: #495057;margin-bottom: -8px;  display: inline-block;">${formatShareReservationDate(reservationDate)}</span>` : ''}
        </div>
        <div style="border: 1px solid #e8e8e8; border-radius: 6px; overflow: hidden; margin-bottom: 0;">
          <table cellspacing="0" cellpadding="0" style="width: 100%; font-size: 11pt; border-collapse: collapse; background-color: rgb(255, 255, 255);">
            <tbody>
            ${isSingleMenu ? `
              <tr>
                <td style="min-width: 100px; height: 18px; border: none; border-bottom: 1px solid #e8e8e8; background: #f8f9fa; text-align: center; vertical-align: middle; color: #495057; white-space: nowrap; padding: 0 12px; border-right: 1px solid #e8e8e8;">
                  <span style="font-weight: 600; font-size: 10pt; margin-bottom: 14px; display: inline-block;">메뉴</span>
                </td>
                <td style="height: 18px; border: none; border-bottom: 1px solid #e8e8e8; vertical-align: middle; color: #2d2d2d; white-space: nowrap; padding: 0 12px; text-align: center;" colspan="2">
                  <span style="font-size: 10pt; font-weight: 500; vertical-align: middle; margin-bottom: 14px; display: inline-block;">${validMenus[0].menu.trim()}</span>
                </td>
              </tr>
            ` : validMenus.length > 0 ? validMenus.map((menu, index) => `
              <tr>
                ${index === 0 ? `
                <td style="min-width: 100px; height: 18px; border: none; border-bottom: 1px solid #e8e8e8; background: #f8f9fa; text-align: center; vertical-align: middle; color: #495057; white-space: nowrap; padding: 0 12px; border-right: 1px solid #e8e8e8;" rowspan="${menuRowsCount}">
                  <span style="font-weight: 600; font-size: 10pt; margin-bottom: 14px; display: inline-block;">메뉴/가격</span>
                </td>
                ` : ''}
                <td style="height: 18px; border: none; border-bottom: 1px solid #e8e8e8; vertical-align: middle; color: #2d2d2d; white-space: nowrap; padding: 0 12px;">
                  <span style="font-size: 10pt; font-weight: 500; vertical-align: middle; margin-bottom: 14px; display: inline-block;">${menu.menu.trim()}</span>
                </td>
                <td style="height: 18px; border: none; border-bottom: 1px solid #e8e8e8; vertical-align: middle; color: #2d2d2d; white-space: nowrap; padding: 0 12px; text-align: right;">
                  <span style="font-size: 10pt; font-weight: 600; color: #495057; vertical-align: middle; margin-bottom: 14px; display: inline-block;">${formatCurrency(menu.cost)}원</span>
                </td>
              </tr>
            `).join('') : `
              <tr>
                <td style="min-width: 100px; height: 18px; border: none; border-bottom: 1px solid #e8e8e8; background: #f8f9fa; text-align: center; vertical-align: middle; color: #495057; white-space: nowrap; padding: 0 12px; border-right: 1px solid #e8e8e8;">
                  <span style="font-weight: 600; font-size: 10pt; margin-bottom: 14px; display: inline-block;">메뉴/가격</span>
                </td>
                <td style="height: 18px; border: none; border-bottom: 1px solid #e8e8e8; vertical-align: middle; color: #999; white-space: nowrap; padding: 0 12px;" colspan="2">
                  <span style="font-size: 10pt; vertical-align: middle; margin-bottom: 14px; display: inline-block;">-</span>
                </td>
              </tr>
            `}
            <tr>
              <td style="min-width: 100px; height: 18px; border: none; background: #f8f9fa; text-align: center; vertical-align: middle; color: #495057; white-space: nowrap; padding: 0 12px; border-right: 1px solid #e8e8e8;">
                <span style="font-weight: 600; font-size: 10pt; margin-bottom: 14px; display: inline-block;">가격</span>
              </td>
              <td style="height: 18px; border: none; vertical-align: middle; color: #2d2d2d; white-space: nowrap; padding: 0 12px; text-align: center;" colspan="2">
                <span style="font-size: 11pt; font-weight: 700; color: #495057; vertical-align: middle; margin-bottom: 14px; display: inline-block;">${formatCurrency(totalAmount)}원</span>
              </td>
            </tr>
            </tbody>
          </table>
        </div>
        ${validPrepayments.length > 0 ? `
        <div style="margin-top: 8px;">
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
            <div style="display: flex; align-items: bottom; color: #495057; margin-bottom: -16px; display: inline-block;">${iconSVG.creditCard}</div>
            <h3 style="margin: 0; font-size: 14px; font-weight: 600; color: #1a1a1a;">선결제</h3>
          </div>
          <div style="border: 1px solid #e8e8e8; border-radius: 6px; overflow: hidden;">
            <table cellspacing="0" cellpadding="0" style="width: 100%; font-size: 11pt; border-collapse: collapse; background-color: rgb(255, 255, 255);">
              <tbody>
              <tr>
                <td style="min-width: 100px; height: 18px; border: none; border-bottom: 1px solid #e8e8e8; background: #f8f9fa; text-align: center; vertical-align: middle; color: #495057; white-space: nowrap; padding: 0 12px; border-right: 1px solid #e8e8e8;">
                  <span style="font-weight: 600; font-size: 10pt; margin-bottom: 14px; display: inline-block;">날짜</span>
                </td>
                <td style="height: 18px; border: none; border-bottom: 1px solid #e8e8e8; background: #f8f9fa; text-align: center; vertical-align: middle; color: #495057; white-space: nowrap; padding: 0 12px;">
                  <span style="font-weight: 600; font-size: 10pt; margin-bottom: 14px; display: inline-block;">금액</span>
                </td>
              </tr>
              ${validPrepayments.map((item) => `
                <tr>
                  <td style="min-width: 100px; height: 18px; border: none; border-bottom: 1px solid #e8e8e8; vertical-align: middle; color: #2d2d2d; white-space: nowrap; padding: 0 12px; text-align: center; border-right: 1px solid #e8e8e8;">
                    <span style="font-size: 10pt; font-weight: 500; color: #495057; vertical-align: middle; margin-bottom: 14px; display: inline-block;">${formatShareDate(item.date)}</span>
                  </td>
                  <td style="height: 18px; border: none; border-bottom: 1px solid #e8e8e8; vertical-align: middle; color: #2d2d2d; white-space: nowrap; padding: 0 12px; text-align: center;">
                    <span style="font-size: 10pt; font-weight: 600; color: #495057; vertical-align: middle; margin-bottom: 14px; display: inline-block;">${formatCurrency(item.amount)}원</span>
                  </td>
                </tr>
              `).join('')}
              <tr>
                <td style="min-width: 100px; height: 18px; border: none; background: #f8f9fa; text-align: center; vertical-align: middle; color: #495057; white-space: nowrap; padding: 0 12px; border-right: 1px solid #e8e8e8;">
                  <div style="display: flex; align-items: center; justify-content: center; gap: 6px;">
                    ${showSparkles ? `<div style="display: flex; align-items: center; color: #495057;">${iconSVG.sparkles}</div>` : ''}
                    <span style="font-weight: 600; font-size: 10pt; margin-bottom: 14px; display: inline-block;">합계</span>
                  </div>
                </td>
                <td style="height: 18px; border: none; background: #f8f9fa; text-align: center; vertical-align: middle; color: #495057; white-space: nowrap; padding: 0 12px;">
                  <span style="font-size: 11pt; font-weight: 700; color: #495057; vertical-align: middle; margin-bottom: 14px; display: inline-block;">${formatCurrency(prepaymentTotal)}원</span>
                </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
        ` : ''}
      </div>
    </div>
  `;

  return tableHTML;
};

const sumMenuAmount = (menus: { cost: number }[]): number =>
  menus.reduce((sum, menu) => sum + (menu.cost || 0), 0);

const sumPrepaymentAmount = (items: { amount: number }[]): number =>
  items.reduce((sum, item) => sum + (item.amount || 0), 0);

// 포장 예약 목록 공유 양식 HTML 생성 함수
const generateReservationListShareHTML = (
  restaurantMenuList: Array<{ restaurantName: string; restaurantKind?: string; reservationDate?: string; menus: Array<{ menu: string; cost: number }> }>,
  restaurantIcons?: Record<string, string>,
  iconSVGCache?: Record<string, string>
): string => {
  const formatCurrency = (value: number): string => {
    return new Intl.NumberFormat('ko-KR').format(value);
  };

  // 유효한 식당만 필터링 (메뉴가 있는 경우만)
  const validRestaurants = restaurantMenuList.filter(
    (restaurant) => restaurant.menus && restaurant.menus.length > 0
  );

  if (validRestaurants.length === 0) {
    return '';
  }

  // 첫번째 예약 식당의 예약 날짜 가져오기
  const firstReservationDate = validRestaurants[0]?.reservationDate;
  let formattedDate = '';
  if (firstReservationDate) {
    // reservationDate는 YYYYMMDD 형식이거나 YYYY.MM.DD 형식일 수 있음
    const date = firstReservationDate.length === 8 
      ? compactToDate(firstReservationDate)
      : displayToDate(firstReservationDate);
    if (date) {
      const month = date.getMonth() + 1;
      const day = date.getDate();
      const weekday = WEEKDAYS[date.getDay()];
      formattedDate = `${month}.${day} (${weekday})`;
    }
  }

  // 각 식당의 메뉴 개수 계산
  const restaurantMenuCounts = validRestaurants.map((r) => r.menus.length);
  const totalRows = restaurantMenuCounts.reduce((sum, count) => sum + count, 0);

  const tableHTML = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; padding: 8px; background: #f5f5f5; border-radius: 12px;">
      <div style="background: white; border-radius: 8px; padding: 4px 10px 10px 10px; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; padding-bottom: 12px; border-bottom: 1px solid #e8e8e8;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <h2 style="align-items: center; margin: 0; font-size: 16px; font-weight: 600; color: #1a1a1a;">포장 예약 목록</h2>
          </div>
          ${formattedDate ? `<span style="font-size: 10pt; font-weight: 600; color: #495057;">${formattedDate}</span>` : ''}
        </div>
        <div style="border: 1px solid #e8e8e8; border-radius: 6px; overflow: hidden; margin-bottom: 0;">
          <table cellspacing="0" cellpadding="0" style="width: 100%; font-size: 11pt; border-collapse: collapse; background-color: rgb(255, 255, 255);">
            <tbody>
              <tr>
                <td style="min-width: 100px; height: 30px; border: none; border-bottom: 1px solid #e8e8e8; background: #f8f9fa; text-align: center; vertical-align: middle; color: #495057; white-space: nowrap; padding: 0 12px; border-right: 1px solid #e8e8e8;">
                  <span style="font-weight: 600; font-size: 10pt; margin-bottom: 14px; display: inline-block;">식당</span>
                </td>
                <td style="height: 30px; border: none; border-bottom: 1px solid #e8e8e8; background: #f8f9fa; text-align: center; vertical-align: middle; color: #495057; white-space: nowrap; padding: 0 12px;">
                  <span style="font-weight: 600; font-size: 10pt; margin-bottom: 14px; display: inline-block;">메뉴</span>
                </td>
              </tr>
              ${validRestaurants.map((restaurant, restaurantIndex) => {
                const menuCount = restaurant.menus.length;
                const isLastRestaurant = restaurantIndex === validRestaurants.length - 1;
                const restaurantIconName = restaurant.restaurantKind && restaurantIcons?.[restaurant.restaurantKind];
                const restaurantIconSVG = restaurantIconName && iconSVGCache?.[restaurantIconName] 
                  ? iconSVGCache[restaurantIconName] 
                  : '';
                
                return restaurant.menus.map((menu, menuIndex) => {
                  const isFirstMenu = menuIndex === 0;
                  const isLastMenu = menuIndex === menuCount - 1;
                  const isLastRow = isLastRestaurant && isLastMenu;
                  
                  return `
                    <tr>
                      ${isFirstMenu ? `
                      <td style="min-width: 100px; height: 30px; border: none; border-bottom: ${isLastMenu && !isLastRestaurant ? '1px solid #e8e8e8' : isLastMenu ? 'none' : '1px solid #e8e8e8'}; background: #f8f9fa; text-align: left; vertical-align: middle; color: #495057; white-space: nowrap; padding: 0 12px; border-right: 1px solid #e8e8e8;" rowspan="${menuCount}">
                        <div style="display: flex; align-items: center; justify-content: flex-start; gap: 6px;">
                          ${restaurantIconSVG ? `<div style="display: flex; align-items: center; color: rgb(37, 0, 170);">${restaurantIconSVG}</div>` : ''}
                          <span style="font-size: 10pt; font-weight: 500; vertical-align: middle; margin-bottom: 14px; display: inline-block;">${restaurant.restaurantName}</span>
                        </div>
                      </td>
                      ` : ''}
                      <td style="height: 30px; border: none; border-bottom: ${isLastMenu && !isLastRestaurant ? '1px solid #e8e8e8' : isLastRow ? 'none' : '1px solid #e8e8e8'}; vertical-align: middle; color: #2d2d2d; white-space: nowrap; padding: 0 12px;">
                        <span style="font-size: 10pt; font-weight: 500; vertical-align: middle; margin-bottom: 14px; display: inline-block;">${menu.menu.trim()}</span>
                      </td>
                    </tr>
                  `;
                }).join('');
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;

  return tableHTML;
};

const getCloudinaryImageUrl = (publicId: string, isThumbnail = false): string => {
  if (!publicId) return '';
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || 'da5h7wjxc';
  const cleanPublicId = publicId.replace(/\.(jpg|jpeg|png|webp|gif)$/i, '');
  const transformation = isThumbnail ? ',w_300' : '';
  return `https://res.cloudinary.com/${cloudName}/image/upload/f_auto,q_auto${transformation}/${cleanPublicId}.jpg`;
};

const getAmountColor = (total: number, prepayment: number, isReceipt: boolean): string => {
  if (isReceipt || total === 0) {
    return 'text-muted-foreground';
  }
  if (prepayment >= total) {
    return 'text-sky-500';
  }
  if (prepayment === 0) {
    return 'text-red-500';
  }
  return 'text-amber-500';
};

const todayCompact = () => dayjs().format('YYYYMMDD');

// 최근 90일 예약 횟수 계산 함수
const getReservationCountLast90Days = (
  restaurantId: string,
  allReservations: Record<string, Record<string, ReservationData>>
): number => {
  const reservations = allReservations[restaurantId];
  if (!reservations) return 0;
  
  const today = dayjs();
  const ninetyDaysAgo = today.subtract(90, 'day');
  
  return Object.keys(reservations).filter(dateKey => {
    if (!dateKey || dateKey.length !== 8) return false;
    const year = dateKey.substring(0, 4);
    const month = dateKey.substring(4, 6);
    const day = dateKey.substring(6, 8);
    const reservationDate = dayjs(`${year}-${month}-${day}`);
    return reservationDate.isAfter(ninetyDaysAgo) || reservationDate.isSame(ninetyDaysAgo, 'day');
  }).length;
};

type RestaurantListProps = {
  restaurants: RestaurantWithReservation[];
  hiddenIds: string[];
  showHidden: boolean;
  onShowHidden: () => void;
  onSelect: (restaurant: RestaurantWithReservation) => void;
  loading: boolean;
  error: string;
  currentTheme: ThemeMode;
  restaurantIcons: Record<string, string>;
  allReservations: Record<string, Record<string, ReservationData>>;
};

function RestaurantList({
  restaurants,
  hiddenIds,
  showHidden,
  onShowHidden,
  onSelect,
  loading,
  error,
  currentTheme,
  restaurantIcons,
  allReservations,
}: RestaurantListProps) {
  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  const hiddenSet = new Set(hiddenIds);
  const visibleRestaurants = restaurants.filter((restaurant) => !hiddenSet.has(restaurant.id));
  const hiddenRestaurants = restaurants.filter((restaurant) => hiddenSet.has(restaurant.id));
  const rows = showHidden ? [...visibleRestaurants, ...hiddenRestaurants] : visibleRestaurants;
  const hasHidden = hiddenRestaurants.length > 0;

  return (
    <Table>
      <TableHeader>
        <TableRow className="border-border/40">
          <TableHead className="w-[38%] text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            식당
          </TableHead>
          <TableHead className="w-[42%] text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            예약메뉴
          </TableHead>
          <TableHead className="w-[20%] text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            전화/네비
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((restaurant) => {
          const reservation = restaurant.reservation;
          const isReceipt = reservation ? reservation.isReceipt : true;
          const menus = reservation?.menus ?? [];
          const menuText = menus.map((menu) => menu.menu).join(' + ');
          const totalAmount = sumMenuAmount(menus);
          const prepaymentTotal = restaurant.prepaymentTotal ?? 0;
          const remaining = Math.max(totalAmount - prepaymentTotal, 0);
          const amountColor = getAmountColor(totalAmount, prepaymentTotal, !!isReceipt);

          return (
            <TableRow
              key={restaurant.id}
              onClick={() => onSelect(restaurant)}
              className={cn(
                'cursor-pointer border-border/30 transition hover:bg-muted/70',
                isReceipt && 'opacity-60'
              )}
            >
              <TableCell className="align-middle">
                <Button
                  variant="outline"
                  size="sm"
                  className={cn(
                    'w-[140px] max-w-[140px] justify-start transition-colors overflow-hidden relative',
                    currentTheme === 'white'
                      ? 'bg-[rgb(250,250,250)] hover:bg-[rgb(240,240,240)]'
                      : 'bg-neutral-900 text-neutral-100 border-neutral-700 hover:bg-neutral-800',
                    !isReceipt &&
                      (currentTheme === 'white'
                        ? 'font-semibold text-foreground'
                        : 'font-semibold text-white')
                  )}
                  onClick={(event) => {
                    event.stopPropagation();
                    onSelect(restaurant);
                  }}
                >
                  {restaurant.kind && restaurantIcons[restaurant.kind] && (() => {
                    const IconComponent = getLucideIcon(restaurantIcons[restaurant.kind]);
                    return IconComponent ? (
                      <IconComponent className={cn(
                        "mr-2 h-4 w-4 shrink-0",
                        restaurant.prepay && "text-green-400"
                      )} />
                    ) : null;
                  })()}
                  <span className="truncate min-w-0">
                    {restaurant.name}
                  </span>
                  {(() => {
                    const reservationCount = getReservationCountLast90Days(restaurant.id, allReservations);
                    if (reservationCount > 0) {
                      return (
                        <div className="absolute top-0 right-0.5 pointer-events-none z-10">
                          <span className={cn(
                            "text-[11px] leading-none font-semibold pr-0.5",
                            currentTheme === 'black' ? 'text-gray-600' : 'text-gray-400'
                          )}>
                            {reservationCount}
                          </span>
                        </div>
                      );
                    }
                    return null;
                  })()}
                </Button>
              </TableCell>
              <TableCell className="align-middle">
                <div
                  className="flex flex-col gap-1"
                  onClick={(event) => event.stopPropagation()}
                >
                    {menuText ? (
                      <span className={cn('text-xs', amountColor)}>{menuText}</span>
                    ) : (
                      <span className="text-xs text-muted-foreground">예약 없음</span>
                    )}
                    {!isReceipt && (
                      <>
                        {prepaymentTotal === 0 ? (
                          <span className="text-xs text-muted-foreground">
                            ({formatCurrency(totalAmount)})
                          </span>
                        ) : (
                          remaining > 0 &&
                          remaining !== totalAmount && (
                            <span className="text-xs text-muted-foreground">
                              ({formatCurrency(remaining)})
                            </span>
                          )
                        )}
                      </>
                    )}
                  </div>
                </TableCell>
                <TableCell className="align-middle">
                  <div className="flex items-center justify-end gap-2">
                    <a
                      href={`tel:${restaurant.telNo}`}
                      onClick={(event) => event.stopPropagation()}
                      className={cn(
                        'rounded-full p-1 transition',
                        currentTheme === 'white'
                          ? 'text-black hover:text-black/80'
                          : 'text-muted-foreground hover:text-foreground'
                      )}
                    >
                      <Phone className="h-4 w-4" />
                    </a>
                    <div
                      onMouseDown={(event) => event.stopPropagation()}
                      onClick={(event) => event.stopPropagation()}
                    >
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={!restaurant.naviUrl}
                        className="h-8 w-8"
                        onClick={(event) => {
                          event.stopPropagation();
                          if (restaurant.naviUrl) {
                            const baseUrl = 'https://map.naver.com/v5/search/';
                            window.open(
                              `${baseUrl}${encodeURIComponent(restaurant.naviUrl)}`,
                              '_blank'
                            );
                          }
                        }}
                      >
                        <Navigation
                          className={cn(
                            'h-4 w-4',
                            !restaurant.naviUrl && currentTheme === 'white' && 'text-gray-400',
                            !restaurant.naviUrl && currentTheme === 'black' && 'text-gray-600'
                          )}
                        />
                      </Button>
                    </div>
                  </div>
                </TableCell>
              </TableRow>
            );
        })}

        {!rows.length && (
          <TableRow>
            <TableCell
              colSpan={3}
              className="py-10 text-center text-sm text-muted-foreground"
            >
              등록된 식당이 없습니다.
            </TableCell>
          </TableRow>
        )}

        {!showHidden && hasHidden && (
          <TableRow>
            <TableCell colSpan={3} className="px-0">
              <div className="flex justify-center py-2">
                <Button variant="ghost" size="icon" onClick={onShowHidden}>
                  <MoreHorizontal
                    className={cn(
                      'h-5 w-5',
                      currentTheme === 'white'
                        ? 'text-[rgb(181,181,181)]'
                        : 'text-[rgb(80,80,80)]'
                    )}
                  />
                </Button>
              </div>
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
}

type RestaurantDetailDialogProps = {
  open: boolean;
  restaurant: RestaurantWithReservation | null;
  menuRows: EditableMenuItem[];
  onMenuChange: (id: string, field: 'menu' | 'cost', value: string | number) => void;
  onAddMenuRow: () => void;
  onRemoveMenuRow: (id: string) => void;
  reservationDate: string;
  onReservationDateChange: (date: Date | undefined) => void;
  prepaymentRows: EditablePrepaymentItem[];
  savedPrepayments: PrepaymentItem[];
  onPrepaymentAmountChange: (id: string, amount: number) => void;
  onPrepaymentDateChange: (id: string, date: Date | undefined) => void;
  onAddPrepaymentRow: () => void;
  onRemovePrepaymentRow: (id: string) => void;
  onShare: () => void;
  onPreview: () => void;
  onReceipt: () => void;
  onSaveMenus: () => void;
  onDeleteMenus: () => void;
  onSavePrepayments: () => void;
  onDeletePrepayments: () => void;
  onClose: () => void;
  onOpenMenuHistory: () => void;
  onOpenRestaurantEditor: () => void;
  onOpenMenuResource: () => void;
  onOpenRegisteredMenuList: () => void;
  hasRegisteredMenus: boolean;
  currentTab: 'menu' | 'prepayment';
  onTabChange: (tab: 'menu' | 'prepayment') => void;
  savingMenus: boolean;
  savingPrepayments: boolean;
  isReceipt: boolean;
  summary: { total: number; prepayment: number; remaining: number };
};


function RestaurantDetailDialog({
  open,
  restaurant,
  menuRows,
  onMenuChange,
  onAddMenuRow,
  onRemoveMenuRow,
  reservationDate,
  onReservationDateChange,
  prepaymentRows,
  savedPrepayments,
  onPrepaymentAmountChange,
  onPrepaymentDateChange,
  onAddPrepaymentRow,
  onRemovePrepaymentRow,
  onShare,
  onPreview,
  onReceipt,
  onSaveMenus,
  onDeleteMenus,
  onSavePrepayments,
  onDeletePrepayments,
  onClose,
  onOpenMenuHistory,
  onOpenRestaurantEditor,
  onOpenMenuResource,
  onOpenRegisteredMenuList,
  hasRegisteredMenus,
  currentTab,
  onTabChange,
  savingMenus,
  savingPrepayments,
  isReceipt,
  summary,
}: RestaurantDetailDialogProps) {
  const [reservationDateOpen, setReservationDateOpen] = useState(false);
  const [prepaymentDateOpens, setPrepaymentDateOpens] = useState<Record<string, boolean>>({});
  const reservationDateValue = useMemo(() => displayToDate(reservationDate), [reservationDate]);

  // 저장된 메뉴 목록
  const savedMenus = useMemo(() => {
    return restaurant?.reservation?.menus ?? [];
  }, [restaurant?.reservation?.menus]);

  // 메뉴가 저장되었는지 확인하는 함수
  // savedIndex가 있으면 저장된 항목
  const isMenuSaved = useCallback((menu: EditableMenuItem) => {
    if (menu.savedIndex !== undefined) {
      const savedItem = savedMenus[menu.savedIndex];
      // 저장된 항목이 존재하고 값이 일치하는지 확인
      return savedItem && savedItem.menu.trim() === menu.menu.trim() && savedItem.cost === menu.cost;
    }
    return false;
  }, [savedMenus]);

  // 선결제가 저장되었는지 확인하는 함수
  const isPrepaymentSaved = useCallback((item: EditablePrepaymentItem) => {
    // savedIndex가 있으면 저장된 항목
    if (item.savedIndex !== undefined) {
      const savedItem = savedPrepayments[item.savedIndex];
      // 저장된 항목이 존재하고 값이 일치하는지 확인
      return savedItem && savedItem.date === item.date && savedItem.amount === item.amount;
    }
    return false;
  }, [savedPrepayments]);

  // 메뉴 탭에 메뉴가 없을 경우 빈행 추가 시 포커스 이동
  useEffect(() => {
    if (open && currentTab === 'menu' && menuRows.length === 1 && menuRows[0].menu === '') {
      setTimeout(() => {
        const input = document.querySelector(`[data-menu-input-id="${menuRows[0].id}"]`) as HTMLInputElement;
        if (input) {
          input.focus();
        }
      }, 100);
    }
  }, [open, currentTab, menuRows]);

  // 결제 탭에 결제 이력이 없을 경우 빈행 추가 시 포커스 이동
  useEffect(() => {
    if (open && currentTab === 'prepayment' && prepaymentRows.length === 1 && prepaymentRows[0].amount === 0) {
      setTimeout(() => {
        const input = document.querySelector(`[data-prepayment-amount-input-id="${prepaymentRows[0].id}"]`) as HTMLInputElement;
        if (input) {
          input.focus();
        }
      }, 100);
    }
  }, [open, currentTab, prepaymentRows]);

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="mx-auto flex h-[90vh] max-h-[90vh] w-[90vw] max-w-[90vw] flex-col items-start justify-center px-1 pt-[5vh] [&>div]:max-w-full [&>div]:w-full [&>div]:rounded-sm">
        {restaurant && (
          <>
            <DialogHeader className="space-y-0 border-b border-border/50 px-5 py-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <DialogTitle className="text-base font-semibold">
                    {restaurant.name}
                  </DialogTitle>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground"
                    onClick={onOpenRestaurantEditor}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  {(restaurant.menuImgId || restaurant.menuUrl) && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground"
                      onClick={onOpenMenuResource}
                    >
                      <BookOpen className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
              {summary.total > 0 && (
                <Alert variant="subtle" className="mt-4 border-none bg-muted">
                  <AlertDescription className="text-xs text-muted-foreground">
                    가격 {formatCurrency(summary.total)}원 - 선결제 {formatCurrency(summary.prepayment)}원 ={' '}
                    {formatCurrency(summary.remaining)}원
                  </AlertDescription>
                </Alert>
              )}
            </DialogHeader>

              <div className="px-5 pt-4">
                <Tabs value={currentTab} onValueChange={(value) => {
                  // 선결제가 false인 경우 선결제 탭으로 전환 불가
                  if (value === 'prepayment' && !restaurant?.prepay) {
                    return;
                  }
                  onTabChange(value as 'menu' | 'prepayment');
                }}>
                  <TabsList className={cn("grid w-full", restaurant?.prepay ? "grid-cols-2" : "grid-cols-1")}>
                    <TabsTrigger value="menu">메뉴</TabsTrigger>
                    {restaurant?.prepay && (
                      <TabsTrigger value="prepayment">선결제</TabsTrigger>
                    )}
                  </TabsList>

                  <TabsContent value="menu" className="pt-4">
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label className="text-xs font-medium text-muted-foreground">예약일</Label>
                        <Popover open={reservationDateOpen} onOpenChange={setReservationDateOpen}>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              className={cn(
                                "h-10 w-full justify-start text-left font-normal",
                                !reservationDateValue && "text-muted-foreground"
                              )}
                            >
                              {reservationDateValue ? (
                                dateToDisplay(reservationDateValue)
                              ) : (
                                <span>예약일을 선택하세요</span>
                              )}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-2" align="start">
                            <Calendar
                              selected={reservationDateValue}
                              defaultMonth={reservationDateValue ?? undefined}
                              onSelect={(date) => {
                                onReservationDateChange(date);
                                setReservationDateOpen(false);
                              }}
                              showOutsideDays={false}
                            />
                          </PopoverContent>
                        </Popover>
                      </div>

                      <div className="rounded-sm border border-border">
                        <div className="flex items-center justify-between border-b border-border bg-muted/60 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          <span className="flex items-center gap-2">
                            메뉴
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground"
                              onClick={onOpenMenuHistory}
                            >
                              <Clock3 className="h-4 w-4" />
                            </Button>
                            {hasRegisteredMenus && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-muted-foreground"
                                onClick={onOpenRegisteredMenuList}
                              >
                                <BookOpen className="h-4 w-4" />
                              </Button>
                            )}
                          </span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground"
                            onClick={onAddMenuRow}
                          >
                            <PlusCircle className="h-4 w-4" />
                          </Button>
                        </div>
                        <div className="divide-y divide-border/60">
                          {menuRows.map((menu) => {
                            const isSaved = isMenuSaved(menu);
                            return (
                              <div
                                key={menu.id}
                                className="grid grid-cols-[1fr_auto_auto] items-center gap-2 px-3 py-2"
                              >
                                <Input
                                  data-menu-input-id={menu.id}
                                  value={menu.menu}
                                  onChange={(event) =>
                                    onMenuChange(menu.id, 'menu', event.target.value)
                                  }
                                  placeholder="메뉴"
                                  className={cn(
                                    "text-sm",
                                    !isSaved && "text-gray-400 dark:text-gray-600"
                                  )}
                                />
                                <Input
                                  type="number"
                                  min={0}
                                  step={100}
                                  value={menu.cost || ''}
                                  onChange={(event) =>
                                    onMenuChange(
                                      menu.id,
                                      'cost',
                                      Number(event.target.value) || 0
                                    )
                                  }
                                  placeholder="금액"
                                  className={cn(
                                    "w-24 text-right text-sm",
                                    !isSaved && "text-gray-400 dark:text-gray-600"
                                  )}
                                />
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-destructive"
                                  onClick={() => onRemoveMenuRow(menu.id)}
                                >
                                  <XCircle className="h-4 w-4" />
                                </Button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="prepayment" className="pt-4">
                    <div className="rounded-sm border border-border">
                      <div className="flex items-center justify-between border-b border-border bg-muted/60 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        <span>선결제</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground"
                          onClick={onAddPrepaymentRow}
                        >
                          <PlusCircle className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="divide-y divide-border/60">
                        {prepaymentRows.map((item) => {
                          const selectedDate = item.dateValue ?? compactToDate(item.date) ?? null;
                          const isSaved = isPrepaymentSaved(item);

                          return (
                            <div
                              key={item.id}
                              className="grid grid-cols-[1fr_auto_auto] items-center gap-2 px-3 py-2"
                            >
                              <Popover
                                open={prepaymentDateOpens[item.id] || false}
                                onOpenChange={(open) =>
                                  setPrepaymentDateOpens((prev) => ({ ...prev, [item.id]: open }))
                                }
                              >
                                <PopoverTrigger asChild>
                                  <Button
                                    variant="outline"
                                    className={cn(
                                      "h-10 w-full justify-start text-left font-normal",
                                      !selectedDate && "text-muted-foreground",
                                      !isSaved && selectedDate && "text-gray-400 dark:text-gray-600"
                                    )}
                                  >
                                    {selectedDate ? (
                                      dateToDisplay(selectedDate)
                                    ) : (
                                      <span>날짜</span>
                                    )}
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-2" align="start">
                                  <Calendar
                                    selected={selectedDate}
                                    defaultMonth={selectedDate ?? undefined}
                                    onSelect={(date) => {
                                      onPrepaymentDateChange(item.id, date);
                                      setPrepaymentDateOpens((prev) => ({
                                        ...prev,
                                        [item.id]: false,
                                      }));
                                    }}
                                    showOutsideDays={false}
                                  />
                                </PopoverContent>
                              </Popover>
                              <Input
                                data-prepayment-amount-input-id={item.id}
                                type="number"
                                min={0}
                                step={100}
                                value={item.amount || ''}
                                onChange={(event) =>
                                  onPrepaymentAmountChange(
                                    item.id,
                                    Number(event.target.value) || 0
                                  )
                                }
                                placeholder="금액"
                                className={cn(
                                  "w-24 text-right text-sm",
                                  !isSaved && "text-gray-400 dark:text-gray-600"
                                )}
                              />
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive"
                                onClick={() => onRemovePrepaymentRow(item.id)}
                              >
                                <XCircle className="h-4 w-4" />
                              </Button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>
              </div>

            <DialogFooter className="mt-auto border-t border-border/50 px-5 py-4">
              <div className="flex w-full flex-wrap items-center justify-center gap-2">
                {process.env.NODE_ENV === 'development' && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={onPreview}
                    disabled={isReceipt}
                    className={cn('h-9 w-9', isReceipt && 'text-gray-400')}
                    title="미리보기"
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onShare}
                  disabled={isReceipt}
                  className={cn('h-9 w-9', isReceipt && 'text-gray-400')}
                >
                  <Share2 className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onReceipt}
                  disabled={isReceipt}
                  className={cn('h-9 w-9', isReceipt && 'text-gray-400')}
                >
                  <Receipt className="h-4 w-4" />
                </Button>
                {currentTab === 'menu' ? (
                  <>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={onSaveMenus}
                      disabled={savingMenus}
                      className={cn('h-9 w-9', savingMenus && 'text-gray-400')}
                    >
                      <Save className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={onDeleteMenus}
                      disabled={isReceipt}
                      className={cn('h-9 w-9 text-destructive', isReceipt && 'text-gray-400')}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={onSavePrepayments}
                      disabled={savingPrepayments}
                      className={cn('h-9 w-9', savingPrepayments && 'text-gray-400')}
                    >
                      <Save className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={onDeletePrepayments}
                      disabled={isReceipt}
                      className={cn('h-9 w-9 text-destructive', isReceipt && 'text-gray-400')}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </>
                )}
              </div>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

type MenuHistoryDialogProps = {
  open: boolean;
  menus: MenuHistoryItem[];
  onClose: () => void;
  onSelect: (menu: MenuHistoryItem) => void;
};

function MenuHistoryDialog({ open, menus, onClose, onSelect }: MenuHistoryDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>메뉴 히스토리</DialogTitle>
          <DialogDescription>이전에 등록한 메뉴를 빠르게 불러올 수 있어요.</DialogDescription>
        </DialogHeader>
        <div className="max-h-80 space-y-2 overflow-y-auto">
          {menus.length === 0 ? (
            <p className="text-sm text-muted-foreground">등록된 메뉴가 없습니다.</p>
          ) : (
            menus.map((menu) => (
              <button
                key={`${menu.menu}-${menu.cost}`}
                type="button"
                className="flex w-full items-center justify-between rounded-sm border border-transparent px-3 py-2 text-left text-sm transition hover:border-border hover:bg-muted"
                onClick={() => onSelect(menu)}
              >
                <span>{menu.menu}</span>
                <span className="text-xs text-muted-foreground">
                  {formatCurrency(menu.cost)}원
                </span>
              </button>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

type RestaurantMenuPickerDialogProps = {
  open: boolean;
  restaurantName?: string;
  menus: Record<string, RestaurantMenu>;
  onClose: () => void;
  onSelect: (menu: RestaurantMenu) => void;
};

function RestaurantMenuPickerDialog({
  open,
  restaurantName,
  menus,
  onClose,
  onSelect,
}: RestaurantMenuPickerDialogProps) {
  const menuEntries = useMemo(() => {
    return Object.values(menus || {})
      .filter((menu) => menu?.name?.trim())
      .sort((a, b) => a.name.localeCompare(b.name, 'ko'));
  }, [menus]);

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{restaurantName ? `${restaurantName} 메뉴` : '등록된 메뉴'}</DialogTitle>
          <DialogDescription>등록된 메뉴에서 선택하여 예약에 추가하세요.</DialogDescription>
        </DialogHeader>
        <div className="max-h-80 space-y-2 overflow-y-auto">
          {menuEntries.length === 0 ? (
            <p className="text-sm text-muted-foreground">등록된 메뉴가 없습니다.</p>
          ) : (
            menuEntries.map((menu, index) => {
              const thumbnailUrl = menu.thumbnail
                ? getCloudinaryImageUrl(menu.thumbnail, true)
                : menu.img
                ? getCloudinaryImageUrl(menu.img)
                : '';
              return (
                <button
                  key={`${menu.name}-${menu.cost}-${index}`}
                  type="button"
                  className="flex w-full items-center gap-3 rounded-sm border border-transparent px-3 py-2 text-left text-sm transition hover:border-border hover:bg-muted"
                  onClick={() => onSelect(menu)}
                >
                  {thumbnailUrl ? (
                    <img
                      src={thumbnailUrl}
                      alt={menu.name}
                      className="h-9 w-9 rounded object-cover"
                      onError={(event) => {
                        (event.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  ) : (
                    <div className="h-9 w-9 rounded bg-muted" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="truncate text-sm font-medium">{menu.name}</div>
                    {menu.cost > 0 && (
                      <div className="text-xs text-muted-foreground">
                        {formatCurrency(menu.cost)}원
                      </div>
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

type RestaurantKindSelectDialogProps = {
  open: boolean;
  selectedKind: string | undefined;
  restaurantKinds: Record<string, { icon?: string; name?: string }>;
  restaurantIcons: Record<string, string>;
  onClose: () => void;
  onSelect: (kind: string) => void;
};

function RestaurantKindSelectDialog({
  open,
  selectedKind,
  restaurantKinds,
  restaurantIcons,
  onClose,
  onSelect,
}: RestaurantKindSelectDialogProps) {
  const kindEntries = Object.entries(restaurantKinds).sort(([a], [b]) => {
    const nameA = restaurantKinds[a]?.name || a;
    const nameB = restaurantKinds[b]?.name || b;
    return nameA.localeCompare(nameB);
  });

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>종류 선택</DialogTitle>
          <DialogDescription>식당 종류를 선택하세요.</DialogDescription>
        </DialogHeader>
        <div className="max-h-80 space-y-2 overflow-y-auto">
          <button
            type="button"
            className={cn(
              'flex w-full items-center gap-2 rounded-sm border border-transparent px-3 py-2 text-left text-sm transition hover:border-border hover:bg-muted',
              !selectedKind && 'border-border bg-muted'
            )}
            onClick={() => {
              onSelect('');
              onClose();
            }}
          >
            <span className="text-muted-foreground">선택 안 함</span>
          </button>
          {kindEntries.map(([kind, data]) => {
            const IconComponent = data?.icon ? getLucideIcon(data.icon) : null;
            const kindName = data?.name || kind;
            const isSelected = selectedKind === kind;

            return (
              <button
                key={kind}
                type="button"
                className={cn(
                  'flex w-full items-center gap-2 rounded-sm border border-transparent px-3 py-2 text-left text-sm transition hover:border-border hover:bg-muted',
                  isSelected && 'border-border bg-muted'
                )}
                onClick={() => {
                  onSelect(kind);
                  onClose();
                }}
              >
                {IconComponent && <IconComponent className="h-4 w-4 shrink-0" />}
                <span>{kindName}</span>
              </button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}

type RestaurantFormDialogProps = {
  open: boolean;
  mode: 'edit' | 'create';
  restaurant: Restaurant;
  onChange: (updates: Partial<Restaurant>) => void;
  onClose: () => void;
  onSave: () => void;
  saving: boolean;
  onToggleHide?: () => void;
  isHidden?: boolean;
  onOpenUpload: () => void;
  restaurantKinds: Record<string, { icon?: string; name?: string }>;
  restaurantIcons: Record<string, string>;
  onMenuSave?: (menuKey: string, menu: RestaurantMenu) => void;
  cloudName?: string;
  mobilePreset?: string;
  thumbnailPreset?: string;
};

function RestaurantFormDialog({
  open,
  mode,
  restaurant,
  onChange,
  onClose,
  onSave,
  saving,
  onToggleHide,
  isHidden = false,
  onOpenUpload,
  restaurantKinds,
  restaurantIcons,
  onMenuSave,
  cloudName,
  mobilePreset,
  thumbnailPreset,
}: RestaurantFormDialogProps) {
  const [kindSelectOpen, setKindSelectOpen] = useState(false);
  const [menuEditOpen, setMenuEditOpen] = useState(false);
  const [menuListOpen, setMenuListOpen] = useState(false);
  const [selectedMenuKey, setSelectedMenuKey] = useState<string | null>(null);
  const [selectedMenu, setSelectedMenu] = useState<RestaurantMenu | null>(null);
  const [menus, setMenus] = useState<Record<string, RestaurantMenu>>({});
  const selectedKindData = restaurant.kind ? restaurantKinds[restaurant.kind] : null;
  const selectedKindName = selectedKindData?.name || restaurant.kind || '';
  const selectedKindIcon = selectedKindData?.icon || (restaurant.kind ? restaurantIcons[restaurant.kind] : undefined);
  const SelectedIconComponent = selectedKindIcon ? getLucideIcon(selectedKindIcon) : null;
  const hasMenuListImage = Boolean(restaurant.menuImgId?.trim());

  // 메뉴 목록 조회
  // restaurant.id만 의존성으로 사용하여 restaurant 객체가 변경되어도 메뉴 목록이 유지되도록 함
  const restaurantId = restaurant.id;
  useEffect(() => {
    if (!open || mode !== 'edit' || !restaurantId) {
      // 팝업이 닫힐 때만 메뉴 목록 초기화
      if (!open) {
        setMenus({});
      }
      return;
    }

    const menuRef = ref(database, `food-resv/restaurant/${restaurantId}/menu`);
    const unsubscribe = onValue(
      menuRef,
      (snapshot) => {
        if (snapshot.exists()) {
          setMenus(snapshot.val() || {});
        } else {
          setMenus({});
        }
      },
      (error) => {
        console.error('Error fetching menus:', error);
        setMenus({});
      }
    );

    return () => unsubscribe();
  }, [open, mode, restaurantId]);

  const handleMenuClick = useCallback((menuKey: string) => {
    const menu = menus[menuKey];
    setSelectedMenuKey(menuKey);
    setSelectedMenu(menu || null);
    setMenuEditOpen(true);
  }, [menus]);

  const handleAddNewMenu = useCallback(() => {
    const newMenuKey = `menu-${Date.now()}`;
    setSelectedMenuKey(newMenuKey);
    setSelectedMenu(null);
    setMenuEditOpen(true);
  }, []);

  const handleMenuManagementClick = useCallback(() => {
    const menuCount = Object.keys(menus).length;
    if (menuCount === 0) {
      // 메뉴가 없으면 바로 메뉴 등록 팝업 열기
      handleAddNewMenu();
    } else {
      // 메뉴가 있으면 메뉴 목록 팝업 열기
      setMenuListOpen(true);
    }
  }, [menus, handleAddNewMenu]);

  const handleMenuSave = useCallback((menuKey: string, menu: RestaurantMenu) => {
    if (onMenuSave) {
      onMenuSave(menuKey, menu);
    }
  }, [onMenuSave]);

  const menuNames = Object.entries(menus).map(([key, menu]) => menu.name).filter(Boolean);

  return (
    <>
      <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
        <DialogContent className={cn(
          "flex h-[90vh] max-h-[90vh] max-w-md flex-col p-0 overflow-hidden !items-start !mt-0",
          "[&>div]:h-full [&>div]:max-h-[90vh] [&>div]:flex [&>div]:flex-col [&>div]:overflow-hidden"
        )}>
          <DialogHeader className="border-b border-border/50 px-5 py-4 shrink-0 flex-shrink-0">
            <DialogTitle>{mode === 'edit' ? restaurant.id : '식당 등록'}</DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto overflow-x-hidden px-5 py-4 min-h-0">
            <div className="space-y-4">
            {mode === 'create' && (
              <div className="space-y-2">
                <Label className="text-xs font-medium text-muted-foreground">식당 ID</Label>
                <Input
                  value={restaurant.id}
                  onChange={(event) =>
                    onChange({
                      id: event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''),
                    })
                  }
                  placeholder="영문 대문자와 숫자 조합"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground">식당명</Label>
              <Input
                value={restaurant.name}
                onChange={(event) => onChange({ name: event.target.value })}
                placeholder="식당명을 입력하세요"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground">종류</Label>
              <Button
                type="button"
                variant="outline"
                className="w-full justify-start"
                onClick={() => setKindSelectOpen(true)}
              >
                {SelectedIconComponent && (
                  <SelectedIconComponent className="mr-2 h-4 w-4 shrink-0" />
                )}
                <span className={cn(!selectedKindName && 'text-muted-foreground')}>
                  {selectedKindName || '종류를 선택하세요'}
                </span>
              </Button>
            </div>

          <div className="space-y-2">
            <Label className="text-xs font-medium text-muted-foreground">전화번호</Label>
            <Input
              value={restaurant.telNo ?? ''}
              onChange={(event) => onChange({ telNo: event.target.value })}
              placeholder="전화번호"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-medium text-muted-foreground">메뉴 URL</Label>
            <Input
              value={restaurant.menuUrl ?? ''}
              onChange={(event) => onChange({ menuUrl: event.target.value })}
              placeholder="메뉴 페이지 URL"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-medium text-muted-foreground">메뉴 리스트 이미지</Label>
            <Button
              type="button"
              variant="outline"
              className="w-full justify-start"
              onClick={onOpenUpload}
            >
              <Camera className={cn("mr-2 h-4 w-4", hasMenuListImage && "text-green-500")} />
              <span className="flex-1 text-left">
                {hasMenuListImage ? '이미지 업로드됨' : '이미지 업로드'}
              </span>
              {hasMenuListImage && (
                <X
                  className="ml-auto h-4 w-4 text-red-500"
                  onClick={(e) => {
                    e.stopPropagation();
                    onChange({ menuImgId: '' });
                  }}
                />
              )}
            </Button>
          </div>

          {mode === 'edit' && (
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground">메뉴 관리</Label>
              <div 
                className="flex flex-wrap items-center gap-2 min-h-[2.5rem] rounded-md border border-input bg-background px-3 py-2 cursor-pointer hover:bg-muted/50"
                onClick={handleMenuManagementClick}
              >
                {menuNames.length > 0 ? (
                  menuNames.map((name, index) => (
                    <span key={index} className="text-sm">
                      {name}
                      {index < menuNames.length - 1 && (
                        <span className="text-muted-foreground">, </span>
                      )}
                    </span>
                  ))
                ) : (
                  <span className="text-sm text-muted-foreground">등록된 메뉴가 없습니다. 클릭하여 메뉴를 추가하세요.</span>
                )}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label className="text-xs font-medium text-muted-foreground">식당 위치</Label>
            <Input
              value={restaurant.naviUrl ?? ''}
              onChange={(event) => onChange({ naviUrl: event.target.value })}
              placeholder="네이버 지도 검색어 또는 주소"
            />
          </div>

          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="prepay-checkbox"
              checked={restaurant.prepay ?? false}
              onChange={(event) => onChange({ prepay: event.target.checked })}
              className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
            />
            <Label htmlFor="prepay-checkbox" className="text-xs font-medium text-muted-foreground cursor-pointer">
              선결제 가능
            </Label>
          </div>

          {mode === 'edit' && onToggleHide && (
            <div className="flex items-center justify-between">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className={cn(
                  'justify-start text-sm text-muted-foreground',
                  isHidden && 'text-destructive'
                )}
                onClick={onToggleHide}
              >
                <EyeOff className="mr-2 h-4 w-4" />
                {isHidden ? '이 식당 다시 표시하기' : '이 식당 감추기'}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={onSave}
                disabled={saving}
                className="h-8 w-8"
              >
                {saving ? <Spinner size="sm" /> : <Save className="h-4 w-4" />}
              </Button>
            </div>
          )}
          {mode === 'create' && (
            <div className="flex justify-end">
              <Button
                variant="ghost"
                size="icon"
                onClick={onSave}
                disabled={saving || !restaurant.id || !restaurant.name}
                className="h-8 w-8"
              >
                {saving ? <Spinner size="sm" /> : <Save className="h-4 w-4" />}
              </Button>
            </div>
          )}
          </div>
        </div>
      </DialogContent>
    </Dialog>

    <RestaurantKindSelectDialog
      open={kindSelectOpen}
      selectedKind={restaurant.kind}
      restaurantKinds={restaurantKinds}
      restaurantIcons={restaurantIcons}
      onClose={() => setKindSelectOpen(false)}
      onSelect={(kind) => onChange({ kind })}
    />

    {mode === 'edit' && cloudName && mobilePreset && thumbnailPreset && (
      <>
        <MenuListDialog
          open={menuListOpen}
          restaurantName={restaurant.name}
          menus={menus}
          onClose={() => setMenuListOpen(false)}
          onMenuClick={handleMenuClick}
          onAddNewMenu={() => {
            setMenuListOpen(false);
            handleAddNewMenu();
          }}
          onEditMenu={(menuKey) => {
            setMenuListOpen(false);
            handleMenuClick(menuKey);
          }}
        />
        <MenuEditDialog
          open={menuEditOpen}
          menu={selectedMenu}
          menuKey={selectedMenuKey}
          restaurantId={restaurant.id}
          cloudName={cloudName}
          mobilePreset={mobilePreset}
          thumbnailPreset={thumbnailPreset}
          onClose={() => {
            setMenuEditOpen(false);
            setSelectedMenuKey(null);
            setSelectedMenu(null);
          }}
          onSave={handleMenuSave}
        />
      </>
    )}
    </>
  );
}

type ThemeDialogProps = {
  open: boolean;
  selectedTheme: ThemeMode;
  onClose: () => void;
  onSelect: (theme: ThemeMode) => void;
  saving: boolean;
};

function ThemeDialog({ open, selectedTheme, onClose, onSelect, saving }: ThemeDialogProps) {
  const renderThemeButton = (theme: ThemeMode, label: string) => {
    const isActive = selectedTheme === theme;
    return (
      <Button
        type="button"
        variant="outline"
        disabled={saving}
        onClick={() => onSelect(theme)}
        className={cn(
          'h-10 justify-between px-4 text-sm font-medium transition-colors border',
          theme === 'white'
            ? 'bg-white text-black hover:bg-white/90'
            : 'bg-black text-white hover:bg-black/80',
          isActive
            ? 'border-primary ring-2 ring-primary ring-offset-2 ring-offset-background'
            : 'border-border/80'
        )}
      >
        <span>{label}</span>
        {saving && isActive ? <Spinner size="sm" /> : null}
      </Button>
    );
  };

  return (
    <AlertDialog open={open} onOpenChange={(next) => !next && onClose()}>
      <AlertDialogContent className="space-y-4">
        <AlertDialogHeader>
          <AlertDialogTitle>테마 설정</AlertDialogTitle>
          <AlertDialogDescription>사용할 테마를 선택하세요.</AlertDialogDescription>
        </AlertDialogHeader>
        <div className="flex flex-col gap-2">
          {renderThemeButton('white', '화이트')}
          {renderThemeButton('black', '블랙')}
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onClose} disabled={saving}>
            닫기
          </AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

type DeleteConfirmDialogProps = {
  open: boolean;
  target: DeleteTarget | null;
  onCancel: () => void;
  onConfirm: () => void;
};

function DeleteConfirmDialog({ open, target, onCancel, onConfirm }: DeleteConfirmDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={(next) => !next && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>삭제하시겠어요?</AlertDialogTitle>
          <AlertDialogDescription>
            {target === 'prepayment'
              ? '선결제 내역을 모두 삭제합니다.'
              : '선택한 식당의 예약 정보를 삭제합니다.'}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>취소</AlertDialogCancel>
          <AlertDialogAction
            onClick={(event) => {
              event.preventDefault();
              onConfirm();
            }}
          >
            삭제
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export default function Home() {
  const { user } = useAuth();
  const router = useRouter();

  const [restaurants, setRestaurants] = useState<RestaurantWithReservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [allReservations, setAllReservations] = useState<Record<string, Record<string, ReservationData>>>({});

  const [selectedRestaurant, setSelectedRestaurant] = useState<RestaurantWithReservation | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [menuRows, setMenuRows] = useState<EditableMenuItem[]>([]);
  const [reservationDate, setReservationDate] = useState<string>('');
  const [prepaymentRows, setPrepaymentRows] = useState<EditablePrepaymentItem[]>([]);
  const [savedPrepayments, setSavedPrepayments] = useState<PrepaymentItem[]>([]);
  const [currentTab, setCurrentTab] = useState<'menu' | 'prepayment'>('menu');
  const [savingMenus, setSavingMenus] = useState(false);
  const [savingPrepayments, setSavingPrepayments] = useState(false);

  const [deleteState, setDeleteState] = useState<{ open: boolean; target: DeleteTarget | null }>({
    open: false,
    target: null,
  });

  const [menuHistoryOpen, setMenuHistoryOpen] = useState(false);
  const [menuHistoryList, setMenuHistoryList] = useState<MenuHistoryItem[]>([]);
  const [registeredMenuListOpen, setRegisteredMenuListOpen] = useState(false);
  const [restaurantMenus, setRestaurantMenus] = useState<Record<string, RestaurantMenu>>({});

  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editableRestaurant, setEditableRestaurant] = useState<Restaurant | null>(null);
  const [newRestaurant, setNewRestaurant] = useState<Restaurant>({
    id: '',
    name: '',
    telNo: '',
    kind: '',
    menuImgId: '',
    menuUrl: '',
    naviUrl: '',
    prepay: false,
  });
  const [savingRestaurant, setSavingRestaurant] = useState(false);
  const [creatingRestaurant, setCreatingRestaurant] = useState(false);

  const [currentTheme, setCurrentTheme] = useState<ThemeMode>(() => {
    if (typeof window !== 'undefined') {
      const savedTheme = localStorage.getItem('theme');
      if (savedTheme === 'white' || savedTheme === 'black') {
        return savedTheme;
      }
    }
    return 'white';
  });
  const [selectedTheme, setSelectedTheme] = useState<ThemeMode>(() => {
    if (typeof window !== 'undefined') {
      const savedTheme = localStorage.getItem('theme');
      if (savedTheme === 'white' || savedTheme === 'black') {
        return savedTheme;
      }
    }
    return 'white';
  });
  const [themeDialogOpen, setThemeDialogOpen] = useState(false);

  const [hiddenRestaurantIds, setHiddenRestaurantIds] = useState<string[]>([]);
  const [showHidden, setShowHidden] = useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [uploadContext, setUploadContext] = useState<UploadContext | null>(null);
  const [restaurantIcons, setRestaurantIcons] = useState<Record<string, string>>({});
  const [restaurantKinds, setRestaurantKinds] = useState<Record<string, { icon?: string; name?: string }>>({});
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const [iconSVGCache, setIconSVGCache] = useState<Record<string, string>>({});
  const [kindManageDialogOpen, setKindManageDialogOpen] = useState(false);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', currentTheme === 'black');
  }, [currentTheme]);

  useEffect(() => {
    if (!hiddenRestaurantIds.length) {
      setShowHidden(false);
    }
  }, [hiddenRestaurantIds]);

  const selectedRestaurantId = selectedRestaurant?.id;
  const hasRegisteredMenus = useMemo(
    () => Object.values(restaurantMenus).some((menu) => menu?.name?.trim()),
    [restaurantMenus]
  );

  useEffect(() => {
    setRegisteredMenuListOpen(false);
    if (!selectedRestaurantId) {
      setRestaurantMenus({});
      return;
    }

    const menuRef = ref(database, `food-resv/restaurant/${selectedRestaurantId}/menu`);
    const unsubscribe = onValue(
      menuRef,
      (snapshot) => {
        if (snapshot.exists()) {
          setRestaurantMenus(snapshot.val() || {});
        } else {
          setRestaurantMenus({});
        }
      },
      (error) => {
        console.error('Error fetching restaurant menus:', error);
        setRestaurantMenus({});
      }
    );

    return () => unsubscribe();
  }, [selectedRestaurantId]);

  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || 'da5h7wjxc';
  const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET_MOBILE || 'menu-mobile';
  const thumbnailPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET_THUMBNAIL || uploadPreset;

  const handleUploadDialogClose = useCallback(() => {
    setUploadDialogOpen(false);
    setUploadContext(null);
  }, []);

  const handleOpenUploadDialog = useCallback((context: UploadContext) => {
    setUploadContext(context);
    setUploadDialogOpen(true);
  }, []);

  const handleUploadSuccess = useCallback(
    async (publicId: string) => {
      const context = uploadContext;

      if (context === 'edit') {
        // edit 모드: 바로 DB에 저장
        const currentRestaurant = editableRestaurant;
        if (currentRestaurant?.id) {
          try {
            const restaurantRef = ref(database, `food-resv/restaurant/${currentRestaurant.id}`);
            await update(restaurantRef, {
              menuImgId: publicId,
            });
            setEditableRestaurant((prev) => (prev ? { ...prev, menuImgId: publicId } : prev));
            toast.success('이미지를 업로드하고 저장했습니다.');
          } catch (error) {
            console.error('Error saving menu image:', error);
            toast.error('이미지를 저장하는 중 오류가 발생했습니다.');
            return;
          }
        } else {
          setEditableRestaurant((prev) => (prev ? { ...prev, menuImgId: publicId } : prev));
          toast.success('이미지를 업로드했습니다.');
        }
      } else if (context === 'create') {
        // create 모드: state에만 저장 (식당 등록 시 함께 저장됨)
        setNewRestaurant((prev) => ({ ...prev, menuImgId: publicId }));
        toast.success('이미지를 업로드했습니다.');
      }

      handleUploadDialogClose();
    },
    [handleUploadDialogClose, uploadContext, editableRestaurant]
  );

  useEffect(() => {
    const restaurantKindRef = ref(database, 'food-resv/restaurant-kind');
    const unsubscribe = onValue(
      restaurantKindRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const kindData = snapshot.val() as Record<string, { icon?: string; name?: string }>;
          const icons: Record<string, string> = {};
          Object.entries(kindData).forEach(([kind, data]) => {
            if (data?.icon) {
              icons[kind] = data.icon;
            }
          });
          setRestaurantIcons(icons);
          setRestaurantKinds(kindData);
        } else {
          setRestaurantIcons({});
          setRestaurantKinds({});
        }
      },
      (err) => {
        console.error('Error fetching restaurant kinds:', err);
      }
    );

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;

    const restaurantsRef = ref(database, 'food-resv/restaurant');
    const reservationRef = ref(database, `food-resv/reservation/${user.uid}`);
    const prepaymentRef = ref(database, `food-resv/prepayment/${user.uid}`);
    const hideRef = ref(database, `food-resv/hideRestaurant/${user.uid}`);

    let restaurantData: Record<string, Restaurant> = {};
    let reservationData: Record<string, Record<string, ReservationData>> = {};
    let prepaymentData: Record<string, PrepaymentItem[]> = {};
    let hideData: string[] = [];

    const combine = () => {
      if (!restaurantData || Object.keys(restaurantData).length === 0) {
        setRestaurants([]);
        setLoading(false);
        return;
      }

      const list: RestaurantWithReservation[] = Object.entries(restaurantData).map(
        ([id, restaurantEntry]) => {
          const reservations = reservationData[id];
          let latestDate: string | undefined;
          let latestReservation: ReservationData | undefined;

          if (reservations) {
            const dates = Object.keys(reservations);
            if (dates.length > 0) {
              dates.sort((a, b) => b.localeCompare(a));
              latestDate = dates[0];
              latestReservation = reservations[latestDate];
            }
          }

          const prepayments = prepaymentData[id] ?? [];
          const prepaymentTotal = prepayments.reduce(
            (sum, item) => sum + (item.amount || 0),
            0
          );

          return {
            id,
            name: restaurantEntry.name,
            telNo: restaurantEntry.telNo,
            kind: restaurantEntry.kind,
            menuImgId: restaurantEntry.menuImgId,
            menuUrl: restaurantEntry.menuUrl,
            naviUrl: restaurantEntry.naviUrl,
            prepay: restaurantEntry.prepay,
            reservationDate: latestDate,
            reservation: latestReservation,
            prepaymentTotal,
          };
        }
      );

      list.sort((a, b) => {
        if (!a.reservationDate && !b.reservationDate) return 0;
        if (!a.reservationDate) return 1;
        if (!b.reservationDate) return -1;
        return b.reservationDate.localeCompare(a.reservationDate);
      });

      setRestaurants(list);
      setHiddenRestaurantIds(hideData || []);
      setLoading(false);
      setError('');
    };

    const unsubRestaurant = onValue(
      restaurantsRef,
      (snapshot) => {
        restaurantData = snapshot.exists() ? snapshot.val() : {};
        combine();
      },
      (err) => {
        console.error('Error fetching restaurants:', err);
        setError('레스토랑 데이터를 불러오는 중 오류가 발생했습니다.');
        setLoading(false);
      }
    );

    const unsubReservation = onValue(
      reservationRef,
      (snapshot) => {
        reservationData = snapshot.exists() ? snapshot.val() : {};
        setAllReservations(reservationData);
        combine();
      },
      (err) => {
        console.error('Error fetching reservations:', err);
      }
    );

    const unsubPrepayment = onValue(
      prepaymentRef,
      (snapshot) => {
        prepaymentData = snapshot.exists() ? snapshot.val() : {};
        combine();
      },
      (err) => {
        console.error('Error fetching prepayments:', err);
      }
    );

    const unsubHidden = onValue(
      hideRef,
      (snapshot) => {
        hideData = snapshot.exists() ? snapshot.val() ?? [] : [];
        combine();
      },
      (err) => {
        console.error('Error fetching hideRestaurants:', err);
      }
    );

    return () => {
      unsubRestaurant();
      unsubReservation();
      unsubPrepayment();
      unsubHidden();
    };
  }, [user]);

  const outstandingAmount = useMemo(() => {
    return restaurants.reduce((sum, restaurant) => {
      if (!restaurant.reservation || restaurant.reservation.isReceipt) {
        return sum;
      }
      const total = sumMenuAmount(restaurant.reservation.menus);
      const prepayment = restaurant.prepaymentTotal ?? 0;
      const remaining = total - prepayment;
      return remaining > 0 ? sum + remaining : sum;
    }, 0);
  }, [restaurants]);

  const handleMenuChange = (id: string, field: 'menu' | 'cost', value: string | number) => {
    setMenuRows((prev) =>
      prev.map((row) =>
        row.id === id
          ? {
              ...row,
              [field]: field === 'cost' ? Math.max(0, Number(value)) : (value as string),
              savedIndex: undefined, // 메뉴 변경 시 savedIndex 제거
            }
          : row
      )
    );
  };

  const handleAddMenuRow = () => {
    const newId = `menu-${Date.now()}-${menuRows.length}`;
    setMenuRows((prev) => [
      ...prev,
      { id: newId, menu: '', cost: 0 },
    ]);
    // 포커스를 이동하기 위해 새 행 ID를 설정
    setTimeout(() => {
      const input = document.querySelector(`[data-menu-input-id="${newId}"]`) as HTMLInputElement;
      if (input) {
        input.focus();
      }
    }, 0);
  };

  const handleRemoveMenuRow = (id: string) => {
    setMenuRows((prev) => {
      if (prev.length === 1) {
        return prev.map((row) =>
          row.id === id ? { ...row, menu: '', cost: 0 } : row
        );
      }
      return prev.filter((row) => row.id !== id);
    });
  };

  const handlePrepaymentAmountChange = (id: string, amount: number) => {
    setPrepaymentRows((prev) =>
      prev.map((row) =>
        row.id === id ? { ...row, amount: Math.max(0, amount) } : row
      )
    );
  };

  const handlePrepaymentDateChange = (id: string, date: Date | undefined) => {
    if (!date || Number.isNaN(date.getTime())) return;
    setPrepaymentRows((prev) =>
      prev.map((row) =>
        row.id === id
          ? { ...row, dateValue: date, date: dayjs(date).format('YYYYMMDD') }
          : row
      )
    );
  };

  const handleAddPrepaymentRow = () => {
    const now = new Date();
    const newId = `prepayment-${Date.now()}-${prepaymentRows.length}`;
    setPrepaymentRows((prev) => [
      ...prev,
      {
        id: newId,
        amount: 0,
        date: dayjs(now).format('YYYYMMDD'),
        dateValue: now,
      },
    ]);
    // 포커스를 이동하기 위해 새 행 ID를 설정
    setTimeout(() => {
      const input = document.querySelector(`[data-prepayment-amount-input-id="${newId}"]`) as HTMLInputElement;
      if (input) {
        input.focus();
      }
    }, 0);
  };

  const handleRemovePrepaymentRow = (id: string) => {
    setPrepaymentRows((prev) => {
      if (prev.length === 1) {
        const now = new Date();
        return [
          {
            id: prev[0].id,
            amount: 0,
            date: dayjs(now).format('YYYYMMDD'),
            dateValue: now,
          },
        ];
      }
      return prev.filter((row) => row.id !== id);
    });
  };

  const handleReservationDateChange = (date: Date | undefined) => {
    if (!date || Number.isNaN(date.getTime())) return;
    setReservationDate(dateToDisplay(date));
  };

  const handleToggleHide = async (restaurantId: string) => {
    if (!user) return;
    try {
      const next = hiddenRestaurantIds.includes(restaurantId)
        ? hiddenRestaurantIds.filter((id) => id !== restaurantId)
        : [...hiddenRestaurantIds, restaurantId];
      await set(ref(database, `food-resv/hideRestaurant/${user.uid}`), next);
      toast.success('숨김 상태가 변경되었습니다.');
    } catch (error) {
      console.error('Error toggling hide', error);
      toast.error('숨김 상태 변경 중 오류가 발생했습니다.');
    }
  };

  const loadPrepayments = useCallback(
    async (userId: string, restaurantId: string) => {
      try {
        const prepaymentRef = ref(database, `food-resv/prepayment/${userId}/${restaurantId}`);
        const snapshot = await get(prepaymentRef);
        if (snapshot.exists()) {
          const data: PrepaymentItem[] = snapshot.val() ?? [];
          if (data.length) {
            setSavedPrepayments(data);
            setPrepaymentRows(
              data.map((item, index) => {
                const dateValue = compactToDate(item.date) ?? new Date();
                return {
                  id: `prepayment-${Date.now()}-${index}`,
                  amount: item.amount || 0,
                  date: item.date || todayCompact(),
                  dateValue,
                  savedIndex: index, // 저장된 항목의 인덱스 저장
                };
              })
            );
            return;
          }
        }
      } catch (error) {
        console.error('Error loading prepayments', error);
      }
      setSavedPrepayments([]);
      const today = new Date();
      setPrepaymentRows([
        {
          id: `prepayment-${Date.now()}`,
          amount: 0,
          date: dayjs(today).format('YYYYMMDD'),
          dateValue: today,
        },
      ]);
    },
    []
  );

  const handleRestaurantClick = useCallback(
    async (restaurant: RestaurantWithReservation) => {
      if (!user) return;

      const hasActiveReservation = restaurant.reservation?.isReceipt === false;

      setSelectedRestaurant(restaurant);
      const existingReservationDate =
        hasActiveReservation && restaurant.reservationDate
          ? compactToDisplay(restaurant.reservationDate)
          : '';
      const fallbackReservationDate = compactToDisplay(getNextFriday());
      setReservationDate(existingReservationDate || fallbackReservationDate);

      if (restaurant.reservation && hasActiveReservation) {
        setMenuRows(
          restaurant.reservation.menus.map((menu, index) => ({
            id: `menu-${Date.now()}-${index}`,
            menu: menu.menu,
            cost: menu.cost,
            savedIndex: index, // 저장된 메뉴의 인덱스 설정
          }))
        );
      } else {
        setMenuRows([{ id: `menu-${Date.now()}`, menu: '', cost: 0 }]);
      }

      await loadPrepayments(user.uid, restaurant.id);
      // 선결제가 false인 경우 메뉴 탭으로 열기
      if (hasActiveReservation && restaurant.prepay) {
        setCurrentTab('prepayment');
      } else {
        setCurrentTab('menu');
      }
      setDetailOpen(true);
    },
    [loadPrepayments, user]
  );

  const handleCloseDetail = () => {
    setDetailOpen(false);
    setSelectedRestaurant(null);
    setMenuRows([]);
    setPrepaymentRows([]);
    setSavedPrepayments([]);
    setReservationDate('');
    setMenuHistoryList([]);
    setMenuHistoryOpen(false);
    setRestaurantMenus({});
    setRegisteredMenuListOpen(false);
    setCurrentTab('menu');
  };

  const handleSaveMenus = async () => {
    if (!user || !selectedRestaurant) return;

    const validMenus = menuRows.filter((menu) => menu.menu.trim() && menu.cost > 0);
    if (!validMenus.length) {
      toast.error('메뉴와 금액을 입력해주세요.');
      return;
    }
    if (!reservationDate) {
      toast.error('예약일을 선택해주세요.');
      return;
    }

      try {
        setSavingMenus(true);
        const reservationKey = displayToCompact(reservationDate);
        const restaurantId = selectedRestaurant.id;
        const reservationPath = `food-resv/reservation/${user.uid}/${restaurantId}/${reservationKey}`;
        const data: ReservationData = {
          isReceipt: false,
          menus: validMenus.map((menu) => ({
            menu: menu.menu.trim(),
            cost: menu.cost,
          })),
        };
        await set(ref(database, reservationPath), data);
        toast.success('예약 정보를 저장했습니다.');
        setSelectedRestaurant((prev) =>
          prev && prev.id === restaurantId
            ? {
                ...prev,
                reservationDate: reservationKey,
                reservation: data,
              }
            : prev
        );
        setRestaurants((prev) =>
          prev.map((restaurant) =>
            restaurant.id === restaurantId
              ? {
                  ...restaurant,
                  reservationDate: reservationKey,
                  reservation: data,
                }
              : restaurant
          )
        );
        // 저장 후 savedIndex 설정
        // 저장된 메뉴 배열의 인덱스를 사용
        setMenuRows((prev) =>
          prev.map((menu) => {
            const savedIndex = data.menus.findIndex(
              (saved) => saved.menu.trim() === menu.menu.trim() && saved.cost === menu.cost
            );
            return {
              ...menu,
              savedIndex: savedIndex >= 0 ? savedIndex : undefined,
            };
          })
        );
    } catch (error) {
      console.error('Error saving reservation', error);
      toast.error('예약 저장 중 오류가 발생했습니다.');
    } finally {
      setSavingMenus(false);
    }
  };

  const handleDeleteMenus = () => {
    setDeleteState({ open: true, target: 'reservation' });
  };

  const handleSavePrepayments = async () => {
    if (!user || !selectedRestaurant) return;

    const validItems = prepaymentRows
      .filter((item) => item.amount > 0 && item.date)
      .map((item) => ({
        amount: item.amount,
        date: item.date,
      }));

    try {
      setSavingPrepayments(true);
      const prepaymentPath = `food-resv/prepayment/${user.uid}/${selectedRestaurant.id}`;
      await set(ref(database, prepaymentPath), validItems);
      setSavedPrepayments(validItems);
      // 저장 후 prepaymentRows의 savedIndex 업데이트
      setPrepaymentRows((prev) =>
        prev.map((item) => {
          const savedIndex = validItems.findIndex(
            (saved) => saved.date === item.date && saved.amount === item.amount
          );
          return {
            ...item,
            savedIndex: savedIndex >= 0 ? savedIndex : undefined,
          };
        })
      );
      toast.success('선결제를 저장했습니다.');
    } catch (error) {
      console.error('Error saving prepayment', error);
      toast.error('선결제 저장 중 오류가 발생했습니다.');
    } finally {
      setSavingPrepayments(false);
    }
  };

    const handleDeletePrepayments = () => {
      setDeleteState({ open: true, target: 'prepayment' });
    };
  
    const handleReceipt = async () => {
      if (!user || !selectedRestaurant) return;
      if (!reservationDate) {
        toast.error('예약일이 필요합니다.');
        return;
      }
  
      try {
        const reservationKey = displayToCompact(reservationDate);
        const reservationPath = `food-resv/reservation/${user.uid}/${selectedRestaurant.id}/${reservationKey}`;
        const snapshot = await get(ref(database, reservationPath));
  
        if (snapshot.exists()) {
          const existing = snapshot.val() as ReservationData;
          await set(ref(database, reservationPath), { ...existing, isReceipt: true });
        }
  
        await remove(ref(database, `food-resv/prepayment/${user.uid}/${selectedRestaurant.id}`));
        setSavedPrepayments([]);
        toast.success('수령 처리되었습니다.');
        handleCloseDetail();
      } catch (error) {
        console.error('Error processing receipt', error);
        toast.error('수령 처리 중 오류가 발생했습니다.');
      }
    };
  
    const handleConfirmDelete = async () => {
      if (!user || !selectedRestaurant || !deleteState.target) return;
  
      const reservationKey =
        deleteState.target === 'reservation' ? displayToCompact(reservationDate) : '';
  
      if (deleteState.target === 'reservation') {
        if (!reservationDate || reservationKey.length !== 8) {
          toast.error('예약일을 확인해주세요.');
          setDeleteState({ open: false, target: null });
          return;
        }
      }
  
      try {
        if (deleteState.target === 'reservation') {
          await remove(
            ref(
              database,
              `food-resv/reservation/${user.uid}/${selectedRestaurant.id}/${reservationKey}`
            )
          );
          toast.success('예약 정보를 삭제했습니다.');
          handleCloseDetail();
        } else {
          await remove(ref(database, `food-resv/prepayment/${user.uid}/${selectedRestaurant.id}`));
          setSavedPrepayments([]);
          toast.success('선결제를 삭제했습니다.');
          await loadPrepayments(user.uid, selectedRestaurant.id);
        }
      } catch (error) {
        console.error('Error deleting data', error);
        toast.error('삭제 중 오류가 발생했습니다.');
      } finally {
        setDeleteState({ open: false, target: null });
      }
    };

  // 공유 HTML 생성 함수 (공통)
  // iconSVGCache: 아이콘 SVG 캐시 (이벤트 핸들러에서 미리 생성)
  const getShareHTML = (iconSVGCache?: Record<string, string>) => {
    if (!selectedRestaurant) return '';
    
    const validMenus = menuRows
      .filter((menu) => menu.menu.trim() && menu.cost > 0)
      .map((menu) => ({ menu: menu.menu, cost: menu.cost }));
    const validPrepayments = prepaymentRows
      .filter((item) => item.amount > 0 && item.date)
      .map((item) => ({ date: item.date, amount: item.amount }));

    return generateShareFormHTML(
      selectedRestaurant.name,
      validMenus,
      reservationDate,
      validPrepayments,
      selectedRestaurant.kind,
      restaurantIcons,
      iconSVGCache
    );
  };

  const handlePreview = async () => {
    if (!selectedRestaurant) return;
    
    // 아이콘 SVG를 미리 생성하여 캐시에 저장
    const cache: Record<string, string> = {};
    if (selectedRestaurant.kind && restaurantIcons[selectedRestaurant.kind]) {
      const iconName = restaurantIcons[selectedRestaurant.kind];
      cache[iconName] = await getLucideIconSVG(iconName);
    }
    
    // 아이콘 SVG 캐시를 상태에 저장하여 미리보기에서 사용
    setIconSVGCache(cache);
    setPreviewDialogOpen(true);
  };

  const handleShare = async () => {
    if (!selectedRestaurant) return;

    // 아이콘 SVG를 미리 생성하여 캐시에 저장
    // 이렇게 하면 React 렌더링 중이 아닌 이벤트 핸들러에서 아이콘을 렌더링할 수 있습니다.
    const iconSVGCache: Record<string, string> = {};
    if (selectedRestaurant.kind && restaurantIcons[selectedRestaurant.kind]) {
      const iconName = restaurantIcons[selectedRestaurant.kind];
      iconSVGCache[iconName] = await getLucideIconSVG(iconName);
    }

    const tableHTML = getShareHTML(iconSVGCache);

    try {
      // 임시 div 생성
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = tableHTML;
      tempDiv.style.position = 'absolute';
      tempDiv.style.left = '-9999px';
      tempDiv.style.top = '0';
      document.body.appendChild(tempDiv);

      // html2canvas로 이미지 변환
      const canvas = await html2canvas(tempDiv.firstElementChild as HTMLElement, {
        backgroundColor: '#ffffff',
        scale: 2,
        logging: false,
        useCORS: true,
      } as Parameters<typeof html2canvas>[1]);

      // 임시 div 제거
      document.body.removeChild(tempDiv);

      // Canvas를 Blob으로 변환
      canvas.toBlob(async (blob) => {
        if (!blob) {
          toast.error('이미지 생성 중 오류가 발생했습니다.');
          return;
        }

        const file = new File([blob], `${selectedRestaurant.name}_예약정보.png`, {
          type: 'image/png',
        });

        try {
          if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
            await navigator.share({
              title: `${selectedRestaurant.name} 예약정보`,
              files: [file],
            });
          } else {
            // 다운로드
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `${selectedRestaurant.name}_예약정보.png`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            toast.success('이미지가 다운로드되었습니다.');
          }
        } catch (error) {
          if ((error as Error).name !== 'AbortError') {
            console.error('Error sharing', error);
            // 다운로드로 폴백
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `${selectedRestaurant.name}_예약정보.png`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            toast.success('이미지가 다운로드되었습니다.');
          }
        }
      }, 'image/png');
    } catch (error) {
      console.error('Error creating image', error);
      toast.error('이미지 생성 중 오류가 발생했습니다.');
    }
  };

  const handleReservationListShare = async () => {
    // 수령하지 않은 메뉴 목록 수집
    const restaurantMenuList: Array<{ restaurantName: string; restaurantKind?: string; reservationDate?: string; menus: Array<{ menu: string; cost: number }> }> = [];
    
    restaurants.forEach((restaurant) => {
      if (restaurant.reservation && !restaurant.reservation.isReceipt && restaurant.reservation.menus && restaurant.reservation.menus.length > 0) {
        restaurantMenuList.push({
          restaurantName: restaurant.name,
          restaurantKind: restaurant.kind,
          reservationDate: restaurant.reservationDate,
          menus: restaurant.reservation.menus.map((menu) => ({
            menu: menu.menu,
            cost: menu.cost,
          })),
        });
      }
    });

    if (restaurantMenuList.length === 0) {
      toast.error('공유할 수령하지 않은 예약이 없습니다.');
      return;
    }

    // 아이콘 SVG를 미리 생성하여 캐시에 저장
    const iconSVGCache: Record<string, string> = {};
    const iconPromises = restaurantMenuList
      .map((restaurant) => restaurant.restaurantKind)
      .filter((kind): kind is string => !!kind && !!restaurantIcons[kind])
      .map(async (kind) => {
        const iconName = restaurantIcons[kind];
        if (!iconSVGCache[iconName]) {
          iconSVGCache[iconName] = await getLucideIconSVG(iconName);
        }
      });
    
    await Promise.all(iconPromises);

    const tableHTML = generateReservationListShareHTML(restaurantMenuList, restaurantIcons, iconSVGCache);

    try {
      // 임시 div 생성
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = tableHTML;
      tempDiv.style.position = 'absolute';
      tempDiv.style.left = '-9999px';
      tempDiv.style.top = '0';
      document.body.appendChild(tempDiv);

      // html2canvas로 이미지 변환
      const canvas = await html2canvas(tempDiv.firstElementChild as HTMLElement, {
        backgroundColor: '#ffffff',
        scale: 2,
        logging: false,
        useCORS: true,
      } as Parameters<typeof html2canvas>[1]);

      // 임시 div 제거
      document.body.removeChild(tempDiv);

      // Canvas를 Blob으로 변환
      canvas.toBlob(async (blob) => {
        if (!blob) {
          toast.error('이미지 생성 중 오류가 발생했습니다.');
          return;
        }

        const file = new File([blob], '포장예약목록.png', {
          type: 'image/png',
        });

        try {
          if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
            await navigator.share({
              title: '포장 예약 목록',
              files: [file],
            });
          } else {
            // 다운로드
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = '포장예약목록.png';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            toast.success('이미지가 다운로드되었습니다.');
          }
        } catch (error) {
          if ((error as Error).name !== 'AbortError') {
            console.error('Error sharing', error);
            // 다운로드로 폴백
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = '포장예약목록.png';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            toast.success('이미지가 다운로드되었습니다.');
          }
        }
      }, 'image/png');
    } catch (error) {
      console.error('Error creating image', error);
      toast.error('이미지 생성 중 오류가 발생했습니다.');
    }
  };

  const handleThemeSelect = (theme: ThemeMode) => {
    setSelectedTheme(theme);
    setCurrentTheme(theme);
    
    // localStorage에 테마 저장
    try {
      localStorage.setItem('theme', theme);
      setThemeDialogOpen(false);
    } catch (error) {
      console.error('Error saving theme to localStorage:', error);
      toast.error('테마 저장 중 오류가 발생했습니다.');
    }
  };

  const appendMenuPreset = useCallback((menuName: string, cost: number) => {
    const name = menuName.trim();
    if (!name) return;
    const price = cost > 0 ? cost : 0;
    setMenuRows((prev) => {
      if (!prev.length) {
        return [{ id: `menu-${Date.now()}`, menu: name, cost: price }];
      }
      if (prev[0].menu.trim() === '') {
        const [first, ...rest] = prev;
        return [{ ...first, menu: name, cost: price }, ...rest];
      }
      return [...prev, { id: `menu-${Date.now()}`, menu: name, cost: price }];
    });
  }, []);

  const handleMenuHistoryOpen = useCallback(async () => {
    if (!user || !selectedRestaurant) return;

    try {
      const reservationRef = ref(database, `food-resv/reservation/${user.uid}/${selectedRestaurant.id}`);
      const snapshot = await get(reservationRef);
      const unique = new Map<string, MenuHistoryItem>();

      if (snapshot.exists()) {
        const reservations = snapshot.val() as Record<string, ReservationData>;
        Object.values(reservations).forEach((reservation) => {
          reservation?.menus?.forEach((menu) => {
            if (!menu.menu) return;
            const key = `${menu.menu}|${menu.cost}`;
            if (!unique.has(key)) {
              unique.set(key, { menu: menu.menu, cost: menu.cost });
            }
          });
        });
      }

      const list = Array.from(unique.values()).sort((a, b) =>
        a.menu.localeCompare(b.menu)
      );
      setMenuHistoryList(list);
      setMenuHistoryOpen(true);
    } catch (error) {
      console.error('Error fetching menu history', error);
      toast.error('메뉴 이력을 불러오는 중 오류가 발생했습니다.');
    }
  }, [user, selectedRestaurant]);

  const handleMenuHistorySelect = useCallback(
    (item: MenuHistoryItem) => {
      appendMenuPreset(item.menu, item.cost);
      setMenuHistoryOpen(false);
    },
    [appendMenuPreset]
  );

  const handleRegisteredMenuButtonClick = useCallback(() => {
    setRegisteredMenuListOpen(true);
  }, []);

  const handleRegisteredMenuSelect = useCallback(
    (menu: RestaurantMenu) => {
      appendMenuPreset(menu.name, menu.cost);
      setRegisteredMenuListOpen(false);
    },
    [appendMenuPreset]
  );

  const handleOpenRestaurantEditor = () => {
    if (!selectedRestaurant) return;
    const latest =
      restaurants.find((item) => item.id === selectedRestaurant.id) ?? selectedRestaurant;
    setEditableRestaurant({
      id: latest.id,
      name: latest.name,
      telNo: latest.telNo ?? '',
      kind: latest.kind ?? '',
      menuImgId: latest.menuImgId ?? '',
      menuUrl: latest.menuUrl ?? '',
      naviUrl: latest.naviUrl ?? '',
      prepay: latest.prepay ?? false,
    });
    setEditDialogOpen(true);
  };

  const handleMenuImageOpen = () => {
    if (!selectedRestaurant) return;
    if (selectedRestaurant.menuImgId) {
      const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || 'da5h7wjxc';
      const url = `https://res.cloudinary.com/${cloudName}/image/upload/${selectedRestaurant.menuImgId}`;
      window.open(url, '_blank', 'noopener');
    } else if (selectedRestaurant.menuUrl) {
      window.open(selectedRestaurant.menuUrl, '_blank', 'noopener');
    }
  };

  const handleRestaurantUpdate = async () => {
    if (!user || !editableRestaurant) return;
    const { id, name, telNo, kind, menuImgId, menuUrl, naviUrl, prepay } = editableRestaurant;
    if (!name.trim()) {
      toast.error('식당명을 입력해주세요.');
      return;
    }
    try {
      setSavingRestaurant(true);
      await update(ref(database, `food-resv/restaurant/${id}`), {
        name: name.trim(),
        telNo: telNo || '',
        kind: kind || '',
        menuImgId: menuImgId || '',
        menuUrl: menuUrl || '',
        naviUrl: naviUrl || '',
        prepay: prepay ?? false,
      });
      toast.success('식당 정보를 저장했습니다.');
      setEditDialogOpen(false);
    } catch (error) {
      console.error('Error saving restaurant', error);
      toast.error('식당 저장 중 오류가 발생했습니다.');
    } finally {
      setSavingRestaurant(false);
    }
  };

  const handleRestaurantCreate = async () => {
    if (!user) return;

    const id = newRestaurant.id.trim().toUpperCase();
    const name = newRestaurant.name.trim();

    if (!id || !name) {
      toast.error('식당 ID와 식당명을 입력해주세요.');
      return;
    }

    if (!/^[A-Z0-9]+$/.test(id)) {
      toast.error('식당 ID는 영문 대문자와 숫자만 가능합니다.');
      return;
    }

    try {
      setCreatingRestaurant(true);
      const restaurantRef = ref(database, `food-resv/restaurant/${id}`);
      const exists = await get(restaurantRef);
      if (exists.exists()) {
        toast.error('이미 존재하는 식당 ID입니다.');
        setCreatingRestaurant(false);
        return;
      }

      await set(restaurantRef, {
        name,
        telNo: newRestaurant.telNo || '',
        kind: newRestaurant.kind || '',
        menuImgId: newRestaurant.menuImgId || '',
        menuUrl: newRestaurant.menuUrl || '',
        naviUrl: newRestaurant.naviUrl || '',
        prepay: newRestaurant.prepay ?? false,
      });

      toast.success('식당을 등록했습니다.');
      setCreateDialogOpen(false);
      setNewRestaurant({
        id: '',
        name: '',
        telNo: '',
        kind: '',
        menuImgId: '',
        menuUrl: '',
        naviUrl: '',
        prepay: false,
      });
    } catch (error) {
      console.error('Error creating restaurant', error);
      toast.error('식당 등록 중 오류가 발생했습니다.');
    } finally {
      setCreatingRestaurant(false);
    }
  };

  const handleShareThemeDialog = () => {
    setSelectedTheme(currentTheme);
    setThemeDialogOpen(true);
  };

  const handleKindSave = async (kind: string, data: { icon?: string; name?: string }) => {
    try {
      const kindRef = ref(database, `food-resv/restaurant-kind/${kind}`);
      await set(kindRef, data);
    } catch (error) {
      console.error('Error saving restaurant kind:', error);
      throw error;
    }
  };

  const handleKindDelete = async (kind: string) => {
    try {
      const kindRef = ref(database, `food-resv/restaurant-kind/${kind}`);
      await remove(kindRef);
    } catch (error) {
      console.error('Error deleting restaurant kind:', error);
      throw error;
    }
  };

  const handleMenuSave = useCallback(async (menuKey: string, menu: RestaurantMenu) => {
    if (!user || !editableRestaurant) return;

    try {
      const menuRef = ref(database, `food-resv/restaurant/${editableRestaurant.id}/menu/${menuKey}`);
      await set(menuRef, menu);
      toast.success('메뉴를 저장했습니다.');
    } catch (error) {
      console.error('Error saving menu:', error);
      toast.error('메뉴 저장 중 오류가 발생했습니다.');
      throw error;
    }
  }, [user, editableRestaurant]);

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-background text-foreground">
        <header
          className={cn(
            'sticky top-0 z-30 border-b border-border/40 backdrop-blur',
            currentTheme === 'white' ? 'bg-[rgb(245,245,245)]' : 'bg-neutral-900/95'
          )}
        >
          <div className="mx-auto flex w-full max-w-xl items-center justify-between px-4 py-3">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                className="shrink-0"
                onClick={() => router.replace('/rest-menu')}
              >
                <UtensilsCrossed className="h-5 w-5" />
              </Button>
              <div className="flex items-center gap-2">
                <span className="text-base font-semibold leading-tight">포장 예약</span>
                {outstandingAmount > 0 && (
                  <span className="text-sm text-muted-foreground">
                    {formatCurrency(outstandingAmount)}원
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={handleReservationListShare}
                title="포장 예약 목록 공유"
              >
                <Share2 className="h-5 w-5" />
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <MoreVertical className="h-5 w-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44">
                  <DropdownMenuItem
                    onSelect={() => router.replace('/rest-menu')}
                    className="flex items-center gap-2"
                  >
                    <BookOpen className="h-4 w-4" />
                    식당 메뉴
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={() => {
                      setNewRestaurant({
                        id: '',
                        name: '',
                        telNo: '',
                        kind: '',
                        menuImgId: '',
                        menuUrl: '',
                        naviUrl: '',
                      });
                      setCreateDialogOpen(true);
                    }}
                    className="flex items-center gap-2"
                  >
                    <PlusCircle className="h-4 w-4" />
                    식당 등록
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={handleShareThemeDialog}
                    className="flex items-center gap-2"
                  >
                    <Palette className="h-4 w-4" />
                    테마
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={() => setKindManageDialogOpen(true)}
                    className="flex items-center gap-2"
                  >
                    <Tag className="h-4 w-4" />
                    식당 종류
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-xl px-3 pb-28">
          <RestaurantList
            restaurants={restaurants}
            hiddenIds={hiddenRestaurantIds}
            showHidden={showHidden}
            onShowHidden={() => setShowHidden(true)}
            onSelect={handleRestaurantClick}
            loading={loading}
            error={error}
            currentTheme={currentTheme}
            restaurantIcons={restaurantIcons}
            allReservations={allReservations}
          />
        </main>

        <RestaurantDetailDialog
          open={detailOpen}
          restaurant={selectedRestaurant}
          menuRows={menuRows}
          onMenuChange={handleMenuChange}
          onAddMenuRow={handleAddMenuRow}
          onRemoveMenuRow={handleRemoveMenuRow}
          reservationDate={reservationDate}
          onReservationDateChange={handleReservationDateChange}
          prepaymentRows={prepaymentRows}
          savedPrepayments={savedPrepayments}
          onPrepaymentAmountChange={handlePrepaymentAmountChange}
          onPrepaymentDateChange={handlePrepaymentDateChange}
          onAddPrepaymentRow={handleAddPrepaymentRow}
          onRemovePrepaymentRow={handleRemovePrepaymentRow}
          onShare={handleShare}
          onPreview={handlePreview}
          onReceipt={handleReceipt}
          onSaveMenus={handleSaveMenus}
          onDeleteMenus={handleDeleteMenus}
          onSavePrepayments={handleSavePrepayments}
          onDeletePrepayments={handleDeletePrepayments}
          onClose={handleCloseDetail}
          onOpenMenuHistory={handleMenuHistoryOpen}
          onOpenRestaurantEditor={handleOpenRestaurantEditor}
          onOpenMenuResource={handleMenuImageOpen}
          onOpenRegisteredMenuList={handleRegisteredMenuButtonClick}
          hasRegisteredMenus={hasRegisteredMenus}
          currentTab={currentTab}
          onTabChange={setCurrentTab}
          savingMenus={savingMenus}
          savingPrepayments={savingPrepayments}
          isReceipt={selectedRestaurant?.reservation?.isReceipt === true}
          summary={{
            total: sumMenuAmount(menuRows),
            prepayment: sumPrepaymentAmount(prepaymentRows),
            remaining: Math.max(
              sumMenuAmount(menuRows) - sumPrepaymentAmount(prepaymentRows),
              0
            ),
          }}
        />

          <MenuHistoryDialog
            open={menuHistoryOpen}
            menus={menuHistoryList}
            onClose={() => setMenuHistoryOpen(false)}
            onSelect={handleMenuHistorySelect}
          />
          <RestaurantMenuPickerDialog
            open={registeredMenuListOpen}
            restaurantName={selectedRestaurant?.name}
            menus={restaurantMenus}
            onClose={() => setRegisteredMenuListOpen(false)}
            onSelect={handleRegisteredMenuSelect}
          />

          {editableRestaurant && (
            <RestaurantFormDialog
              open={editDialogOpen}
              mode="edit"
              restaurant={editableRestaurant}
              onChange={(updates) =>
                setEditableRestaurant((prev) => (prev ? { ...prev, ...updates } : prev))
              }
              onClose={() => setEditDialogOpen(false)}
              onSave={handleRestaurantUpdate}
              saving={savingRestaurant}
              onToggleHide={() => handleToggleHide(editableRestaurant.id)}
              isHidden={hiddenRestaurantIds.includes(editableRestaurant.id)}
              onOpenUpload={() => handleOpenUploadDialog('edit')}
              restaurantKinds={restaurantKinds}
              restaurantIcons={restaurantIcons}
              onMenuSave={handleMenuSave}
              cloudName={cloudName}
              mobilePreset={uploadPreset}
              thumbnailPreset={thumbnailPreset}
            />
          )}

          <RestaurantFormDialog
            open={createDialogOpen}
            mode="create"
            restaurant={newRestaurant}
            onChange={(updates) => setNewRestaurant((prev) => ({ ...prev, ...updates }))}
            onClose={() => setCreateDialogOpen(false)}
            onSave={handleRestaurantCreate}
            saving={creatingRestaurant}
            onOpenUpload={() => handleOpenUploadDialog('create')}
            restaurantKinds={restaurantKinds}
            restaurantIcons={restaurantIcons}
          />

          <ImageUploadDialog
            open={uploadDialogOpen}
            onClose={handleUploadDialogClose}
            onUploaded={handleUploadSuccess}
            cloudName={cloudName}
            uploadPreset={uploadPreset}
            initialPublicId={
              uploadContext === 'edit'
                ? editableRestaurant?.menuImgId || null
                : uploadContext === 'create'
                  ? newRestaurant.menuImgId || null
                  : null
            }
          />

        <ThemeDialog
          open={themeDialogOpen}
          selectedTheme={selectedTheme}
          onClose={() => setThemeDialogOpen(false)}
          onSelect={handleThemeSelect}
          saving={false}
        />

        <DeleteConfirmDialog
          open={deleteState.open}
          target={deleteState.target}
          onCancel={() => setDeleteState({ open: false, target: null })}
          onConfirm={handleConfirmDelete}
        />

        <RestaurantKindManageDialog
          open={kindManageDialogOpen}
          restaurantKinds={restaurantKinds}
          restaurantIcons={restaurantIcons}
          onClose={() => setKindManageDialogOpen(false)}
          onSave={handleKindSave}
          onDelete={handleKindDelete}
        />

        {/* 미리보기 다이얼로그 */}
        <Dialog open={previewDialogOpen} onOpenChange={setPreviewDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>공유 양식 미리보기</DialogTitle>
            </DialogHeader>
            <div className="p-4">
              <div 
                className="share-form-container"
                dangerouslySetInnerHTML={{ __html: getShareHTML(iconSVGCache) }} 
              />
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </ProtectedRoute>
  );
}
