'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import { ref, onValue, set, remove, get } from 'firebase/database';
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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { cn } from '@/lib/utils';

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

interface CloudinaryWindow extends Window {
  cloudinary?: {
    createUploadWidget: (
      options: {
        cloudName: string;
        uploadPreset: string;
        sources: string[];
        multiple: boolean;
        folder: string;
        maxFileSize: number;
        cropping: boolean;
        clientAllowedFormats: string[];
        showAdvancedOptions: boolean;
        showPoweredBy: boolean;
        styles: { palette: { windowBorder: string } };
      },
      callback: (error: Error | null, result: { event?: string; info?: { public_id: string } }) => void
    ) => {
      open: () => void;
    };
  };
}

interface CloudinaryUploadWidget {
  open: () => void;
}

interface Restaurant {
  id: string;
  name: string;
  telNo: string;
  kind?: string;
  menuImgId?: string;
  menuUrl?: string;
  naviUrl?: string;
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
                    'w-full justify-start truncate',
                    !isReceipt && 'font-semibold text-foreground'
                  )}
                  onClick={(event) => {
                    event.stopPropagation();
                    onSelect(restaurant);
                  }}
                >
                  {restaurant.name}
                </Button>
              </TableCell>
              <TableCell className="align-middle">
                <div className="flex flex-col gap-1">
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
                      currentTheme === 'white' ? 'text-black hover:text-black/80' : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    <Phone className="h-4 w-4" />
                  </a>
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={!restaurant.naviUrl}
                    className={cn(
                      'h-8 w-8',
                      !restaurant.naviUrl && 'pointer-events-none'
                    )}
                    onClick={(event) => {
                      event.stopPropagation();
                      if (restaurant.naviUrl) {
                        const baseUrl = 'https://map.naver.com/v5/search/';
                        window.open(`${baseUrl}${encodeURIComponent(restaurant.naviUrl)}`, '_blank');
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
                  <MoreHorizontal className="h-5 w-5" />
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
  currentTab,
  onTabChange,
  savingMenus,
  savingPrepayments,
  isReceipt,
  summary,
}: RestaurantDetailDialogProps) {
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
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className="w-full justify-between font-normal"
                          >
                            {reservationDate || '예약일을 선택하세요'}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={displayToDate(reservationDate) ?? undefined}
                            onSelect={onReservationDateChange}
                            initialFocus
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
                      {prepaymentRows.map((item) => (
                        <div
                          key={item.id}
                          className="grid grid-cols-[1fr_auto_auto] items-center gap-2 px-3 py-2"
                        >
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                className="justify-start text-left font-normal"
                              >
                                {item.date ? compactToDisplay(item.date) : '날짜'}
                              </Button>
                            </PopoverTrigger>
                              <PopoverContent className="w-auto p-0" align="start">
                                <Calendar
                                  mode="single"
                                  selected={item.dateValue ?? compactToDate(item.date) ?? undefined}
                                  onSelect={(date) => onPrepaymentDateChange(item.id, date)}
                                  initialFocus
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
                      ))}
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
}: RestaurantFormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="flex max-h-[85vh] max-w-md flex-col p-0">
        <DialogHeader className="border-b border-border/50 px-5 py-4">
          <DialogTitle>{mode === 'edit' ? restaurant.id : '식당 등록'}</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-5 py-4">
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
            <Input
              value={restaurant.kind ?? ''}
              onChange={(event) => onChange({ kind: event.target.value })}
              placeholder="식당 종류"
            />
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
            <Label className="text-xs font-medium text-muted-foreground">메뉴 이미지 ID</Label>
            <div className="flex items-center gap-2">
              <Input
                value={restaurant.menuImgId ?? ''}
                onChange={(event) => onChange({ menuImgId: event.target.value })}
                placeholder="Cloudinary 이미지 ID"
              />
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 text-muted-foreground"
                onClick={onOpenUpload}
              >
                <Camera className="h-4 w-4" />
              </Button>
            </div>
          </div>

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
  );
}

type ThemeDialogProps = {
  open: boolean;
  selectedTheme: ThemeMode;
  onChange: (theme: ThemeMode) => void;
  onClose: () => void;
  onSave: () => void;
  saving: boolean;
};

