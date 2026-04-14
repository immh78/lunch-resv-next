'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { ref, set, get, remove, update, push } from 'firebase/database';
import dayjs from 'dayjs';
import { toast } from 'sonner';

import { database } from '@/lib/firebase';
import {
  collectUserZeropayQueueEntries,
  FOOD_RESV_NOTICE_HISTORY_PATH,
  FOOD_RESV_NOTICE_QUEUE_PATH,
  resolveZeropayDateYmd,
  type ZeropayQueueEntryWithKey,
} from '@/lib/zeropay-queue';
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
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
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { getLucideIcon } from '@/lib/icon-utils';
import { MenuEditDialog, RestaurantFormDialog, RestaurantKindManageDialog } from './components';

import {
  UtensilsCrossed,
  MoreVertical,
  Phone,
  Navigation,
  X,
  PlusCircle,
  Palette,
  Pencil,
  Trash2,
  Plus,
  Search,
  BookOpen,
  Tag,
  RefreshCw,
  Import,
  Save,
} from 'lucide-react';

type ThemeMode = 'white' | 'black';

interface Restaurant {
  id: string;
  name: string;
  telNo: string;
  kind?: string;
  menuImgId?: string;
  menuUrl?: string;
  naviUrl?: string;
  prepay?: boolean;
  recentMenu?: {
    date: string; // yyyyMMdd 형식
    menuName: string;
  };
}

interface RestaurantMenu {
  name: string;
  img: string;        // Cloudinary 이미지 ID (mobile용)
  thumbnail: string;  // Cloudinary 이미지 ID (thumbnail용)
  cost: number;
  remark: string;
}

const formatCurrency = (value: number) => value.toLocaleString('ko-KR');

/** visit-log 항목 (기존 데이터는 cost 없을 수 있음) */
export type VisitLogEntry = { date: string; menuName: string; cost?: number };

export interface RestMenuPageInitialData {
  restaurants: Restaurant[];
  visitLogs: Record<string, VisitLogEntry[]>;
  allVisitLogs: Record<string, (VisitLogEntry & { key: string })[]>;
  restaurantKinds: Record<string, { icon?: string; name?: string }>;
  restaurantIcons: Record<string, string>;
}

// 식당명 정렬 함수: 한글이 영문보다 우선순위가 높음
const sortRestaurantsByName = (a: Restaurant, b: Restaurant): number => {
  const nameA = a.name.trim();
  const nameB = b.name.trim();
  
  if (!nameA && !nameB) return 0;
  if (!nameA) return 1;
  if (!nameB) return -1;
  
  // 첫 글자가 한글인지 확인 (가-힣, ㄱ-ㅎ, ㅏ-ㅣ)
  const isHangulA = /^[가-힣ㄱ-ㅎㅏ-ㅣ]/.test(nameA);
  const isHangulB = /^[가-힣ㄱ-ㅎㅏ-ㅣ]/.test(nameB);
  
  // 한글이 영문보다 우선순위가 높음
  if (isHangulA && !isHangulB) return -1;
  if (!isHangulA && isHangulB) return 1;
  
  // 같은 타입이면 일반 오름차순 정렬
  return nameA.localeCompare(nameB, 'ko');
};

// 식당 리스트 정렬 함수: 1) 최근 메뉴 방문일시 역순, 2) 식당명
const sortRestaurantsByRecentMenu = (a: Restaurant, b: Restaurant, visitLogs: Record<string, VisitLogEntry[]>): number => {
  const recentA = visitLogs[a.id]?.[0]?.date || '';
  const recentB = visitLogs[b.id]?.[0]?.date || '';
  
  // 최근 메뉴 방문일시 역순 정렬
  if (recentA && recentB) {
    const dateCompare = recentB.localeCompare(recentA);
    if (dateCompare !== 0) return dateCompare;
  } else if (recentA && !recentB) {
    return -1;
  } else if (!recentA && recentB) {
    return 1;
  }
  
  // 날짜가 같거나 둘 다 없으면 식당명으로 정렬
  return sortRestaurantsByName(a, b);
};

/** 결제 알림 큐에 식당명이 있는 행을 목록 최상단으로 */
const sortRestaurantsWithQueueFirst = (
  a: Restaurant,
  b: Restaurant,
  visitLogs: Record<string, VisitLogEntry[]>,
  queueRestaurantNames: Set<string>
): number => {
  const aIn = queueRestaurantNames.has(a.name.trim());
  const bIn = queueRestaurantNames.has(b.name.trim());
  if (aIn !== bIn) return aIn ? -1 : 1;
  return sortRestaurantsByRecentMenu(a, b, visitLogs);
};

/** 큐에서 식당명이 일치하는 항목 중 datetime 기준 최신 1건 */
function getFirstQueueEntryForRestaurant(
  restaurantName: string,
  entries: ZeropayQueueEntryWithKey[]
): ZeropayQueueEntryWithKey | undefined {
  const n = restaurantName.trim();
  const candidates = entries
    .filter((e) => e.parsed.restaurantName === n)
    .sort((a, b) => (b.record.datetime || '').localeCompare(a.record.datetime || ''));
  return candidates[0];
}

const getCloudinaryImageUrl = (publicId: string, isThumbnail = false): string => {
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || 'da5h7wjxc';
  if (!publicId) return '';
  
  // 확장자 제거
  const cleanPublicId = publicId.replace(/\.(jpg|jpeg|png|webp|gif)$/i, '');
  
  if (isThumbnail) {
    return `https://res.cloudinary.com/${cloudName}/image/upload/f_auto,q_auto,w_300/${cleanPublicId}.jpg`;
  }
  return `https://res.cloudinary.com/${cloudName}/image/upload/f_auto,q_auto/${cleanPublicId}.jpg`;
};

type RestaurantListProps = {
  restaurants: Restaurant[];
  onSelect: (restaurant: Restaurant) => void;
  onRecentMenuClick?: (restaurant: Restaurant) => void;
  loading: boolean;
  error: string;
  currentTheme: ThemeMode;
  restaurantIcons: Record<string, string>;
  allVisitLogs: Record<string, (VisitLogEntry & { key: string })[]>;
  zeropayPendingRestaurantNames: Set<string>;
};

// 최근 30일 방문 횟수 계산 함수
const getVisitCountLast30Days = (
  restaurantId: string,
  allVisitLogs: Record<string, (VisitLogEntry & { key: string })[]>
): number => {
  const logs = allVisitLogs[restaurantId] || [];
  const today = dayjs();
  const thirtyDaysAgo = today.subtract(30, 'day');
  
  return logs.filter(log => {
    if (!log.date || log.date.length !== 8) return false;
    const year = log.date.substring(0, 4);
    const month = log.date.substring(4, 6);
    const day = log.date.substring(6, 8);
    const visitDate = dayjs(`${year}-${month}-${day}`);
    return visitDate.isAfter(thirtyDaysAgo) || visitDate.isSame(thirtyDaysAgo, 'day');
  }).length;
};

