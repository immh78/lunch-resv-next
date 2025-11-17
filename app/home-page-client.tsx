'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import dayjs from 'dayjs';
import { ref, onValue, set, remove, get, update } from 'firebase/database';
import { toast } from 'sonner';

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
  Palette,
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

const sumMenuAmount = (menus: { cost: number }[]): number =>
  menus.reduce((sum, menu) => sum + (menu.cost || 0), 0);

const sumPrepaymentAmount = (items: { amount: number }[]): number =>
  items.reduce((sum, item) => sum + (item.amount || 0), 0);

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
                    'w-[140px] max-w-[140px] justify-start transition-colors overflow-hidden',
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
                      <IconComponent className="mr-2 h-4 w-4 shrink-0" />
                    ) : null;
                  })()}
                  <span className="truncate min-w-0">
                    {restaurant.name}
                  </span>
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
  onPrepaymentAmountChange: (id: string, amount: number) => void;
  onPrepaymentDateChange: (id: string, date: Date | undefined) => void;
  onAddPrepaymentRow: () => void;
  onRemovePrepaymentRow: (id: string) => void;
  onShare: () => void;
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
  onPrepaymentAmountChange,
  onPrepaymentDateChange,
  onAddPrepaymentRow,
  onRemovePrepaymentRow,
  onShare,
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
                <Tabs value={currentTab} onValueChange={(value) => onTabChange(value as 'menu' | 'prepayment')}>
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="menu">메뉴</TabsTrigger>
                    <TabsTrigger value="prepayment">선결제</TabsTrigger>
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
                          {menuRows.map((menu) => (
                            <div
                              key={menu.id}
                              className="grid grid-cols-[1fr_auto_auto] items-center gap-2 px-3 py-2"
                            >
                              <Input
                                value={menu.menu}
                                onChange={(event) =>
                                  onMenuChange(menu.id, 'menu', event.target.value)
                                }
                                placeholder="메뉴"
                                className="text-sm"
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
                                className="w-24 text-right text-sm"
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
                          ))}
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
                                      !selectedDate && "text-muted-foreground"
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
                                className="w-24 text-right text-sm"
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

type ImageUploadDialogProps = {
  open: boolean;
  onClose: () => void;
  onUploaded: (publicId: string) => void;
  cloudName: string;
  uploadPreset: string;
  initialPublicId?: string | null;
  uploadBoth?: boolean; // mobile용과 thumbnail용 두 개 업로드 여부
  onBothUploaded?: (mobileId: string, thumbnailId: string) => void;
};