function ThemeDialog({ open, selectedTheme, onChange, onClose, onSave, saving }: ThemeDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>테마 설정</DialogTitle>
          <DialogDescription>선호하는 테마를 선택해주세요.</DialogDescription>
        </DialogHeader>
        <RadioGroup
          value={selectedTheme}
          onValueChange={(value) => onChange(value as ThemeMode)}
          className="space-y-3"
        >
          <div className="flex items-center gap-2 rounded-sm border border-border px-3 py-2 text-sm">
            <RadioGroupItem value="white" id="theme-white" />
            <Label htmlFor="theme-white" className="cursor-pointer">
              화이트
            </Label>
          </div>
          <div className="flex items-center gap-2 rounded-sm border border-border px-3 py-2 text-sm">
            <RadioGroupItem value="black" id="theme-black" />
            <Label htmlFor="theme-black" className="cursor-pointer">
              블랙
            </Label>
          </div>
        </RadioGroup>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            닫기
          </Button>
          <Button onClick={onSave} disabled={saving}>
            {saving && <Spinner size="sm" className="mr-2" />}
            확인
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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

  const [uploadWidget, setUploadWidget] = useState<CloudinaryUploadWidget | null>(null);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', currentTheme === 'black');
  }, [currentTheme]);

  useEffect(() => {
    if (!hiddenRestaurantIds.length) {
      setShowHidden(false);
    }
  }, [hiddenRestaurantIds]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const cloudinaryWindow = window as unknown as CloudinaryWindow;

    const setup = () => {
      if (!cloudinaryWindow.cloudinary) return;

      const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || 'da5h7wjxc';
      const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET || 'images';

      const widget = cloudinaryWindow.cloudinary.createUploadWidget(
        {
          cloudName,
          uploadPreset,
          sources: ['local', 'url', 'camera'],
          multiple: false,
          folder: 'images',
          maxFileSize: 5_000_000,
          cropping: false,
          clientAllowedFormats: ['jpg', 'jpeg', 'png', 'webp'],
          showAdvancedOptions: false,
          showPoweredBy: false,
          styles: { palette: { windowBorder: '#ddd' } },
        },
        (error: Error | null, result: { event?: string; info?: { public_id: string } }) => {
          if (!error && result && result.event === 'success' && result.info) {
            const publicId = result.info.public_id;
            setEditableRestaurant((prev) =>
              prev && editDialogOpen ? { ...prev, menuImgId: publicId } : prev
            );
            setNewRestaurant((prev) =>
              createDialogOpen ? { ...prev, menuImgId: publicId } : prev
            );
          }
        }
      );

      setUploadWidget(widget);
    };

    if (cloudinaryWindow.cloudinary) {
      setup();
      return;
    }

    const interval = setInterval(() => {
      if (cloudinaryWindow.cloudinary) {
        setup();
        clearInterval(interval);
      }
    }, 150);

    const timeout = setTimeout(() => clearInterval(interval), 10_000);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [editDialogOpen, createDialogOpen]);

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

      setSelectedRestaurant(restaurant);
      const nextReservationDate =
        compactToDisplay(restaurant.reservationDate) ||
        dateToDisplay(compactToDate(getNextFriday()));
      setReservationDate(nextReservationDate);

      if (restaurant.reservation && !restaurant.reservation.isReceipt) {
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
      setCurrentTab('menu');
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
      const reservationPath = `food-resv/reservation/${user.uid}/${selectedRestaurant.id}/${reservationKey}`;
      const data: ReservationData = {
        isReceipt: false,
        menus: validMenus.map((menu) => ({
          menu: menu.menu.trim(),
          cost: menu.cost,
        })),
      };
      await set(ref(database, reservationPath), data);
      toast.success('예약 정보를 저장했습니다.');
      handleCloseDetail();
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

    try {
      if (deleteState.target === 'reservation') {
        await remove(ref(database, `food-resv/reservation/${user.uid}/${selectedRestaurant.id}`));
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

  const handleThemeSave = async () => {
    if (!user) return;

    try {
      setSavingTheme(true);
      await set(ref(database, `food-resv/theme/${user.uid}`), { theme: selectedTheme });
      setCurrentTheme(selectedTheme);
      toast.success('테마를 저장했습니다.');
      setThemeDialogOpen(false);
    } catch (error) {
      console.error('Error saving theme', error);
      toast.error('테마 저장 중 오류가 발생했습니다.');
    } finally {
      setSavingTheme(false);
    }
  };

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

  const handleMenuHistorySelect = (item: MenuHistoryItem) => {
    setMenuRows((prev) => {
      if (!prev.length) {
        return [{ id: `menu-${Date.now()}`, menu: item.menu, cost: item.cost }];
      }
      if (prev[0].menu.trim() === '') {
        const [first, ...rest] = prev;
        return [{ ...first, menu: item.menu, cost: item.cost }, ...rest];
      }
      return [...prev, { id: `menu-${Date.now()}`, menu: item.menu, cost: item.cost }];
    });
    setMenuHistoryOpen(false);
    toast.success('메뉴가 추가되었습니다.');
  };

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

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-background text-foreground">
        <header className="sticky top-0 z-30 border-b border-border/40 bg-background/95 backdrop-blur">
          <div className="mx-auto flex w-full max-w-xl items-center justify-between px-4 py-3">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                className="shrink-0"
                onClick={() => window.location.reload()}
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
            onOpenUpload={() => {
              if (uploadWidget) {
                uploadWidget.open();
              } else {
                toast.error('이미지 업로더를 준비 중입니다.');
              }
            }}
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
          onOpenUpload={() => {
            if (uploadWidget) {
              uploadWidget.open();
            } else {
              toast.error('이미지 업로더를 준비 중입니다.');
            }
          }}
        />

        <ThemeDialog
          open={themeDialogOpen}
          selectedTheme={selectedTheme}
          onChange={setSelectedTheme}
          onClose={() => setThemeDialogOpen(false)}
          onSave={handleThemeSave}
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
