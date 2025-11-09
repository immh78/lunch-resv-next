'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

import { cn } from '@/lib/utils';
import { buttonVariants } from '@/components/ui/button';

const DEFAULT_WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];

type CalendarProps = {
  selected?: Date | null;
  onSelect?: (date: Date) => void;
  defaultMonth?: Date;
  className?: string;
  weekStartsOn?: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  showOutsideDays?: boolean;
  minDate?: Date;
  maxDate?: Date;
  disabled?: (date: Date) => boolean;
  locale?: string;
};

type CalendarCell = {
  date: Date;
  inCurrentMonth: boolean;
};

const normalizeDate = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate());

const isSameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

const rotateWeekdays = (weekStartsOn: number) => {
  const normalized = ((weekStartsOn % 7) + 7) % 7;
  return [
    ...DEFAULT_WEEKDAY_LABELS.slice(normalized),
    ...DEFAULT_WEEKDAY_LABELS.slice(0, normalized),
  ];
};

const createCalendarMatrix = (month: Date, weekStartsOn: number): CalendarCell[][] => {
  const matrix: CalendarCell[][] = [];
  const firstOfMonth = new Date(month.getFullYear(), month.getMonth(), 1);
  const offset = (firstOfMonth.getDay() - weekStartsOn + 7) % 7;

  const cursor = new Date(firstOfMonth);
  cursor.setDate(cursor.getDate() - offset);

  for (let week = 0; week < 6; week += 1) {
    const days: CalendarCell[] = [];
    for (let day = 0; day < 7; day += 1) {
      days.push({
        date: new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate()),
        inCurrentMonth: cursor.getMonth() === month.getMonth(),
      });
      cursor.setDate(cursor.getDate() + 1);
    }
    matrix.push(days);
  }

  return matrix;
};

const getMonthLabel = (date: Date, locale: string) =>
  new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'long' }).format(date);

const Calendar: React.FC<CalendarProps> = ({
  selected,
  onSelect,
  defaultMonth,
  className,
  weekStartsOn = 0,
  showOutsideDays = true,
  minDate,
  maxDate,
  disabled,
  locale = 'ko-KR',
}) => {
  const normalizedSelected = selected ? normalizeDate(selected) : null;
  const normalizedSelectedYear = normalizedSelected?.getFullYear() ?? null;
  const normalizedSelectedMonth = normalizedSelected?.getMonth() ?? null;
  const normalizedMin = minDate ? normalizeDate(minDate) : null;
  const normalizedMax = maxDate ? normalizeDate(maxDate) : null;

  const [currentMonth, setCurrentMonth] = useState<Date>(() => {
    const base =
      normalizedSelected ??
      (defaultMonth ? normalizeDate(defaultMonth) : normalizeDate(new Date()));
    return new Date(base.getFullYear(), base.getMonth(), 1);
  });

  const selectedMonthKey =
    normalizedSelectedYear !== null && normalizedSelectedMonth !== null
      ? normalizedSelectedYear * 12 + normalizedSelectedMonth
      : null;

  const defaultMonthYear = defaultMonth?.getFullYear() ?? null;
  const defaultMonthMonth = defaultMonth?.getMonth() ?? null;
  const defaultMonthKey =
    defaultMonthYear !== null && defaultMonthMonth !== null
      ? defaultMonthYear * 12 + defaultMonthMonth
      : null;

  useEffect(() => {
    if (selectedMonthKey === null || !normalizedSelected) return;
    setCurrentMonth((prev) => {
      if (
        prev.getFullYear() === normalizedSelected.getFullYear() &&
        prev.getMonth() === normalizedSelected.getMonth()
      ) {
        return prev;
      }
      return new Date(
        normalizedSelected.getFullYear(),
        normalizedSelected.getMonth(),
        1
      );
    });
  }, [selectedMonthKey]);

  useEffect(() => {
    if (defaultMonthKey === null || !defaultMonth) return;
    setCurrentMonth((prev) => {
      if (
        prev.getFullYear() === defaultMonth.getFullYear() &&
        prev.getMonth() === defaultMonth.getMonth()
      ) {
        return prev;
      }
      return new Date(defaultMonth.getFullYear(), defaultMonth.getMonth(), 1);
    });
  }, [defaultMonthKey]);

  const today = useMemo(() => normalizeDate(new Date()), []);
  const weekdayLabels = useMemo(() => rotateWeekdays(weekStartsOn), [weekStartsOn]);
  const monthMatrix = useMemo(
    () => createCalendarMatrix(currentMonth, weekStartsOn),
    [currentMonth, weekStartsOn]
  );

  const isDayDisabled = (date: Date) => {
    const normalized = normalizeDate(date);
    if (normalizedMin && normalized.getTime() < normalizedMin.getTime()) {
      return true;
    }
    if (normalizedMax && normalized.getTime() > normalizedMax.getTime()) {
      return true;
    }
    if (disabled && disabled(normalized)) {
      return true;
    }
    return false;
  };

  const handleSelect = (date: Date) => {
    if (isDayDisabled(date)) return;
    onSelect?.(normalizeDate(date));
  };

  const goToPreviousMonth = () => {
    setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  return (
    <div className={cn('w-full rounded-md border border-border bg-background p-3', className)}>
      <div className="mb-3 flex items-center justify-between">
        <button
          type="button"
          onClick={goToPreviousMonth}
          className={cn(
            buttonVariants({ variant: 'ghost', size: 'icon' }),
            'h-8 w-8 p-0 text-muted-foreground hover:text-foreground'
          )}
          aria-label="이전 달"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-sm font-semibold">{getMonthLabel(currentMonth, locale)}</span>
        <button
          type="button"
          onClick={goToNextMonth}
          className={cn(
            buttonVariants({ variant: 'ghost', size: 'icon' }),
            'h-8 w-8 p-0 text-muted-foreground hover:text-foreground'
          )}
          aria-label="다음 달"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="mb-1 grid grid-cols-7 gap-1">
        {weekdayLabels.map((label) => (
          <div
            key={label}
            className="flex h-8 items-center justify-center text-xs font-medium text-muted-foreground"
          >
            {label}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {monthMatrix.map((week, weekIndex) =>
          week.map((cell, dayIndex) => {
            const key = `${weekIndex}-${dayIndex}-${cell.date.getFullYear()}-${cell.date.getMonth()}-${cell.date.getDate()}`;
              if (!cell.inCurrentMonth && !showOutsideDays) {
                return (
                  <div
                    key={key}
                    className="flex h-9 w-9 items-center justify-center rounded-md text-sm text-muted-foreground opacity-40"
                    aria-hidden="true"
                  >
                    &nbsp;
                  </div>
                );
              }

            const disabledDay = isDayDisabled(cell.date);
            const isSelected =
              normalizedSelected && isSameDay(cell.date, normalizedSelected);
            const isToday = isSameDay(cell.date, today);

            return (
              <button
                key={key}
                type="button"
                onClick={() => handleSelect(cell.date)}
                disabled={disabledDay}
                className={cn(
                  'flex h-9 w-9 items-center justify-center rounded-md text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                  'hover:bg-accent hover:text-accent-foreground',
                  isSelected &&
                    'bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground',
                  isToday && !isSelected && 'border border-primary/60 text-primary',
                  !cell.inCurrentMonth && 'text-muted-foreground opacity-70',
                  disabledDay && 'pointer-events-none text-muted-foreground opacity-40'
                )}
              >
                {cell.date.getDate()}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
};

Calendar.displayName = 'Calendar';

export { Calendar };