function RestaurantList({
  restaurants,
  onSelect,
  onRecentMenuClick,
  loading,
  error,
  currentTheme,
  restaurantIcons,
  allVisitLogs,
  zeropayPendingRestaurantNames,
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

  return (
    <Table>
      <TableHeader>
        <TableRow className="border-border/40 select-none">
          <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            식당
          </TableHead>
          <TableHead className="w-[180px] max-w-[180px] text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            최근 메뉴
          </TableHead>
          <TableHead className="text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            전화/네비
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {restaurants.map((restaurant) => (
          <TableRow
            key={restaurant.id}
            className="border-border/30"
          >
            <TableCell className="align-middle">
              <Button
                variant="outline"
                size="sm"
                className={cn(
                  'w-[140px] max-w-[140px] justify-start transition-colors overflow-hidden relative',
                  currentTheme === 'white'
                    ? 'bg-[rgb(250,250,250)] hover:bg-[rgb(240,240,240)]'
                    : 'bg-neutral-900 text-neutral-100 border-neutral-700 hover:bg-neutral-800'
                )}
                onClick={(event) => {
                  event.stopPropagation();
                  onSelect(restaurant);
                }}
              >
                {restaurant.kind && restaurantIcons[restaurant.kind] && (() => {
                  const IconComponent = getLucideIcon(restaurantIcons[restaurant.kind]);
                  return IconComponent ? (
                    <IconComponent
                      className={cn(
                        'mr-2 h-4 w-4 shrink-0',
                        zeropayPendingRestaurantNames.has(restaurant.name.trim()) && 'text-orange-500'
                      )}
                    />
                  ) : null;
                })()}
                <span className="truncate">{restaurant.name}</span>
                {(() => {
                  const visitCount = getVisitCountLast30Days(restaurant.id, allVisitLogs);
                  if (visitCount > 0) {
                    return (
                      <div className="absolute top-0 right-0.5 flex flex-wrap gap-0.5 max-w-[20px] justify-end pointer-events-none z-10">
                        {Array.from({ length: visitCount }).map((_, index) => (
                          <span key={index} className="text-red-500 text-[10px] leading-none block">•</span>
                        ))}
                      </div>
                    );
                  }
                  return null;
                })()}
              </Button>
            </TableCell>
            <TableCell className="w-[180px] max-w-[180px] align-middle">
              {restaurant.recentMenu && (() => {
                // yyyyMMdd 형식을 mm/dd(요일) 형식으로 변환
                const dateStr = restaurant.recentMenu.date;
                let displayDate = '';
                if (dateStr && dateStr.length === 8) {
                  const year = dateStr.substring(0, 4);
                  const month = dateStr.substring(4, 6);
                  const day = dateStr.substring(6, 8);
                  const date = dayjs(`${year}-${month}-${day}`);
                  const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
                  const weekday = weekdays[date.day()];
                  displayDate = `${month}/${day}(${weekday})`;
                } else {
                  displayDate = dateStr;
                }
                return (
                  <span 
                    className="text-xs text-muted-foreground break-words cursor-pointer hover:text-foreground transition-colors block"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (onRecentMenuClick) {
                        onRecentMenuClick(restaurant);
                      }
                    }}
                    title={`${displayDate} ${restaurant.recentMenu.menuName}`}
                  >
                    {displayDate} {restaurant.recentMenu.menuName}
                  </span>
                );
              })()}
            </TableCell>
            <TableCell className="align-middle">
              <div className="flex items-center justify-end gap-2">
                <a
                  href={restaurant.telNo?.trim() ? `tel:${restaurant.telNo}` : undefined}
                  onClick={(event) => {
                    event.stopPropagation();
                    if (!restaurant.telNo?.trim()) {
                      event.preventDefault();
                    }
                  }}
                  aria-disabled={!restaurant.telNo?.trim()}
                  className={cn(
                    'rounded-full p-1 transition',
                    restaurant.telNo?.trim()
                      ? currentTheme === 'white'
                        ? 'text-black hover:text-black/80'
                        : 'text-muted-foreground hover:text-foreground'
                      : currentTheme === 'white'
                        ? 'text-gray-400 pointer-events-none'
                        : 'text-gray-600 pointer-events-none'
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
        ))}

        {!restaurants.length && (
          <TableRow>
            <TableCell
              colSpan={3}
              className="py-10 text-center text-sm text-muted-foreground"
            >
              등록된 식당이 없습니다.
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
}

type RestaurantMenuDialogProps = {
  open: boolean;
  restaurant: Restaurant | null;
  menus: Record<string, RestaurantMenu>;
  onClose: () => void;
  onImageClick: (imageUrl: string) => void;
  onEditRestaurant?: () => void;
  onOpenMenuResource?: () => void;
  onDeleteMenu?: (menuKey: string) => void;
  onAddMenu?: () => void;
  onMenuClick?: (menuKey: string) => void;
  onEditMenu?: (menuKey: string) => void;
  /** `false`를 반환하면 메뉴 다이얼로그를 닫지 않음(예: 금액 불일치 확인 대기) */
  onMenuSelect?: (menuKey: string, menu: RestaurantMenu) => boolean | Promise<boolean>;
  hasZeropayQueueForRestaurant: boolean;
  zeropayImportPreview: { dateYmd: string; amount: number }[];
  /** 메뉴명 확인 시 메뉴 등록 + 해당 큐 1건 history 이동 */
  onRegisterMenuFromQueue: (menuName: string) => Promise<boolean>;
  importingMenuZeropay: boolean;
};

function RestaurantMenuDialog({
  open,
  restaurant,
  menus,
  onClose,
  onImageClick,
  onEditRestaurant,
  onOpenMenuResource,
  onDeleteMenu,
  onAddMenu,
  onMenuClick,
  onEditMenu,
  onMenuSelect,
  hasZeropayQueueForRestaurant,
  zeropayImportPreview,
  onRegisterMenuFromQueue,
  importingMenuZeropay,
}: RestaurantMenuDialogProps) {
  const menuEntries = Object.entries(menus);
  const [deleteMenuKey, setDeleteMenuKey] = useState<string | null>(null);
  const [menuImportFromQueueOpen, setMenuImportFromQueueOpen] = useState(false);
  const [importMenuNameInput, setImportMenuNameInput] = useState('');
  const importMenuNameInputRef = useRef<HTMLInputElement>(null);

  const zeropayAmountsLabel = useMemo(
    () =>
      zeropayImportPreview.map((row) => `${formatCurrency(row.amount)}원`).join(' · '),
    [zeropayImportPreview]
  );

  const firstImportHint = zeropayImportPreview[0];

  useEffect(() => {
    if (!open) {
      setMenuImportFromQueueOpen(false);
      setImportMenuNameInput('');
    }
  }, [open]);

  useEffect(() => {
    if (!menuImportFromQueueOpen) return;
    const id = window.requestAnimationFrame(() => {
      importMenuNameInputRef.current?.focus();
    });
    return () => cancelAnimationFrame(id);
  }, [menuImportFromQueueOpen]);

  return (
    <>
      <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
        <DialogContent 
          className="flex h-[90dvh] max-h-[90dvh] max-w-[calc(100vw-env(safe-area-inset-left,0px)-env(safe-area-inset-right,0px)-1rem)] sm:max-w-md flex-col p-0 overflow-hidden !items-start !mt-0 [&>div]:h-full [&>div]:max-h-[90dvh] [&>div]:flex [&>div]:flex-col [&>div]:overflow-hidden"
          style={{
            paddingTop: `env(safe-area-inset-top, 0px)`,
            paddingBottom: `env(safe-area-inset-bottom, 0px)`,
            paddingLeft: `env(safe-area-inset-left, 0px)`,
            paddingRight: `env(safe-area-inset-right, 0px)`,
          }}
        >
          <DialogHeader className="border-b border-border/50 px-5 py-4 shrink-0 flex-shrink-0">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <DialogTitle className="min-w-0 shrink">{restaurant?.name || '식당 메뉴'}</DialogTitle>
              {onEditRestaurant && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0 text-muted-foreground"
                  onClick={onEditRestaurant}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
              )}
              {hasZeropayQueueForRestaurant && (
                <div className="flex min-w-0 max-w-[min(100%,220px)] items-center gap-0.5 sm:max-w-[280px]">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0 text-muted-foreground"
                    disabled={importingMenuZeropay}
                    title="알림에서 메뉴 가져오기"
                    onClick={() => {
                      setImportMenuNameInput('');
                      setMenuImportFromQueueOpen(true);
                    }}
                  >
                    <Import className="h-4 w-4" />
                  </Button>
                  {zeropayAmountsLabel ? (
                    <span className="min-w-0 truncate text-[11px] leading-tight text-muted-foreground">
                      {zeropayAmountsLabel}
                    </span>
                  ) : null}
                </div>
              )}
              {(restaurant?.menuImgId || restaurant?.menuUrl) && onOpenMenuResource && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0 text-muted-foreground"
                  onClick={onOpenMenuResource}
                >
                  <BookOpen className="h-4 w-4" />
                </Button>
              )}
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto overflow-x-hidden px-5 py-4 min-h-0 relative">
            <div className="space-y-2 pb-16">
              {menuEntries.length === 0 ? (
                <div className="py-10 text-center text-sm text-muted-foreground">
                  등록된 메뉴가 없습니다.
                </div>
              ) : (
                menuEntries.map(([key, menu]) => {
                  const thumbnailUrl = menu.thumbnail ? getCloudinaryImageUrl(menu.thumbnail, true) : '';
                  const imageUrl = menu.img ? getCloudinaryImageUrl(menu.img, false) : '';

                  return (
                    <div key={key} className="flex items-center gap-3 border-b border-border/30 pb-3 last:border-0">
                      {thumbnailUrl ? (
                        <div
                          className="shrink-0 cursor-pointer"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (imageUrl) {
                              onImageClick(imageUrl);
                            }
                          }}
                        >
                          <Image
                            src={thumbnailUrl}
                            alt={menu.name}
                            width={60}
                            height={60}
                            className="h-[60px] w-[60px] rounded object-cover"
                            unoptimized
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = 'none';
                            }}
                          />
                        </div>
                      ) : (
                        <div className="h-[60px] w-[60px] rounded bg-muted shrink-0" />
                      )}
                      <div 
                        className="flex-1 min-w-0 cursor-pointer"
                        onClick={async () => {
                          if (onMenuSelect) {
                            const shouldClose = await Promise.resolve(onMenuSelect(key, menu));
                            if (shouldClose !== false) onClose();
                          } else if (onMenuClick) {
                            onMenuClick(key);
                          }
                        }}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="text-sm font-medium truncate flex-1 min-w-0">
                            {menu.name}
                          </div>
                          {menu.cost > 0 && (
                            <div className="text-sm text-muted-foreground whitespace-nowrap shrink-0">
                              {formatCurrency(menu.cost)}원
                            </div>
                          )}
                          <div className="flex items-center gap-1 shrink-0">
                            {onEditMenu && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 shrink-0"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onEditMenu(key);
                                }}
                              >
                                <Pencil className="h-3 w-3" />
                              </Button>
                            )}
                            {onDeleteMenu && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 shrink-0"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDeleteMenuKey(key);
                                }}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            )}
                          </div>
                        </div>
                        {menu.remark && (
                          <div className="text-sm text-muted-foreground mt-1">
                            {menu.remark}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {onAddMenu && (
            <div className="absolute bottom-6 right-6">
              <Button
                size="icon"
                className="h-[42px] w-[42px] rounded-full shadow-lg"
                onClick={onAddMenu}
              >
                <Plus className="h-6 w-6" />
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={menuImportFromQueueOpen}
        onOpenChange={(next) => {
          setMenuImportFromQueueOpen(next);
          if (!next) setImportMenuNameInput('');
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader className="border-0 px-5 pb-2 pt-4">
            <DialogTitle>메뉴 등록</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            {firstImportHint && (
              <div className="mx-3 rounded-sm border border-border bg-muted/50 px-5 py-2.5 text-sm">
                <div className="text-muted-foreground">
                  금액{' '}
                  <span className="font-medium text-foreground">
                    {formatCurrency(firstImportHint.amount)}원
                  </span>
                </div>
              </div>
            )}
            <div className="px-3">
              <Input
                ref={importMenuNameInputRef}
                value={importMenuNameInput}
                onChange={(e) => setImportMenuNameInput(e.target.value)}
                placeholder="메뉴명"
                disabled={importingMenuZeropay}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    void (async () => {
                      const ok = await onRegisterMenuFromQueue(importMenuNameInput);
                      if (ok) {
                        setMenuImportFromQueueOpen(false);
                        setImportMenuNameInput('');
                      }
                    })();
                  }
                }}
              />
            </div>
          </div>
          <DialogFooter className="border-0 flex w-full flex-row justify-end px-5 pb-4 pt-2">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9"
              disabled={importingMenuZeropay}
              title="저장"
              aria-label="저장"
              onClick={async () => {
                const ok = await onRegisterMenuFromQueue(importMenuNameInput);
                if (ok) {
                  setMenuImportFromQueueOpen(false);
                  setImportMenuNameInput('');
                }
              }}
            >
              <Save className="h-4 w-4" />
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteMenuKey !== null} onOpenChange={(open) => !open && setDeleteMenuKey(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>메뉴 삭제</AlertDialogTitle>
            <AlertDialogDescription>
              정말로 이 메뉴를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteMenuKey(null)}>취소</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteMenuKey && onDeleteMenu) {
                  onDeleteMenu(deleteMenuKey);
                  setDeleteMenuKey(null);
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

type ImageViewDialogProps = {
  open: boolean;
  imageUrl: string;
  onClose: () => void;
};

function ImageViewDialog({
  open,
  imageUrl,
  onClose,
}: ImageViewDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-4xl p-0 overflow-hidden">
        <div className="relative">
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-2 top-2 z-10 bg-background/80 hover:bg-background"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
          <Image
            src={imageUrl}
            alt="메뉴 이미지"
            width={800}
            height={600}
            className="w-full h-auto max-h-[90vh] object-contain"
            unoptimized
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}

type RestMenuPageClientProps = { initialData?: RestMenuPageInitialData };

export default function RestMenuPageClient({ initialData }: RestMenuPageClientProps) {
  const { user } = useAuth();
  const router = useRouter();

  const [restaurants, setRestaurants] = useState<Restaurant[]>(initialData?.restaurants ?? []);
  const [loading, setLoading] = useState(!initialData);
  const [error, setError] = useState('');

  const [selectedRestaurant, setSelectedRestaurant] = useState<Restaurant | null>(null);
  const [menus, setMenus] = useState<Record<string, RestaurantMenu>>({});
  const [menuDialogOpen, setMenuDialogOpen] = useState(false);
  const [imageViewOpen, setImageViewOpen] = useState(false);
  const [currentImageUrl, setCurrentImageUrl] = useState('');

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
  const [restaurantIcons, setRestaurantIcons] = useState<Record<string, string>>(initialData?.restaurantIcons ?? {});
  const [restaurantKinds, setRestaurantKinds] = useState<Record<string, { icon?: string; name?: string }>>(initialData?.restaurantKinds ?? {});
  const [kindManageDialogOpen, setKindManageDialogOpen] = useState(false);
  const [zeropayQueueEntries, setZeropayQueueEntries] = useState<ZeropayQueueEntryWithKey[]>([]);
  const [refreshingNoticeQueue, setRefreshingNoticeQueue] = useState(false);
  const [importingMenuZeropay, setImportingMenuZeropay] = useState(false);
  const [menuSelectQueueMismatch, setMenuSelectQueueMismatch] = useState<{
    restaurantId: string;
    menuKey: string;
    menu: RestaurantMenu;
    entry: ZeropayQueueEntryWithKey;
  } | null>(null);
  const [menuSelectQueueActionBusy, setMenuSelectQueueActionBusy] = useState(false);

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
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
  const [creatingRestaurant, setCreatingRestaurant] = useState(false);

  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editableRestaurant, setEditableRestaurant] = useState<Restaurant | null>(null);
  const [savingRestaurant, setSavingRestaurant] = useState(false);

  const [menuEditOpen, setMenuEditOpen] = useState(false);
  const [selectedMenuKey, setSelectedMenuKey] = useState<string | null>(null);
  const [selectedMenu, setSelectedMenu] = useState<RestaurantMenu | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [allRestaurantMenus, setAllRestaurantMenus] = useState<Record<string, Record<string, RestaurantMenu>>>({});
  const [filteredRestaurants, setFilteredRestaurants] = useState<Restaurant[]>([]);
  const [visitLogs, setVisitLogs] = useState<Record<string, VisitLogEntry[]>>(initialData?.visitLogs ?? {});
  const [allVisitLogs, setAllVisitLogs] = useState<Record<string, (VisitLogEntry & { key: string })[]>>(initialData?.allVisitLogs ?? {});
  const [menuHistoryOpen, setMenuHistoryOpen] = useState(false);
  const [selectedRestaurantForHistory, setSelectedRestaurantForHistory] = useState<Restaurant | null>(null);

  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || 'da5h7wjxc';
  const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET_MOBILE || 'menu-mobile';
  const thumbnailPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET_THUMBNAIL || uploadPreset;

  useEffect(() => {
    document.documentElement.classList.toggle('dark', currentTheme === 'black');
  }, [currentTheme]);

  const loadRestaurants = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const restaurantsRef = ref(database, 'food-resv/restaurant');
      const zeropayQueueRef = ref(database, FOOD_RESV_NOTICE_QUEUE_PATH);
      const [snapshot, zeropaySnap] = await Promise.all([
        get(restaurantsRef),
        get(zeropayQueueRef),
      ]);
      const zeropayRaw = zeropaySnap.exists() ? zeropaySnap.val() : {};
      setZeropayQueueEntries(collectUserZeropayQueueEntries(zeropayRaw, user.uid));
      if (snapshot.exists()) {
        const data = snapshot.val() as Record<string, Partial<Restaurant>>;
        const restaurantList: Restaurant[] = Object.entries(data).map(([id, restaurant]) => ({
          id,
          name: restaurant?.name || '',
          telNo: restaurant?.telNo || '',
          kind: restaurant?.kind || '',
          menuImgId: restaurant?.menuImgId || '',
          menuUrl: restaurant?.menuUrl || '',
          naviUrl: restaurant?.naviUrl || '',
          prepay: restaurant?.prepay ?? false,
        }));
        setRestaurants(restaurantList);
      } else {
        setRestaurants([]);
      }
      setError('');
    } catch (error) {
      console.error('Error fetching restaurants:', error);
      setError('식당 목록을 불러오는 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    loadRestaurants();
  }, [user, loadRestaurants]);

  const zeropayPendingRestaurantNames = useMemo(() => {
    const names = new Set<string>();
    for (const r of restaurants) {
      const n = r.name.trim();
      if (zeropayQueueEntries.some((e) => e.parsed.restaurantName === n)) {
        names.add(n);
      }
    }
    return names;
  }, [restaurants, zeropayQueueEntries]);

  const refetchNoticeQueueOnly = useCallback(async () => {
    if (!user) return;
    try {
      const snap = await get(ref(database, FOOD_RESV_NOTICE_QUEUE_PATH));
      const raw = snap.exists() ? snap.val() : {};
      setZeropayQueueEntries(collectUserZeropayQueueEntries(raw, user.uid));
    } catch (e) {
      console.error('Error refetching notice queue', e);
    }
  }, [user]);

  const menuZeropayImportPreview = useMemo(() => {
    if (!selectedRestaurant) return [];
    const n = selectedRestaurant.name.trim();
    return zeropayQueueEntries
      .filter((e) => e.parsed.restaurantName === n)
      .sort((a, b) => (b.record.datetime || '').localeCompare(a.record.datetime || ''))
      .map((c) => ({
        dateYmd: resolveZeropayDateYmd(c.record.datetime),
        amount: c.parsed.amount,
      }));
  }, [selectedRestaurant, zeropayQueueEntries]);

  const hasMenuZeropayQueue = menuZeropayImportPreview.length > 0;

  const loadVisitLogs = useCallback(async () => {
    if (!user) return;
    try {
      const visitLogRef = ref(database, `food-resv/visit-log/${user.uid}`);
      const snapshot = await get(visitLogRef);
      if (snapshot.exists()) {
        const data = snapshot.val() as Record<string, Record<string, VisitLogEntry>>;
        const logs: Record<string, VisitLogEntry[]> = {};
        const allLogs: Record<string, (VisitLogEntry & { key: string })[]> = {};

        Object.entries(data).forEach(([restaurantId, restaurantLogs]) => {
          if (restaurantLogs) {
            const logEntriesWithKey = Object.entries(restaurantLogs).map(([key, log]) => ({
              ...log,
              key,
            }));
            logEntriesWithKey.sort((a, b) => {
              const dateA = a.date || '';
              const dateB = b.date || '';
              return dateB.localeCompare(dateA);
            });
            allLogs[restaurantId] = logEntriesWithKey;
            if (logEntriesWithKey.length > 0) {
              const first = logEntriesWithKey[0];
              logs[restaurantId] = [
                {
                  date: first.date,
                  menuName: first.menuName,
                  ...(typeof first.cost === 'number' ? { cost: first.cost } : {}),
                },
              ];
            }
          }
        });
        setVisitLogs(logs);
        setAllVisitLogs(allLogs);
      } else {
        setVisitLogs({});
        setAllVisitLogs({});
      }
    } catch (error) {
      console.error('Error fetching visit logs:', error);
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    loadVisitLogs();
  }, [user, loadVisitLogs]);

  /** 스펙: 깜빡임 방지 — 알림 큐만 갱신. 아이콘은 포장 예약과 같이 회전, 최소 1.5초 */
  const handleRefreshRestMenu = useCallback(async () => {
    if (!user) return;
    setRefreshingNoticeQueue(true);
    try {
      await Promise.all([
        (async () => {
          try {
            const zeropayQueueRef = ref(database, FOOD_RESV_NOTICE_QUEUE_PATH);
            const zeropaySnap = await get(zeropayQueueRef);
            const zeropayRaw = zeropaySnap.exists() ? zeropaySnap.val() : {};
            setZeropayQueueEntries(collectUserZeropayQueueEntries(zeropayRaw, user.uid));
          } catch (error) {
            console.error('Error fetching notice queue:', error);
            toast.error('알림 큐를 불러오지 못했습니다.');
          }
        })(),
        new Promise<void>((resolve) => setTimeout(resolve, 1500)),
      ]);
    } finally {
      setRefreshingNoticeQueue(false);
    }
  }, [user]);

  const loadRestaurantKinds = useCallback(async () => {
    try {
      const kindsRef = ref(database, 'food-resv/restaurant-kind');
      const snapshot = await get(kindsRef);
      if (snapshot.exists()) {
        const kindsData = (snapshot.val() || {}) as Record<string, { icon?: string; name?: string }>;
        const icons: Record<string, string> = {};
        Object.entries(kindsData).forEach(([kind, data]) => {
          if (data?.icon) {
            icons[kind] = data.icon;
          }
        });
        setRestaurantKinds(kindsData);
        setRestaurantIcons(icons);
      } else {
        setRestaurantKinds({});
        setRestaurantIcons({});
      }
    } catch (error) {
      console.error('Error fetching restaurant kinds:', error);
    }
  }, []);

  useEffect(() => {
    loadRestaurantKinds();
  }, [loadRestaurantKinds]);


  const loadAllRestaurantMenus = useCallback(async () => {
    if (!user || restaurants.length === 0) {
      setAllRestaurantMenus({});
      return;
    }
    try {
      const results = await Promise.all(
        restaurants.map(async (restaurant) => {
          const menuRef = ref(database, `food-resv/restaurant/${restaurant.id}/menu`);
          const snapshot = await get(menuRef);
          return [
            restaurant.id,
            snapshot.exists() ? snapshot.val() || {} : {},
          ] as const;
        })
      );
      const menusData: Record<string, Record<string, RestaurantMenu>> = {};
      results.forEach(([id, menus]) => {
        menusData[id] = menus;
      });
      setAllRestaurantMenus(menusData);
    } catch (error) {
      console.error('Error fetching restaurant menus:', error);
      setAllRestaurantMenus({});
    }
  }, [user, restaurants]);

  useEffect(() => {
    loadAllRestaurantMenus();
  }, [loadAllRestaurantMenus]);

  const loadMenusForDialog = useCallback(async () => {
    if (!menuDialogOpen || !selectedRestaurant) {
      setMenus({});
      return;
    }
    try {
      const menuRef = ref(database, `food-resv/restaurant/${selectedRestaurant.id}/menu`);
      const snapshot = await get(menuRef);
      setMenus(snapshot.exists() ? snapshot.val() || {} : {});
    } catch (error) {
      console.error('Error fetching menus:', error);
      setMenus({});
    }
  }, [menuDialogOpen, selectedRestaurant]);

  useEffect(() => {
    loadMenusForDialog();
  }, [loadMenusForDialog]);

  const handleRegisterMenuFromQueue = useCallback(
    async (menuName: string): Promise<boolean> => {
      if (!user || !selectedRestaurant) return false;
      const trimmed = menuName.trim();
      if (!trimmed) {
        toast.error('메뉴명을 입력해주세요.');
        return false;
      }
      const n = selectedRestaurant.name.trim();
      const candidates = zeropayQueueEntries
        .filter((e) => e.parsed.restaurantName === n)
        .sort((a, b) => (b.record.datetime || '').localeCompare(a.record.datetime || ''));
      const entry = candidates[0];
      if (!entry) {
        toast.error('가져올 알림이 없습니다.');
        return false;
      }
      const restaurantId = selectedRestaurant.id;
      try {
        setImportingMenuZeropay(true);
        const menuCollectionRef = ref(database, `food-resv/restaurant/${restaurantId}/menu`);
        const newMenuRef = push(menuCollectionRef);
        const menuKey = newMenuRef.key;
        if (!menuKey) throw new Error('메뉴 키를 만들 수 없습니다.');
        const menuPayload: RestaurantMenu = {
          name: trimmed,
          cost: entry.parsed.amount,
          img: '',
          thumbnail: '',
          remark: '',
        };
        await update(ref(database), {
          [`food-resv/restaurant/${restaurantId}/menu/${menuKey}`]: menuPayload,
          [`${FOOD_RESV_NOTICE_QUEUE_PATH}/${entry.key}`]: null,
          [`${FOOD_RESV_NOTICE_HISTORY_PATH}/${entry.key}`]: entry.record,
        });
        await loadMenusForDialog();
        await loadAllRestaurantMenus();
        await refetchNoticeQueueOnly();
        toast.success('메뉴를 등록했습니다.');
        return true;
      } catch (error) {
        console.error('Error registering menu from queue', error);
        toast.error('메뉴 등록 중 오류가 발생했습니다.');
        return false;
      } finally {
        setImportingMenuZeropay(false);
      }
    },
    [
      user,
      selectedRestaurant,
      zeropayQueueEntries,
      loadMenusForDialog,
      loadAllRestaurantMenus,
      refetchNoticeQueueOnly,
    ]
  );

  const completeMenuSelectWithQueue = useCallback(
    async (
      restaurantId: string,
      menuKey: string,
      menu: RestaurantMenu,
      entry: ZeropayQueueEntryWithKey,
      options: { applyMessageCost: boolean }
    ) => {
      if (!user) return;
      const messageCost = entry.parsed.amount;
      const logCost = options.applyMessageCost
        ? messageCost
        : typeof menu.cost === 'number'
          ? menu.cost
          : 0;

      const updates: Record<string, unknown> = {
        [`${FOOD_RESV_NOTICE_QUEUE_PATH}/${entry.key}`]: null,
        [`${FOOD_RESV_NOTICE_HISTORY_PATH}/${entry.key}`]: entry.record,
      };
      if (options.applyMessageCost) {
        updates[`food-resv/restaurant/${restaurantId}/menu/${menuKey}`] = {
          ...menu,
          cost: messageCost,
        };
      }

      try {
        await update(ref(database), updates);
        const visitLogRef = ref(database, `food-resv/visit-log/${user.uid}/${restaurantId}`);
        await push(visitLogRef, {
          date: dayjs().format('YYYYMMDD'),
          menuName: menu.name,
          cost: logCost,
        });
        await loadVisitLogs();
        await loadMenusForDialog();
        await loadAllRestaurantMenus();
        await refetchNoticeQueueOnly();
      } catch (error) {
        console.error('Error completing menu select with queue:', error);
        toast.error('처리 중 오류가 발생했습니다.');
        throw error;
      }
    },
    [user, loadVisitLogs, loadMenusForDialog, loadAllRestaurantMenus, refetchNoticeQueueOnly]
  );

  const handleRestaurantClick = useCallback((restaurant: Restaurant) => {
    setSelectedRestaurant(restaurant);
    setMenuDialogOpen(true);
  }, []);

  const handleImageClick = useCallback((imageUrl: string) => {
    setCurrentImageUrl(imageUrl);
    setImageViewOpen(true);
  }, []);

  const handleMenuImageOpen = useCallback(() => {
    if (!selectedRestaurant) return;
    if (selectedRestaurant.menuImgId) {
      const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || 'da5h7wjxc';
      const url = `https://res.cloudinary.com/${cloudName}/image/upload/${selectedRestaurant.menuImgId}`;
      window.open(url, '_blank', 'noopener');
    } else if (selectedRestaurant.menuUrl) {
      window.open(selectedRestaurant.menuUrl, '_blank', 'noopener');
    }
  }, [selectedRestaurant]);

  const handleShareThemeDialog = () => {
    setSelectedTheme(currentTheme);
    setThemeDialogOpen(true);
  };

  const handleKindSave = async (kind: string, data: { icon?: string; name?: string }) => {
    try {
      const kindRef = ref(database, `food-resv/restaurant-kind/${kind}`);
      await set(kindRef, data);
      await loadRestaurantKinds();
    } catch (error) {
      console.error('Error saving restaurant kind:', error);
      throw error;
    }
  };

  const handleKindDelete = async (kind: string) => {
    try {
      const kindRef = ref(database, `food-resv/restaurant-kind/${kind}`);
      await remove(kindRef);
      await loadRestaurantKinds();
    } catch (error) {
      console.error('Error deleting restaurant kind:', error);
      throw error;
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
      await loadRestaurants();
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

  const handleOpenRestaurantEditor = useCallback(() => {
    if (!selectedRestaurant) return;
    const latest = restaurants.find((item) => item.id === selectedRestaurant.id) ?? selectedRestaurant;
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
  }, [selectedRestaurant, restaurants]);

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
      await loadRestaurants();
      toast.success('식당 정보를 저장했습니다.');
      setEditDialogOpen(false);
      const updated = restaurants.map((r) =>
        r.id === id ? { ...r, name: name.trim(), telNo, kind, menuImgId, menuUrl, naviUrl, prepay: prepay ?? false } : r
      );
      setRestaurants(updated);
      if (selectedRestaurant?.id === id) {
        setSelectedRestaurant({ ...selectedRestaurant, name: name.trim(), telNo, kind, menuImgId, menuUrl, naviUrl, prepay: prepay ?? false });
      }
    } catch (error) {
      console.error('Error saving restaurant', error);
      toast.error('식당 저장 중 오류가 발생했습니다.');
    } finally {
      setSavingRestaurant(false);
    }
  };

  const handleAddNewMenu = useCallback(() => {
    const newMenuKey = `menu-${Date.now()}`;
    setSelectedMenuKey(newMenuKey);
    setSelectedMenu(null);
    setMenuEditOpen(true);
  }, []);

  const handleMenuSave = useCallback(async (menuKey: string, menu: RestaurantMenu) => {
    if (!user || !selectedRestaurant) return;

    try {
      const menuRef = ref(database, `food-resv/restaurant/${selectedRestaurant.id}/menu/${menuKey}`);
      await set(menuRef, menu);
      await loadMenusForDialog();
      await loadAllRestaurantMenus();
      toast.success('메뉴를 저장했습니다.');
      setMenuEditOpen(false);
      setSelectedMenuKey(null);
      setSelectedMenu(null);
    } catch (error) {
      console.error('Error saving menu:', error);
      toast.error('메뉴 저장 중 오류가 발생했습니다.');
      throw error;
    }
  }, [user, selectedRestaurant, loadMenusForDialog, loadAllRestaurantMenus]);

  const handleDeleteMenu = useCallback(async (menuKey: string) => {
    if (!user || !selectedRestaurant) return;

    try {
      const menuRef = ref(database, `food-resv/restaurant/${selectedRestaurant.id}/menu/${menuKey}`);
      await remove(menuRef);
      await loadMenusForDialog();
      await loadAllRestaurantMenus();
      toast.success('메뉴를 삭제했습니다.');
    } catch (error) {
      console.error('Error deleting menu:', error);
      toast.error('메뉴 삭제 중 오류가 발생했습니다.');
    }
  }, [user, selectedRestaurant, loadMenusForDialog, loadAllRestaurantMenus]);

  const handleMenuClick = useCallback((menuKey: string) => {
    const menu = menus[menuKey];
    setSelectedMenuKey(menuKey);
    setSelectedMenu(menu || null);
    setMenuEditOpen(true);
  }, [menus]);

  const handleMenuSelect = useCallback(
    async (menuKey: string, menu: RestaurantMenu): Promise<boolean> => {
      if (!user || !selectedRestaurant) return true;

      const entry = getFirstQueueEntryForRestaurant(
        selectedRestaurant.name,
        zeropayQueueEntries
      );
      if (!entry) {
        try {
          const visitLogRef = ref(
            database,
            `food-resv/visit-log/${user.uid}/${selectedRestaurant.id}`
          );
          await push(visitLogRef, {
            date: dayjs().format('YYYYMMDD'),
            menuName: menu.name,
            cost: typeof menu.cost === 'number' ? menu.cost : 0,
          });
          await loadVisitLogs();
        } catch (error) {
          console.error('Error saving visit log:', error);
        }
        return true;
      }

      const menuCost = typeof menu.cost === 'number' ? menu.cost : 0;
      if (menuCost === entry.parsed.amount) {
        try {
          await completeMenuSelectWithQueue(
            selectedRestaurant.id,
            menuKey,
            menu,
            entry,
            { applyMessageCost: false }
          );
        } catch {
          return false;
        }
        return true;
      }

      setMenuSelectQueueMismatch({
        restaurantId: selectedRestaurant.id,
        menuKey,
        menu,
        entry,
      });
      return false;
    },
    [user, selectedRestaurant, zeropayQueueEntries, loadVisitLogs, completeMenuSelectWithQueue]
  );

  const handleMenuSelectQueueMismatchConfirm = useCallback(
    async (applyMessageCost: boolean) => {
      const pending = menuSelectQueueMismatch;
      if (!pending || !user) return;
      setMenuSelectQueueActionBusy(true);
      try {
        await completeMenuSelectWithQueue(
          pending.restaurantId,
          pending.menuKey,
          pending.menu,
          pending.entry,
          { applyMessageCost }
        );
        setMenuSelectQueueMismatch(null);
        setMenuDialogOpen(false);
        setSelectedRestaurant(null);
      } catch {
        // toast는 completeMenuSelectWithQueue에서 표시
      } finally {
        setMenuSelectQueueActionBusy(false);
      }
    },
    [menuSelectQueueMismatch, user, completeMenuSelectWithQueue]
  );

  const handleEditMenu = useCallback((menuKey: string) => {
    handleMenuClick(menuKey);
  }, [handleMenuClick]);

  const handleRecentMenuClick = useCallback((restaurant: Restaurant) => {
    setSelectedRestaurantForHistory(restaurant);
    setMenuHistoryOpen(true);
  }, []);

  const handleDeleteVisitLog = useCallback(async (restaurantId: string, logKey: string) => {
    if (!user) return;

    try {
      const visitLogRef = ref(database, `food-resv/visit-log/${user.uid}/${restaurantId}/${logKey}`);
      await remove(visitLogRef);
      await loadVisitLogs();
      toast.success('메뉴 이력을 삭제했습니다.');
    } catch (error) {
      console.error('Error deleting visit log:', error);
      toast.error('메뉴 이력 삭제 중 오류가 발생했습니다.');
    }
  }, [user, loadVisitLogs]);

  // 검색 필터링
  const handleSearch = useCallback(() => {
    const addRecentMenu = (restaurantList: Restaurant[]) => {
      return restaurantList.map((restaurant) => {
        const recentLog = visitLogs[restaurant.id];
        if (recentLog && recentLog.length > 0) {
          return {
            ...restaurant,
            recentMenu: {
              date: recentLog[0].date,
              menuName: recentLog[0].menuName,
            },
          };
        }
        return restaurant;
      });
    };

    if (!searchQuery.trim()) {
      const restaurantsWithRecentMenu = addRecentMenu(restaurants);
      restaurantsWithRecentMenu.sort((a, b) =>
        sortRestaurantsWithQueueFirst(a, b, visitLogs, zeropayPendingRestaurantNames)
      );
      setFilteredRestaurants(restaurantsWithRecentMenu);
      return;
    }

    const query = searchQuery.trim().toLowerCase();
    const filtered = restaurants.filter((restaurant) => {
      // 식당명 검색
      if (restaurant.name.toLowerCase().includes(query)) {
        return true;
      }

      // 메뉴명 검색
      const restaurantMenus = allRestaurantMenus[restaurant.id] || {};
      const menuNames = Object.values(restaurantMenus).map((menu) => menu.name.toLowerCase());
      if (menuNames.some((menuName) => menuName.includes(query))) {
        return true;
      }

      return false;
    });

    filtered.sort((a, b) =>
      sortRestaurantsWithQueueFirst(a, b, visitLogs, zeropayPendingRestaurantNames)
    );
    const filteredWithRecentMenu = addRecentMenu(filtered);
    setFilteredRestaurants(filteredWithRecentMenu);
  }, [searchQuery, restaurants, allRestaurantMenus, visitLogs, zeropayPendingRestaurantNames]);

  // visitLogs·큐 반영 후 식당 목록 정렬 (초기 로드 시)
  useEffect(() => {
    if (restaurants.length > 0 && Object.keys(visitLogs).length >= 0) {
      const sorted = [...restaurants].sort((a, b) =>
        sortRestaurantsWithQueueFirst(a, b, visitLogs, zeropayPendingRestaurantNames)
      );
      const needsUpdate = sorted.some((restaurant, index) => restaurant.id !== restaurants[index]?.id);
      if (needsUpdate) {
        setRestaurants(sorted);
      }
    }
  }, [visitLogs, restaurants, zeropayPendingRestaurantNames]);

  // 검색어, 식당 목록, visit-log가 변경될 때 필터링
  useEffect(() => {
    handleSearch();
  }, [searchQuery, restaurants, visitLogs, handleSearch]);

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
                onClick={() => router.replace('/')}
              >
                <BookOpen className="h-5 w-5" />
              </Button>
              <div className="flex items-center gap-2 select-none">
                <span className="text-base font-semibold leading-tight">식당 메뉴</span>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={handleRefreshRestMenu}
                disabled={refreshingNoticeQueue}
                title="결제 알림 큐 새로고침"
              >
                <RefreshCw
                  className={cn('h-5 w-5', refreshingNoticeQueue && 'animate-spin')}
                />
              </Button>
              <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <MoreVertical className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuItem
                  onSelect={() => router.replace('/')}
                  className="flex items-center gap-2"
                >
                  <UtensilsCrossed className="h-4 w-4" />
                  포장 예약
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

        <div className="mx-auto w-full max-w-xl px-3 py-3 border-b border-border/40">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              type="text"
              placeholder="식당명 또는 메뉴명으로 검색"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleSearch();
                }
              }}
              className="pl-9 pr-9"
            />
            {searchQuery && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6"
                onClick={() => setSearchQuery('')}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        <main className="mx-auto w-full max-w-xl px-3 pb-28">
          <RestaurantList
            restaurants={filteredRestaurants.length > 0 || searchQuery.trim() ? filteredRestaurants : restaurants}
            onSelect={handleRestaurantClick}
            onRecentMenuClick={handleRecentMenuClick}
            loading={loading}
            error={error}
            currentTheme={currentTheme}
            restaurantIcons={restaurantIcons}
            allVisitLogs={allVisitLogs}
            zeropayPendingRestaurantNames={zeropayPendingRestaurantNames}
          />
        </main>

        <RestaurantMenuDialog
          open={menuDialogOpen}
          restaurant={selectedRestaurant}
          menus={menus}
          onClose={() => {
            setMenuDialogOpen(false);
            setSelectedRestaurant(null);
          }}
          onImageClick={handleImageClick}
          onEditRestaurant={handleOpenRestaurantEditor}
          onOpenMenuResource={handleMenuImageOpen}
          onDeleteMenu={handleDeleteMenu}
          onAddMenu={handleAddNewMenu}
          onMenuClick={handleMenuClick}
          onEditMenu={handleEditMenu}
          onMenuSelect={handleMenuSelect}
          hasZeropayQueueForRestaurant={hasMenuZeropayQueue}
          zeropayImportPreview={menuZeropayImportPreview}
          onRegisterMenuFromQueue={handleRegisterMenuFromQueue}
          importingMenuZeropay={importingMenuZeropay}
        />

        <AlertDialog
          open={!!menuSelectQueueMismatch}
          onOpenChange={(nextOpen) => {
            if (!nextOpen && !menuSelectQueueActionBusy) {
              setMenuSelectQueueMismatch(null);
            }
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>알림 금액과 메뉴 금액이 다릅니다</AlertDialogTitle>
              <AlertDialogDescription>
                {menuSelectQueueMismatch ? (
                  <>
                    메뉴{' '}
                    {formatCurrency(
                      typeof menuSelectQueueMismatch.menu.cost === 'number'
                        ? menuSelectQueueMismatch.menu.cost
                        : 0
                    )}
                    원 · 알림 {formatCurrency(menuSelectQueueMismatch.entry.parsed.amount)}원. 알림에서
                    추출한 금액을 메뉴에 반영할까요?
                  </>
                ) : null}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="flex w-full flex-col gap-2 sm:flex-row sm:justify-end">
              <Button
                disabled={menuSelectQueueActionBusy}
                onClick={() => void handleMenuSelectQueueMismatchConfirm(true)}
              >
                반영
              </Button>
              <Button
                variant="outline"
                disabled={menuSelectQueueActionBusy}
                onClick={() => void handleMenuSelectQueueMismatchConfirm(false)}
              >
                반영 안함
              </Button>
              <AlertDialogCancel disabled={menuSelectQueueActionBusy}>취소</AlertDialogCancel>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <ImageViewDialog
          open={imageViewOpen}
          imageUrl={currentImageUrl}
          onClose={() => setImageViewOpen(false)}
        />

        <ThemeDialog
          open={themeDialogOpen}
          selectedTheme={selectedTheme}
          onClose={() => setThemeDialogOpen(false)}
          onSelect={handleThemeSelect}
          saving={false}
        />

        <RestaurantKindManageDialog
          open={kindManageDialogOpen}
          restaurantKinds={restaurantKinds}
          restaurantIcons={restaurantIcons}
          onClose={() => setKindManageDialogOpen(false)}
          onSave={handleKindSave}
          onDelete={handleKindDelete}
        />

        <RestaurantFormDialog
          open={createDialogOpen}
          mode="create"
          restaurant={newRestaurant}
          onChange={(updates) => setNewRestaurant((prev) => ({ ...prev, ...updates }))}
          onClose={() => setCreateDialogOpen(false)}
          onSave={handleRestaurantCreate}
          saving={creatingRestaurant}
          restaurantKinds={restaurantKinds}
          restaurantIcons={restaurantIcons}
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
            restaurantKinds={restaurantKinds}
            restaurantIcons={restaurantIcons}
            cloudName={cloudName}
            uploadPreset={uploadPreset}
            thumbnailPreset={thumbnailPreset}
            onMenuSave={handleMenuSave}
          />
        )}

        {selectedRestaurant && (
          <MenuEditDialog
            open={menuEditOpen}
            menu={selectedMenu}
            menuKey={selectedMenuKey}
            restaurantId={selectedRestaurant.id}
            cloudName={cloudName}
            mobilePreset={uploadPreset}
            thumbnailPreset={thumbnailPreset}
            onClose={() => {
              setMenuEditOpen(false);
              setSelectedMenuKey(null);
              setSelectedMenu(null);
            }}
            onSave={handleMenuSave}
          />
        )}

        {/* 메뉴 이력 팝업 */}
        <Dialog open={menuHistoryOpen} onOpenChange={(open) => setMenuHistoryOpen(open)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {selectedRestaurantForHistory?.name}
              </DialogTitle>
            </DialogHeader>
            <div className="max-h-80 space-y-2 overflow-y-auto">
              {selectedRestaurantForHistory && allVisitLogs[selectedRestaurantForHistory.id] ? (
                (() => {
                  const logs = allVisitLogs[selectedRestaurantForHistory.id];
                  // 날짜 역순 정렬 (이미 정렬되어 있지만 확실히 하기 위해)
                  const sortedLogs = [...logs].sort((a, b) => {
                    const dateA = a.date || '';
                    const dateB = b.date || '';
                    return dateB.localeCompare(dateA);
                  });
                  
                  return sortedLogs.length > 0 ? (
                    sortedLogs.map((log, index) => {
                      // yyyyMMdd 형식을 yyyy.mm.dd 형식으로 변환
                      let displayDate = '';
                      if (log.date && log.date.length === 8) {
                        const year = log.date.substring(0, 4);
                        const month = log.date.substring(4, 6);
                        const day = log.date.substring(6, 8);
                        displayDate = `${year}.${month}.${day}`;
                      } else {
                        displayDate = log.date;
                      }
                      
                      return (
                        <div
                          key={log.key || index}
                          className="flex items-center justify-between gap-2 rounded-sm border border-transparent px-3 py-2 text-sm transition hover:border-border hover:bg-muted"
                        >
                          <span className="text-muted-foreground shrink-0">{displayDate}</span>
                          <div className="flex min-w-0 flex-1 items-center justify-between gap-2">
                            <span className="font-medium truncate">{log.menuName}</span>
                            {typeof log.cost === 'number' && log.cost > 0 && (
                              <span className="shrink-0 text-sm text-muted-foreground whitespace-nowrap">
                                {formatCurrency(log.cost)}원
                              </span>
                            )}
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 shrink-0"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (selectedRestaurantForHistory && log.key) {
                                handleDeleteVisitLog(selectedRestaurantForHistory.id, log.key);
                              }
                            }}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      );
                    })
                  ) : (
                    <p className="text-sm text-muted-foreground">등록된 메뉴 이력이 없습니다.</p>
                  );
                })()
              ) : (
                <p className="text-sm text-muted-foreground">등록된 메뉴 이력이 없습니다.</p>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </ProtectedRoute>
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

