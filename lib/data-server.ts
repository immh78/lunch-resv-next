import { getAdminDatabase } from '@/lib/firebase-admin';

export interface ServerReservationData {
  isReceipt: boolean;
  menus: { menu: string; cost: number }[];
}

export interface ServerRestaurant {
  id: string;
  name: string;
  telNo: string;
  kind?: string;
  menuImgId?: string;
  menuUrl?: string;
  naviUrl?: string;
  prepay?: boolean;
}

export interface ServerRestaurantWithReservation extends ServerRestaurant {
  reservationDate?: string;
  reservation?: ServerReservationData;
  prepaymentTotal?: number;
}

export interface MainPageInitialData {
  restaurants: ServerRestaurantWithReservation[];
  allReservations: Record<string, Record<string, ServerReservationData>>;
  hiddenRestaurantIds: string[];
}

export async function getMainPageData(uid: string): Promise<MainPageInitialData | null> {
  try {
    const db = getAdminDatabase();
    const base = 'food-resv';
    const [restaurantSnap, reservationSnap, prepaymentSnap, hideSnap] = await Promise.all([
      db.ref(`${base}/restaurant`).once('value'),
      db.ref(`${base}/reservation/${uid}`).once('value'),
      db.ref(`${base}/prepayment/${uid}`).once('value'),
      db.ref(`${base}/hideRestaurant/${uid}`).once('value'),
    ]);

    const restaurantData: Record<string, ServerRestaurant> = restaurantSnap.val() ?? {};
    const reservationData: Record<string, Record<string, ServerReservationData>> = reservationSnap.val() ?? {};
    const prepaymentData: Record<string, { amount: number; date: string }[]> = prepaymentSnap.val() ?? {};
    const hideData: string[] = hideSnap.val() ?? [];

    if (!restaurantData || Object.keys(restaurantData).length === 0) {
      return { restaurants: [], allReservations: reservationData, hiddenRestaurantIds: hideData };
    }

    const list: ServerRestaurantWithReservation[] = Object.entries(restaurantData).map(([id, entry]) => {
      const reservations = reservationData[id];
      let latestDate: string | undefined;
      let latestReservation: ServerReservationData | undefined;
      if (reservations) {
        const dates = Object.keys(reservations).sort((a, b) => b.localeCompare(a));
        if (dates.length > 0) {
          latestDate = dates[0];
          latestReservation = reservations[latestDate];
        }
      }
      const prepayments = prepaymentData[id] ?? [];
      const prepaymentTotal = prepayments.reduce((sum, item) => sum + (item.amount || 0), 0);
      return {
        id,
        name: entry.name ?? '',
        telNo: entry.telNo ?? '',
        kind: entry.kind,
        menuImgId: entry.menuImgId,
        menuUrl: entry.menuUrl,
        naviUrl: entry.naviUrl,
        prepay: entry.prepay ?? false,
        reservationDate: latestDate,
        reservation: latestReservation,
        prepaymentTotal,
      };
    });

    list.sort((a, b) => {
      if (!a.reservationDate && !b.reservationDate) return 0;
      if (!a.reservationDate) return 1;
      if (!b.reservationDate) return -1;
      return b.reservationDate.localeCompare(a.reservationDate);
    });

    return { restaurants: list, allReservations: reservationData, hiddenRestaurantIds: hideData };
  } catch (e) {
    console.error('getMainPageData error', e);
    return null;
  }
}

/** visit-log 항목 (기존 데이터는 cost 없을 수 있음) */
export type VisitLogEntry = { date: string; menuName: string; cost?: number };

export interface RestMenuPageInitialData {
  restaurants: ServerRestaurant[];
  visitLogs: Record<string, VisitLogEntry[]>;
  allVisitLogs: Record<string, (VisitLogEntry & { key: string })[]>;
  restaurantKinds: Record<string, { icon?: string; name?: string }>;
  restaurantIcons: Record<string, string>;
}

export async function getRestMenuPageData(uid: string): Promise<RestMenuPageInitialData | null> {
  try {
    const db = getAdminDatabase();
    const base = 'food-resv';
    const [restaurantSnap, visitLogSnap, kindsSnap] = await Promise.all([
      db.ref(`${base}/restaurant`).once('value'),
      db.ref(`${base}/visit-log/${uid}`).once('value'),
      db.ref(`${base}/restaurant-kind`).once('value'),
    ]);

    const restaurantData: Record<string, Omit<ServerRestaurant, 'id'>> = restaurantSnap.val() ?? {};
    const restaurants: ServerRestaurant[] = Object.entries(restaurantData).map(([id, r]) => ({
      id,
      name: r.name ?? '',
      telNo: r.telNo ?? '',
      kind: r.kind,
      menuImgId: r.menuImgId,
      menuUrl: r.menuUrl,
      naviUrl: r.naviUrl,
      prepay: r.prepay ?? false,
    }));

    const visitLogRaw = visitLogSnap.val() as Record<string, Record<string, VisitLogEntry>> | null;
    const visitLogs: Record<string, VisitLogEntry[]> = {};
    const allVisitLogs: Record<string, (VisitLogEntry & { key: string })[]> = {};
    if (visitLogRaw) {
      for (const [restaurantId, logs] of Object.entries(visitLogRaw)) {
        if (!logs) continue;
        const withKey = Object.entries(logs).map(([key, log]) => ({ ...log, key }));
        withKey.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
        allVisitLogs[restaurantId] = withKey;
        visitLogs[restaurantId] =
          withKey.length > 0
            ? [
                {
                  date: withKey[0].date,
                  menuName: withKey[0].menuName,
                  ...(typeof withKey[0].cost === 'number' ? { cost: withKey[0].cost } : {}),
                },
              ]
            : [];
      }
    }

    const kindsData = kindsSnap.val() as Record<string, { icon?: string; name?: string }> | null ?? {};
    const restaurantIcons: Record<string, string> = {};
    Object.entries(kindsData).forEach(([kind, data]) => {
      if (data?.icon) restaurantIcons[kind] = data.icon;
    });

    return {
      restaurants,
      visitLogs,
      allVisitLogs,
      restaurantKinds: kindsData,
      restaurantIcons,
    };
  } catch (e) {
    console.error('getRestMenuPageData error', e);
    return null;
  }
}