function ImageUploadDialog({
  open,
  onClose,
  onUploaded,
  cloudName,
  uploadPreset,
  initialPublicId,
  uploadBoth = false,
  onBothUploaded,
}: ImageUploadDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showSourceMenu, setShowSourceMenu] = useState(false);
  const [imageLoadError, setImageLoadError] = useState(false);
  const [imageLoading, setImageLoading] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [currentUrlIndex, setCurrentUrlIndex] = useState(0);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);

  const cleanupPreview = useCallback(() => {
    setPreviewUrl((prev) => {
      if (prev) {
        URL.revokeObjectURL(prev);
      }
      return null;
    });
  }, []);

  useEffect(() => {
    if (!open) {
      // 팝업이 닫힐 때만 초기화
      cleanupPreview();
      setFile(null);
      setErrorMessage(null);
      setShowSourceMenu(false);
      setImageLoadError(false);
      setImageLoading(false);
      setImageUrl(null);
      setCurrentUrlIndex(0);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      if (cameraInputRef.current) {
        cameraInputRef.current.value = '';
      }
      return;
    }

    // 팝업이 열릴 때 초기화
    cleanupPreview();
    setFile(null);
    setErrorMessage(null);
    setShowSourceMenu(false);
    setImageLoadError(false);
    setImageLoading(false);
    setCurrentUrlIndex(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    if (cameraInputRef.current) {
      cameraInputRef.current.value = '';
    }

    // initialPublicId가 있으면 Cloudinary에서 이미지 조회
    if (initialPublicId && initialPublicId.trim()) {
      try {
        let publicId = initialPublicId.trim();
        // public_id에서 확장자 제거 (이미 포함되어 있을 수 있음)
        publicId = publicId.replace(/\.(jpg|jpeg|png|webp|gif)$/i, '');
        
        // JPG 확장자를 붙여서 조회
        const imageUrl = `https://res.cloudinary.com/${cloudName}/image/upload/f_auto,q_auto/${publicId}.jpg`;
        setImageUrl(imageUrl);
        setImageLoading(true);
        setImageLoadError(false);
      } catch (error) {
        console.error('Cloudinary 이미지 URL 생성 실패:', error);
        setImageLoadError(true);
        setImageLoading(false);
        setImageUrl(null);
      }
    } else {
      setImageUrl(null);
    }
  }, [open, cleanupPreview, initialPublicId, cloudName]);

  const validateAndSetFile = useCallback(
    (nextFile: File) => {
      if (!['image/jpeg'].includes(nextFile.type)) {
        const message = 'JPG 형식의 이미지 파일만 업로드할 수 있어요.';
        setErrorMessage(message);
        toast.error(message);
        return;
      }

      if (nextFile.size > 5_000_000) {
        const message = '파일 용량은 5MB 이하로 제한돼요.';
        setErrorMessage(message);
        toast.error(message);
        return;
      }

      cleanupPreview();
      setFile(nextFile);
      setErrorMessage(null);
      const objectUrl = URL.createObjectURL(nextFile);
      setPreviewUrl(objectUrl);
    },
    [cleanupPreview]
  );

  const handleFileChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const nextFile = event.target.files?.[0];
      if (!nextFile || uploading) return;
      validateAndSetFile(nextFile);
    },
    [uploading, validateAndSetFile]
  );

  const handleDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      if (uploading) return;
      const nextFile = event.dataTransfer.files?.[0];
      if (!nextFile) return;
      validateAndSetFile(nextFile);
    },
    [uploading, validateAndSetFile]
  );

  const handleDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
  }, []);

  const handleUpload = useCallback(async () => {
    if (!file) {
      const message = '업로드할 이미지를 먼저 선택하세요.';
      setErrorMessage(message);
      toast.error(message);
      return;
    }

    setUploading(true);
    setErrorMessage(null);

    try {
      if (uploadBoth && onBothUploaded) {
        // mobile용과 thumbnail용 두 개 업로드
        const thumbnailPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET_THUMBNAIL || uploadPreset;
        
        // mobile용 업로드
        const mobileFormData = new FormData();
        mobileFormData.append('file', file);
        mobileFormData.append('upload_preset', uploadPreset);

        const mobileResponse = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
          method: 'POST',
          body: mobileFormData,
        });

        const mobileData = await mobileResponse.json();

        if (!mobileResponse.ok || !mobileData?.public_id) {
          throw new Error(mobileData?.error?.message ?? 'mobile용 이미지 업로드에 실패했습니다.');
        }

        // thumbnail용 업로드
        const thumbnailFormData = new FormData();
        thumbnailFormData.append('file', file);
        thumbnailFormData.append('upload_preset', thumbnailPreset);

        const thumbnailResponse = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
          method: 'POST',
          body: thumbnailFormData,
        });

        const thumbnailData = await thumbnailResponse.json();

        if (!thumbnailResponse.ok || !thumbnailData?.public_id) {
          throw new Error(thumbnailData?.error?.message ?? 'thumbnail용 이미지 업로드에 실패했습니다.');
        }

        onBothUploaded(mobileData.public_id as string, thumbnailData.public_id as string);
      } else {
        // 기존 단일 업로드
        const formData = new FormData();
        formData.append('file', file);
        formData.append('upload_preset', uploadPreset);

        const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
          method: 'POST',
          body: formData,
        });

        const data = await response.json();

        if (!response.ok || !data?.public_id) {
          throw new Error(data?.error?.message ?? '이미지 업로드에 실패했습니다.');
        }

        onUploaded(data.public_id as string);
      }

      cleanupPreview();
      setFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      console.error('Cloudinary 업로드 오류:', error);
      const message =
        error instanceof Error ? error.message : '이미지 업로드 중 문제가 발생했습니다.';
      setErrorMessage(message);
      toast.error(message);
    } finally {
      setUploading(false);
    }
  }, [cleanupPreview, cloudName, file, onUploaded, onBothUploaded, uploadBoth, uploadPreset]);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && !uploading) {
          onClose();
        }
      }}
    >
      <DialogContent className="flex max-w-lg flex-col gap-0 p-0">
        <DialogHeader className="border-b border-border/50 px-5 py-4">
          <DialogTitle>메뉴 이미지 업로드</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 px-5 py-4">
          <div
            className={cn(
              'group relative flex cursor-pointer flex-col items-center justify-center rounded-sm border border-dashed border-border/70 bg-muted/40 px-4 py-10 text-center transition hover:border-border hover:bg-muted',
              uploading && 'pointer-events-none opacity-70'
            )}
            onClick={() => {
              if (!previewUrl) {
                setShowSourceMenu(true);
              }
            }}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            role="button"
            tabIndex={0}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                if (!previewUrl) {
                  setShowSourceMenu(true);
                }
              }
            }}
          >
            {previewUrl ? (
              <img
                src={previewUrl}
                alt="선택한 이미지 미리보기"
                className="h-48 w-full rounded-sm object-cover shadow-sm"
              />
            ) : (
              <>
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-background/80 shadow-sm ring-1 ring-border/60">
                  <Camera className="h-6 w-6 text-muted-foreground" />
                </div>
                <p className="mt-4 text-sm font-medium text-foreground">
                  이미지를 드래그하거나 클릭해서 선택하세요
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  지원 형식: JPG · 최대 5MB
                </p>
              </>
            )}

            {showSourceMenu && !previewUrl && (
              <div 
                className="absolute inset-0 z-10 flex items-center justify-center rounded-sm bg-background/95"
                onClick={(e) => {
                  if (e.target === e.currentTarget) {
                    setShowSourceMenu(false);
                  }
                }}
              >
                <div className="flex flex-col gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowSourceMenu(false);
                      cameraInputRef.current?.click();
                    }}
                  >
                    <Camera className="mr-2 h-4 w-4" />
                    사진 촬영
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowSourceMenu(false);
                      fileInputRef.current?.click();
                    }}
                  >
                    파일 선택
                  </Button>
                </div>
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg"
              className="hidden"
              onChange={handleFileChange}
            />
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/jpeg"
              capture="environment"
              className="hidden"
              onChange={handleFileChange}
            />

            {uploading && (
              <div className="absolute inset-0 flex items-center justify-center rounded-sm bg-background/80">
                <Spinner size="md" />
              </div>
            )}
          </div>

          {errorMessage && (
            <Alert variant="destructive">
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
          )}

          {initialPublicId && initialPublicId.trim() && imageUrl && (
            <div className="rounded-sm border border-border/60 bg-muted/30 p-3">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>등록된 이미지</span>
                <span className="font-mono text-[11px] break-all">{initialPublicId.trim()}</span>
              </div>
              <div className="mt-3 overflow-hidden rounded-sm border border-border/60 bg-background relative">
                {imageLoading && !imageLoadError && (
                  <div className="absolute inset-0 flex items-center justify-center bg-background/80">
                    <Spinner size="sm" />
                  </div>
                )}
                {!imageLoadError ? (
                  <img
                    key={imageUrl} // key를 변경하여 이미지 재시도
                    src={imageUrl}
                    alt="등록된 메뉴 이미지 미리보기"
                    className="h-40 w-full object-cover"
                    onError={() => {
                      const publicId = initialPublicId?.trim() || '';
                      const cleanPublicId = publicId.replace(/\.(jpg|jpeg|png|webp|gif)$/i, '');
                      console.error('이미지 로드 실패:', publicId, 'URL:', imageUrl);
                      setImageLoadError(true);
                      setImageLoading(false);
                    }}
                    onLoad={() => {
                      setImageLoadError(false);
                      setImageLoading(false);
                    }}
                  />
                ) : (
                  <div className="flex h-40 items-center justify-center text-xs text-muted-foreground">
                    <span>이미지를 불러올 수 없습니다</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="border-t border-border/50 px-5 py-4">
          <Button variant="ghost" onClick={onClose} disabled={uploading}>
            취소
          </Button>
          <Button onClick={handleUpload} disabled={uploading || !file}>
            {uploading ? <Spinner size="sm" /> : '업로드'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type MenuEditDialogProps = {
  open: boolean;
  menu: RestaurantMenu | null;
  menuKey: string | null;
  restaurantId: string;
  cloudName: string;
  mobilePreset: string;
  thumbnailPreset: string;
  onClose: () => void;
  onSave: (menuKey: string, menu: RestaurantMenu) => void;
};

function MenuEditDialog({
  open,
  menu,
  menuKey,
  restaurantId,
  cloudName,
  mobilePreset,
  thumbnailPreset,
  onClose,
  onSave,
}: MenuEditDialogProps) {
  const [menuName, setMenuName] = useState('');
  const [cost, setCost] = useState<number>(0);
  const [remark, setRemark] = useState('');
  const [img, setImg] = useState('');
  const [thumbnail, setThumbnail] = useState('');
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (menu) {
      setMenuName(menu.name || '');
      setCost(menu.cost || 0);
      setRemark(menu.remark || '');
      setImg(menu.img || '');
      setThumbnail(menu.thumbnail || '');
    } else {
      setMenuName('');
      setCost(0);
      setRemark('');
      setImg('');
      setThumbnail('');
    }
  }, [menu, open]);

  const handleSave = useCallback(async () => {
    if (!menuName.trim()) {
      toast.error('메뉴명을 입력해주세요.');
      return;
    }

    if (!menuKey) {
      toast.error('메뉴 키가 없습니다.');
      return;
    }

    setSaving(true);
    try {
      const menuData: RestaurantMenu = {
        name: menuName.trim(),
        cost: cost || 0,
        remark: remark.trim(),
        img: img,
        thumbnail: thumbnail,
      };
      await onSave(menuKey, menuData);
      toast.success('메뉴를 저장했습니다.');
      onClose();
    } catch (error) {
      console.error('Error saving menu:', error);
      toast.error('메뉴 저장 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  }, [menuName, cost, remark, img, thumbnail, menuKey, onSave, onClose]);

    const handleImageUpload = useCallback(
      async (mobileId: string, thumbnailId: string) => {
        setImg(mobileId);
        setThumbnail(thumbnailId);
        setUploadDialogOpen(false);

        if (!menuKey) {
          toast.success('이미지를 업로드했습니다.');
          return;
        }

        try {
          const menuRef = ref(database, `food-resv/restaurant/${restaurantId}/menu/${menuKey}`);
          await update(menuRef, {
            img: mobileId,
            thumbnail: thumbnailId,
          });
          toast.success('이미지를 업로드했습니다.');
        } catch (error) {
          console.error('Error saving menu images:', error);
          toast.error('이미지를 저장하는 중 오류가 발생했습니다.');
        }
      },
      [restaurantId, menuKey]
    );

  return (
    <>
      <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{menu ? '메뉴 수정' : '메뉴 등록'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 px-[15px] pb-[15px]">
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground">메뉴명</Label>
              <Input
                value={menuName}
                onChange={(event) => setMenuName(event.target.value)}
                placeholder="메뉴명"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground">가격</Label>
              <Input
                type="number"
                value={cost || ''}
                onChange={(event) => setCost(Number(event.target.value) || 0)}
                placeholder="가격"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground">사진</Label>
              <Button
                type="button"
                variant="outline"
                className="w-full justify-start"
                onClick={() => setUploadDialogOpen(true)}
              >
                <Camera className={cn("mr-2 h-4 w-4", img && "text-green-500")} />
                {img ? '이미지 업로드됨' : '이미지 업로드'}
              </Button>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground">비고</Label>
              <Input
                value={remark}
                onChange={(event) => setRemark(event.target.value)}
                placeholder="비고"
              />
            </div>
          </div>

          <DialogFooter className="flex flex-row justify-end border-t-0">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleSave}
              disabled={saving || !menuName.trim()}
              className="h-8 w-8"
            >
              {saving ? <Spinner size="sm" /> : <Save className="h-4 w-4" />}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ImageUploadDialog
        open={uploadDialogOpen}
        onClose={() => setUploadDialogOpen(false)}
        onUploaded={() => {}}
        cloudName={cloudName}
        uploadPreset={mobilePreset}
        uploadBoth={true}
        onBothUploaded={handleImageUpload}
        initialPublicId={img || null}
      />
    </>
  );
}

type MenuListDialogProps = {
  open: boolean;
  restaurantName: string;
  menus: Record<string, RestaurantMenu>;
  onClose: () => void;
  onMenuClick: (menuKey: string) => void;
  onAddNewMenu: () => void;
};

function MenuListDialog({
  open,
  restaurantName,
  menus,
  onClose,
  onMenuClick,
  onAddNewMenu,
}: MenuListDialogProps) {
  const menuEntries = Object.entries(menus);

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader className="space-y-0">
          <div className="flex items-center gap-2">
            <DialogTitle>{restaurantName} 메뉴목록</DialogTitle>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground"
              onClick={onAddNewMenu}
            >
              <PlusCircle className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>
        <div className="max-h-80 space-y-2 overflow-y-auto">
          {menuEntries.length === 0 ? (
            <p className="text-sm text-muted-foreground">등록된 메뉴가 없습니다.</p>
          ) : (
            menuEntries.map(([key, menu]) => (
              <button
                key={key}
                type="button"
                className="flex w-full items-center justify-between rounded-sm border border-transparent px-3 py-2 text-left text-sm transition hover:border-border hover:bg-muted"
                onClick={() => {
                  onMenuClick(key);
                  onClose();
                }}
              >
                <span>{menu.name}</span>
                {menu.cost > 0 && (
                  <span className="text-xs text-muted-foreground">
                    {formatCurrency(menu.cost)}원
                  </span>
                )}
              </button>
            ))
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
      setMenus({});
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
              {hasMenuListImage ? '이미지 업로드됨' : '이미지 업로드'}
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

  const [selectedRestaurant, setSelectedRestaurant] = useState<RestaurantWithReservation | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [menuRows, setMenuRows] = useState<EditableMenuItem[]>([]);
  const [reservationDate, setReservationDate] = useState<string>('');
  const [prepaymentRows, setPrepaymentRows] = useState<EditablePrepaymentItem[]>([]);
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
  });
  const [savingRestaurant, setSavingRestaurant] = useState(false);
  const [creatingRestaurant, setCreatingRestaurant] = useState(false);

  const [currentTheme, setCurrentTheme] = useState<ThemeMode>('white');
  const [selectedTheme, setSelectedTheme] = useState<ThemeMode>('white');
  const [themeDialogOpen, setThemeDialogOpen] = useState(false);
  const [savingTheme, setSavingTheme] = useState(false);

  const [hiddenRestaurantIds, setHiddenRestaurantIds] = useState<string[]>([]);
  const [showHidden, setShowHidden] = useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [uploadContext, setUploadContext] = useState<UploadContext | null>(null);
  const [restaurantIcons, setRestaurantIcons] = useState<Record<string, string>>({});
  const [restaurantKinds, setRestaurantKinds] = useState<Record<string, { icon?: string; name?: string }>>({});

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
    if (!user) return;

    const themeRef = ref(database, `food-resv/theme/${user.uid}`);
    const unsubscribe = onValue(
      themeRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const themeData = snapshot.val();
          if (themeData.theme === 'white' || themeData.theme === 'black') {
            setCurrentTheme(themeData.theme);
            setSelectedTheme(themeData.theme);
          }
        }
      },
      (err) => {
        console.error('Error fetching theme:', err);
      }
    );

    return () => unsubscribe();
  }, [user]);

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
            }
          : row
      )
    );
  };

  const handleAddMenuRow = () => {
    setMenuRows((prev) => [
      ...prev,
      { id: `menu-${Date.now()}-${prev.length}`, menu: '', cost: 0 },
    ]);
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
    setPrepaymentRows((prev) => [
      ...prev,
      {
        id: `prepayment-${Date.now()}-${prev.length}`,
        amount: 0,
        date: dayjs(now).format('YYYYMMDD'),
        dateValue: now,
      },
    ]);
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
            setPrepaymentRows(
              data.map((item, index) => {
                const dateValue = compactToDate(item.date) ?? new Date();
                return {
                  id: `prepayment-${Date.now()}-${index}`,
                  amount: item.amount || 0,
                  date: item.date || todayCompact(),
                  dateValue,
                };
              })
            );
            return;
          }
        }
      } catch (error) {
        console.error('Error loading prepayments', error);
      }
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
          }))
        );
      } else {
        setMenuRows([{ id: `menu-${Date.now()}`, menu: '', cost: 0 }]);
      }

      await loadPrepayments(user.uid, restaurant.id);
      setCurrentTab(hasActiveReservation ? 'prepayment' : 'menu');
      setDetailOpen(true);
    },
    [loadPrepayments, user]
  );

  const handleCloseDetail = () => {
    setDetailOpen(false);
    setSelectedRestaurant(null);
    setMenuRows([]);
    setPrepaymentRows([]);
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

  const handleShare = () => {
    if (!selectedRestaurant) return;

    const validMenus = menuRows.filter((menu) => menu.menu.trim() && menu.cost > 0);
    const menuText = validMenus.map((menu) => menu.menu.trim()).join(' + ');
    const totalAmount = validMenus.reduce((sum, menu) => sum + menu.cost, 0);

    const validPrepayments = prepaymentRows
      .filter((item) => item.amount > 0 && item.date)
      .sort((a, b) => a.date.localeCompare(b.date));

    const prepaymentLines = validPrepayments.map(
      (item) => `${formatShareDate(item.date)} ${formatCurrency(item.amount)}원`
    );
    const prepaymentTotal = validPrepayments.reduce((sum, item) => sum + item.amount, 0);

    const lines: string[] = ['━━━━━━━━━━'];
    if (menuText) lines.push(`■ 메뉴 : ${menuText}`);
    if (totalAmount > 0) lines.push(`■ 가격 : ${formatCurrency(totalAmount)}원`);
    if (reservationDate) lines.push(`■ 예약일 : ${formatShareReservationDate(reservationDate)}`);
    lines.push('━━━━━━━━━━');

    if (prepaymentLines.length) {
      lines.push('');
      lines.push('□ 선결제');
      lines.push(...prepaymentLines);
      lines.push('──────────');
      lines.push(`합계 ${formatCurrency(prepaymentTotal)}원`);
    }

    const text = lines.join('\n');

    (async () => {
      try {
        if (navigator.share) {
          await navigator.share({ title: '', text });
        } else {
          await navigator.clipboard.writeText(text);
          toast.success('공유 내용을 클립보드에 복사했습니다.');
        }
      } catch (error) {
        if ((error as Error).name !== 'AbortError') {
          console.error('Error sharing', error);
          toast.error('공유 중 오류가 발생했습니다.');
        }
      }
    })();
  };

  const handleThemeSelect = async (theme: ThemeMode) => {
    const previousTheme = currentTheme;

    setSelectedTheme(theme);
    setCurrentTheme(theme);

    if (!user) {
      setThemeDialogOpen(false);
      return;
    }

    try {
      setSavingTheme(true);
      await set(ref(database, `food-resv/theme/${user.uid}`), { theme });
      setThemeDialogOpen(false);
    } catch (error) {
      console.error('Error saving theme', error);
      setCurrentTheme(previousTheme);
      setSelectedTheme(previousTheme);
      toast.error('테마 저장 중 오류가 발생했습니다.');
    } finally {
      setSavingTheme(false);
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
    const { id, name, telNo, kind, menuImgId, menuUrl, naviUrl } = editableRestaurant;
    if (!name.trim()) {
      toast.error('식당명을 입력해주세요.');
      return;
    }
    try {
      setSavingRestaurant(true);
      await set(ref(database, `food-resv/restaurant/${id}`), {
        name: name.trim(),
        telNo: telNo || '',
        kind: kind || '',
        menuImgId: menuImgId || '',
        menuUrl: menuUrl || '',
        naviUrl: naviUrl || '',
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

  const handleMenuSave = useCallback(async (menuKey: string, menu: RestaurantMenu) => {
    if (!user || !editableRestaurant) return;

    try {
      const menuRef = ref(database, `food-resv/restaurant/${editableRestaurant.id}/menu/${menuKey}`);
      await set(menuRef, menu);
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
                onClick={() => router.push('/rest-menu')}
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
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <MoreVertical className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuItem
                  onSelect={() => router.push('/rest-menu')}
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
              </DropdownMenuContent>
            </DropdownMenu>
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
          onPrepaymentAmountChange={handlePrepaymentAmountChange}
          onPrepaymentDateChange={handlePrepaymentDateChange}
          onAddPrepaymentRow={handleAddPrepaymentRow}
          onRemovePrepaymentRow={handleRemovePrepaymentRow}
          onShare={handleShare}
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
          saving={savingTheme}
        />

        <DeleteConfirmDialog
          open={deleteState.open}
          target={deleteState.target}
          onCancel={() => setDeleteState({ open: false, target: null })}
          onConfirm={handleConfirmDelete}
        />
      </div>
    </ProtectedRoute>
  );
}
