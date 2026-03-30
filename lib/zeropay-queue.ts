import dayjs from 'dayjs';

/** mobile-notice / queue|history / zeropay 레코드 */
export interface ZeropayQueueRecord {
  app: string;
  datetime: string;
  message: string;
  title: string;
  uid: string;
}

export interface ZeropayParsedMessage {
  restaurantName: string;
  amount: number;
}

/**
 * 예: "명가충무김밥에서 7,000원 결제 완료되었습니다."
 * 식당명: `에서` 앞, 금액: `에서` 뒤~첫 `원` 앞 (콤마 제거)
 */
export function parseZeropayMessage(message: string): ZeropayParsedMessage | null {
  if (!message || typeof message !== 'string') return null;
  const idx = message.indexOf('에서');
  if (idx <= 0) return null;
  const restaurantName = message.slice(0, idx).trim();
  const afterEseo = message.slice(idx + 2);
  const wonIdx = afterEseo.indexOf('원');
  if (wonIdx < 0) return null;
  const amountRaw = afterEseo.slice(0, wonIdx).trim();
  const digits = amountRaw.replace(/,/g, '').replace(/\s/g, '');
  const amount = Number.parseInt(digits, 10);
  if (!restaurantName || Number.isNaN(amount) || amount < 0) return null;
  return { restaurantName, amount };
}

export interface ZeropayQueueEntryWithKey {
  key: string;
  record: ZeropayQueueRecord;
  parsed: ZeropayParsedMessage;
}

export function collectUserZeropayQueueEntries(
  raw: Record<string, ZeropayQueueRecord> | null | undefined,
  userUid: string
): ZeropayQueueEntryWithKey[] {
  if (!raw || typeof raw !== 'object') return [];
  const out: ZeropayQueueEntryWithKey[] = [];
  for (const [key, record] of Object.entries(raw)) {
    if (!record || record.uid !== userUid) continue;
    const parsed = parseZeropayMessage(record.message ?? '');
    if (!parsed) continue;
    out.push({ key, record, parsed });
  }
  out.sort((a, b) => (b.record.datetime ?? '').localeCompare(a.record.datetime ?? ''));
  return out;
}

export function zeropayDateFromDatetime(datetime: string): string {
  if (datetime && datetime.length >= 8) {
    return datetime.slice(0, 8);
  }
  return '';
}

/** datetime 없음·8자 미만이면 당일(YYYYMMDD) */
export function resolveZeropayDateYmd(datetime: string | undefined | null): string {
  const from = zeropayDateFromDatetime(String(datetime ?? '').trim());
  if (from.length === 8) return from;
  return dayjs().format('YYYYMMDD');
}
