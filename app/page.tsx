'use client';

import { useEffect, useState } from 'react';
import { ref, onValue, set, remove, get } from 'firebase/database';
import { database } from '@/lib/firebase';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useAuth } from '@/contexts/AuthContext';
import {
  Container,
  Typography,
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Link,
  CircularProgress,
  Alert,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Divider,
  Tabs,
  Tab,
} from '@mui/material';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import PhoneIcon from '@mui/icons-material/Phone';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import ShareIcon from '@mui/icons-material/Share';
import ReceiptIcon from '@mui/icons-material/Receipt';
import SaveIcon from '@mui/icons-material/Save';
import DeleteIcon from '@mui/icons-material/Delete';
import CloseIcon from '@mui/icons-material/Close';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import AddIcon from '@mui/icons-material/Add';
import EraserIcon from '@mui/icons-material/CleaningServices';
import TextField from '@mui/material/TextField';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import dayjs, { Dayjs } from 'dayjs';

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#1976d2',
    },
  },
});

interface Restaurant {
  id: string;
  name: string;
  telNo: string;
  kind?: string;
  menuImgId?: string;
  menuUrl?: string;
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

interface PrepaymentItem {
  id: string;
  date: Dayjs | null;
  amount: number;
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

interface ReservationData {
  isReceipt: boolean;
  menus: MenuItem[];
}

interface RestaurantWithReservation extends Restaurant {
  reservationDate?: string;
  reservation?: ReservationData;
}

export default function Home() {
  const { user } = useAuth();
  const [restaurants, setRestaurants] = useState<RestaurantWithReservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedRestaurant, setSelectedRestaurant] = useState<RestaurantWithReservation | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editableMenus, setEditableMenus] = useState<EditableMenuItem[]>([]);
  const [editableDate, setEditableDate] = useState<string>('');
  const [editableDateValue, setEditableDateValue] = useState<Dayjs | null>(null);
  const [saving, setSaving] = useState(false);
  const [tabValue, setTabValue] = useState(0);
  const [prepayments, setPrepayments] = useState<PrepaymentItem[]>([]);
  const [savingPrepayment, setSavingPrepayment] = useState(false);

  useEffect(() => {
    if (!user) return;

    const restaurantsRef = ref(database, 'food-resv/restaurant');
    const reservationRef = ref(database, `food-resv/reservation/${user.uid}`);
    
    let restaurantsData: { [key: string]: Restaurant } = {};
    let reservationData: { [key: string]: { [date: string]: ReservationData } } = {};

    const unsubscribeRestaurants = onValue(
      restaurantsRef,
      (snapshot) => {
        if (snapshot.exists()) {
          restaurantsData = snapshot.val();
          combineData();
        } else {
          setRestaurants([]);
          setError('레스토랑 데이터가 없습니다.');
          setLoading(false);
        }
      },
      (err) => {
        console.error('Error fetching restaurants:', err);
        setError('레스토랑 데이터를 불러오는 중 오류가 발생했습니다.');
        setLoading(false);
      }
    );

    const unsubscribeReservations = onValue(
      reservationRef,
      (snapshot) => {
        if (snapshot.exists()) {
          reservationData = snapshot.val();
        } else {
          reservationData = {};
        }
        combineData();
      },
      (err) => {
        console.error('Error fetching reservations:', err);
        // 예약 데이터가 없어도 계속 진행
        reservationData = {};
        combineData();
      }
    );

    const combineData = () => {
      if (!restaurantsData || Object.keys(restaurantsData).length === 0) {
        return;
      }

      const restaurantList: RestaurantWithReservation[] = Object.keys(restaurantsData).map((restaurantKey) => {
        const restaurant = restaurantsData[restaurantKey];
        
        // 해당 식당의 예약 데이터 찾기
        const restaurantReservations = reservationData[restaurantKey];
        let latestReservation: ReservationData | undefined;
        let latestDate: string | undefined;

        if (restaurantReservations) {
          // 예약일(yyyyMMdd) 중 가장 큰 값 찾기
          const dates = Object.keys(restaurantReservations);
          if (dates.length > 0) {
            dates.sort((a, b) => b.localeCompare(a)); // 내림차순 정렬
            latestDate = dates[0];
            latestReservation = restaurantReservations[latestDate];
          }
        }

        return {
          id: restaurantKey,
          name: restaurant.name,
          telNo: restaurant.telNo,
          kind: restaurant.kind,
          menuImgId: restaurant.menuImgId,
          menuUrl: restaurant.menuUrl,
          reservationDate: latestDate,
          reservation: latestReservation,
        };
      });

      // 정렬: 예약일 내림차순, 예약일 없으면 가장 아래
      restaurantList.sort((a, b) => {
        if (!a.reservationDate && !b.reservationDate) return 0;
        if (!a.reservationDate) return 1; // 예약일 없으면 아래로
        if (!b.reservationDate) return -1; // 예약일 없으면 아래로
        return b.reservationDate.localeCompare(a.reservationDate); // 내림차순
      });

      setRestaurants(restaurantList);
      setError('');
      setLoading(false);
    };

    return () => {
      unsubscribeRestaurants();
      unsubscribeReservations();
    };
  }, [user]);

  // 오늘에서 가장 가까운 다가올 금요일 찾기
  const getNextFriday = (): string => {
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0: 일요일, 5: 금요일
    let daysUntilFriday = 5 - dayOfWeek;
    if (daysUntilFriday <= 0) {
      daysUntilFriday += 7; // 이번 주 금요일이 지났으면 다음 주 금요일
    }
    const nextFriday = new Date(today);
    nextFriday.setDate(today.getDate() + daysUntilFriday);
    
    const year = nextFriday.getFullYear();
    const month = String(nextFriday.getMonth() + 1).padStart(2, '0');
    const day = String(nextFriday.getDate()).padStart(2, '0');
    return `${year}${month}${day}`;
  };

  // yyyyMMdd를 yyyy.MM.dd로 변환
  const formatReservationDate = (dateStr: string): string => {
    if (!dateStr || dateStr.length !== 8) return '';
    const year = dateStr.substring(0, 4);
    const month = dateStr.substring(4, 6);
    const day = dateStr.substring(6, 8);
    return `${year}.${month}.${day}`;
  };

  // yyyy.MM.dd를 yyyyMMdd로 변환
  const parseReservationDate = (dateStr: string): string => {
    return dateStr.replace(/\./g, '');
  };

  // yyyyMMdd를 Dayjs로 변환
  const parseDateToDayjs = (dateStr: string): Dayjs | null => {
    if (!dateStr || dateStr.length !== 8) return null;
    const year = dateStr.substring(0, 4);
    const month = dateStr.substring(4, 6);
    const day = dateStr.substring(6, 8);
    return dayjs(`${year}-${month}-${day}`);
  };

  // Dayjs를 yyyyMMdd로 변환
  const formatDateToYYYYMMDD = (date: Dayjs | null): string => {
    if (!date) return '';
    return date.format('YYYYMMDD');
  };

  // 오늘 날짜를 Dayjs로 반환
  const getToday = (): Dayjs => {
    return dayjs();
  };

  // TabPanel 컴포넌트
  const TabPanel = (props: TabPanelProps) => {
    const { children, value, index, ...other } = props;
    return (
      <div
        role="tabpanel"
        hidden={value !== index}
        id={`simple-tabpanel-${index}`}
        aria-labelledby={`simple-tab-${index}`}
        {...other}
      >
        {value === index && <Box sx={{ py: 2 }}>{children}</Box>}
      </div>
    );
  };

  const handleRestaurantClick = (restaurant: RestaurantWithReservation) => {
    setSelectedRestaurant(restaurant);
    
    // 수령여부가 false인 메뉴만 필터링
    let menus: EditableMenuItem[] = [];
    let reservationDate = '';
    
    if (restaurant.reservation && restaurant.reservation.menus) {
      // isReceipt가 false인 메뉴만 필터링
      const unreceivedMenus = restaurant.reservation.menus.filter(
        () => !restaurant.reservation?.isReceipt
      );
      
      if (unreceivedMenus.length > 0 && restaurant.reservationDate) {
        menus = unreceivedMenus.map((menu, idx) => ({
          id: `menu-${idx}`,
          menu: menu.menu,
          cost: menu.cost,
        }));
        reservationDate = formatReservationDate(restaurant.reservationDate);
      }
    }
    
    // 수령여부가 false인 메뉴가 없으면 빈 행과 금요일 날짜 설정
    if (menus.length === 0) {
      reservationDate = formatReservationDate(getNextFriday());
      menus = [{
        id: `menu-${Date.now()}`,
        menu: '',
        cost: 0,
      }];
    }
    
    setEditableMenus(menus);
    setEditableDate(reservationDate);
    setEditableDateValue(parseDateToDayjs(parseReservationDate(reservationDate)));
    
    // 선결제 데이터 로드
    if (user) {
      loadPrepayments(user.uid, restaurant.id);
    }
    
    setTabValue(0);
    setDialogOpen(true);
  };

  const loadPrepayments = async (uid: string, restaurantKey: string) => {
    try {
      const prepaymentRef = ref(database, `food-resv/prepayment/${uid}/${restaurantKey}`);
      const snapshot = await get(prepaymentRef);

      if (snapshot.exists()) {
        const data = snapshot.val();
        const prepaymentList: PrepaymentItem[] = Array.isArray(data)
          ? data.map((item: { date: string; amount: number }, idx: number) => ({
              id: `prepayment-${idx}`,
              date: parseDateToDayjs(item.date),
              amount: item.amount || 0,
            }))
          : [];
        setPrepayments(prepaymentList.length > 0 ? prepaymentList : [{
          id: `prepayment-${Date.now()}`,
          date: getToday(),
          amount: 0,
        }]);
      } else {
        // 데이터가 없으면 기본 행 추가
        setPrepayments([{
          id: `prepayment-${Date.now()}`,
          date: getToday(),
          amount: 0,
        }]);
      }
    } catch (error) {
      console.error('Error loading prepayments:', error);
      // 에러 시에도 기본 행 추가
      setPrepayments([{
        id: `prepayment-${Date.now()}`,
        date: getToday(),
        amount: 0,
      }]);
    }
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setSelectedRestaurant(null);
    setEditableMenus([]);
    setEditableDate('');
    setEditableDateValue(null);
    setTabValue(0);
    setPrepayments([]);
  };

  const handleDateChange = (newValue: Dayjs | null) => {
    if (newValue) {
      setEditableDateValue(newValue);
      const formattedDate = newValue.format('YYYY.MM.DD');
      setEditableDate(formattedDate);
    } else {
      setEditableDateValue(null);
      setEditableDate('');
    }
  };

  const handleAddRow = () => {
    setEditableMenus([
      ...editableMenus,
      {
        id: `menu-${Date.now()}`,
        menu: '',
        cost: 0,
      },
    ]);
  };

  const handleDeleteRow = (id: string) => {
    if (editableMenus.length === 1) {
      // 마지막 행이면 메뉴와 금액만 초기화
      setEditableMenus([{
        id: editableMenus[0].id,
        menu: '',
        cost: 0,
      }]);
    } else {
      setEditableMenus(editableMenus.filter((menu) => menu.id !== id));
    }
  };

  const handleMenuChange = (id: string, field: 'menu' | 'cost', value: string | number) => {
    setEditableMenus(editableMenus.map((menu) => {
      if (menu.id === id) {
        return { ...menu, [field]: value };
      }
      return menu;
    }));
  };

  const handleSave = async () => {
    if (!user || !selectedRestaurant) return;
    
    // 빈 메뉴 제거
    const validMenus = editableMenus.filter((m) => m.menu.trim() !== '' && m.cost > 0);
    
    if (validMenus.length === 0) {
      alert('메뉴와 금액을 입력해주세요.');
      return;
    }
    
    if (!editableDate || editableDate.length !== 10) {
      alert('예약일을 올바르게 입력해주세요.');
      return;
    }
    
    setSaving(true);
    try {
      const reservationDate = parseReservationDate(editableDate);
      const reservationPath = `food-resv/reservation/${user.uid}/${selectedRestaurant.id}/${reservationDate}`;
      
      const reservationData: ReservationData = {
        isReceipt: false,
        menus: validMenus.map((m) => ({
          menu: m.menu,
          cost: m.cost,
        })),
      };
      
      await set(ref(database, reservationPath), reservationData);
      alert('저장되었습니다.');
      handleCloseDialog();
    } catch (error) {
      console.error('Error saving reservation:', error);
      alert('저장 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!user || !selectedRestaurant) return;
    
    const confirmDelete = window.confirm('예약 정보를 삭제하시겠습니까?');
    if (!confirmDelete) return;
    
    try {
      const reservationPath = `food-resv/reservation/${user.uid}/${selectedRestaurant.id}`;
      await remove(ref(database, reservationPath));
      alert('삭제되었습니다.');
      handleCloseDialog();
    } catch (error) {
      console.error('Error deleting reservation:', error);
      alert('삭제 중 오류가 발생했습니다.');
    }
  };

  // 선결제 관련 함수들
  const handleAddPrepaymentRow = () => {
    setPrepayments([
      ...prepayments,
      {
        id: `prepayment-${Date.now()}`,
        date: getToday(),
        amount: 0,
      },
    ]);
  };

  const handleDeletePrepaymentRow = (id: string) => {
    if (prepayments.length === 1) {
      // 마지막 행이면 날짜는 오늘, 금액은 빈값으로
      setPrepayments([{
        id: prepayments[0].id,
        date: getToday(),
        amount: 0,
      }]);
    } else {
      setPrepayments(prepayments.filter((item) => item.id !== id));
    }
  };

  const handlePrepaymentChange = (id: string, field: 'date' | 'amount', value: Dayjs | null | number | string) => {
    setPrepayments(prepayments.map((item) => {
      if (item.id === id) {
        if (field === 'amount') {
          // 금액은 문자열로 받아서 저장 (입력 중에는 문자열 유지)
          const numValue = value === '' || value === null ? 0 : (typeof value === 'string' ? parseFloat(value) || 0 : (typeof value === 'number' ? value : 0));
          return { ...item, amount: numValue };
        } else {
          // date 필드
          return { ...item, date: value as Dayjs | null };
        }
      }
      return item;
    }));
  };

  const handleSavePrepayment = async () => {
    if (!user || !selectedRestaurant) return;
    
    // 유효한 데이터만 필터링 (날짜와 금액이 모두 있는 것만)
    const validPrepayments = prepayments.filter((p) => p.date && p.amount > 0);
    
    if (validPrepayments.length === 0) {
      alert('선결제 데이터를 입력해주세요.');
      return;
    }
    
    setSavingPrepayment(true);
    try {
      const prepaymentPath = `food-resv/prepayment/${user.uid}/${selectedRestaurant.id}`;
      const prepaymentData = validPrepayments.map((p) => ({
        date: formatDateToYYYYMMDD(p.date),
        amount: p.amount,
      }));
      
      await set(ref(database, prepaymentPath), prepaymentData);
      alert('저장되었습니다.');
    } catch (error) {
      console.error('Error saving prepayment:', error);
      alert('저장 중 오류가 발생했습니다.');
    } finally {
      setSavingPrepayment(false);
    }
  };

  const handleDeletePrepayment = async () => {
    if (!user || !selectedRestaurant) return;
    
    const confirmDelete = window.confirm('선결제 정보를 삭제하시겠습니까?');
    if (!confirmDelete) return;
    
    try {
      const prepaymentPath = `food-resv/prepayment/${user.uid}/${selectedRestaurant.id}`;
      await remove(ref(database, prepaymentPath));
      alert('삭제되었습니다.');
      // 기본 행 추가
      setPrepayments([{
        id: `prepayment-${Date.now()}`,
        date: getToday(),
        amount: 0,
      }]);
    } catch (error) {
      console.error('Error deleting prepayment:', error);
      alert('삭제 중 오류가 발생했습니다.');
    }
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <ProtectedRoute>
        <Container maxWidth="sm" sx={{ py: 4 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
            <Typography variant="h4" component="h1">
              포장 예약
            </Typography>
            <IconButton>
              <MoreVertIcon />
            </IconButton>
          </Box>

          {loading ? (
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                minHeight: '50vh',
              }}
            >
              <CircularProgress />
            </Box>
          ) : error ? (
            <Alert severity="error" sx={{ mt: 2 }}>
              {error}
            </Alert>
          ) : (
            <Box sx={{ mt: 3 }}>
              {restaurants.length === 0 ? (
                <Typography variant="body1" align="center" sx={{ mt: 4 }}>
                  등록된 레스토랑이 없습니다.
                </Typography>
              ) : (
                <TableContainer component={Paper}>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>식당</TableCell>
                        <TableCell>예약메뉴</TableCell>
                        <TableCell>전화</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {restaurants.map((restaurant, index) => {
                        // 예약 메뉴 문자열 생성
                        let menuText = '';
                        if (restaurant.reservation && restaurant.reservation.menus) {
                          menuText = restaurant.reservation.menus
                            .map((m) => m.menu)
                            .join(' + ');
                        }

                        return (
                          <TableRow
                            key={restaurant.id}
                            onClick={() => handleRestaurantClick(restaurant)}
                            sx={{
                              backgroundColor: index % 2 === 0 ? 'background.paper' : 'action.hover',
                              cursor: 'pointer',
                              '&:hover': {
                                backgroundColor: 'action.selected',
                              },
                            }}
                          >
                            <TableCell>{restaurant.name}</TableCell>
                            <TableCell>
                              {menuText && (
                                <Typography
                                  variant="body2"
                                  sx={{
                                    color: restaurant.reservation?.isReceipt ? 'text.secondary' : 'text.primary',
                                  }}
                                >
                                  {menuText}
                                </Typography>
                              )}
                            </TableCell>
                            <TableCell>
                              <Link
                                href={`tel:${restaurant.telNo}`}
                                sx={{ textDecoration: 'none', display: 'flex', alignItems: 'center' }}
                              >
                                <PhoneIcon color="primary" />
                              </Link>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </Box>
          )}

          {/* 식당 상세 팝업 */}
          <Dialog
            open={dialogOpen}
            onClose={handleCloseDialog}
            maxWidth="sm"
            fullWidth
            PaperProps={{
              sx: {
                borderRadius: 2,
                m: { xs: 1, sm: 2 },
                maxHeight: { xs: '90vh', sm: '80vh' },
                display: 'flex',
                flexDirection: 'column',
              },
            }}
          >
            {selectedRestaurant && (
              <>
                <DialogTitle sx={{ pb: { xs: 1, sm: 2 }, pt: { xs: 2, sm: 3 } }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
                    <Typography variant="h6" sx={{ fontSize: { xs: '1rem', sm: '1.25rem' }, wordBreak: 'break-word' }}>
                      {selectedRestaurant.name}
                    </Typography>
                    {(selectedRestaurant.menuImgId || selectedRestaurant.menuUrl) && (
                      <IconButton
                        size="small"
                        onClick={() => {
                          if (selectedRestaurant.menuUrl) {
                            window.open(selectedRestaurant.menuUrl, '_blank');
                          }
                        }}
                        sx={{ flexShrink: 0 }}
                      >
                        <MenuBookIcon fontSize="small" />
                      </IconButton>
                    )}
                  </Box>
                </DialogTitle>
                <DialogContent 
                  sx={{ 
                    px: { xs: 0, sm: 0 }, 
                    py: { xs: 0, sm: 0 },
                    overflow: 'hidden',
                    flex: 1,
                    minHeight: 0,
                    display: 'flex',
                    flexDirection: 'column',
                  }}
                >
                  <Box sx={{ borderBottom: 1, borderColor: 'divider', px: { xs: 2, sm: 3 } }}>
                    <Tabs 
                      value={tabValue} 
                      onChange={(e, newValue) => setTabValue(newValue)}
                      sx={{ minHeight: { xs: 36, sm: 48 } }}
                    >
                      <Tab label="메뉴" sx={{ fontSize: { xs: '0.875rem', sm: '1rem' }, minHeight: { xs: 36, sm: 48 } }} />
                      <Tab label="선결제" sx={{ fontSize: { xs: '0.875rem', sm: '1rem' }, minHeight: { xs: 36, sm: 48 } }} />
                    </Tabs>
                  </Box>
                  
                  <Box sx={{ flex: 1, overflow: 'auto', px: { xs: 2, sm: 3 }, py: { xs: 1, sm: 2 } }}>
                    <TabPanel value={tabValue} index={0}>
                      <Box sx={{ mb: { xs: 1.5, sm: 2 } }}>
                        <DatePicker
                          label="예약일"
                          value={editableDateValue}
                          onChange={handleDateChange}
                          format="YYYY.MM.DD"
                          slotProps={{
                            textField: {
                              size: 'small',
                              fullWidth: true,
                              sx: {
                                mb: { xs: 1.5, sm: 2 },
                                '& .MuiInputBase-input': {
                                  fontSize: { xs: '0.875rem', sm: '1rem' }
                                },
                                '& .MuiInputLabel-root': {
                                  fontSize: { xs: '0.875rem', sm: '1rem' }
                                }
                              }
                            }
                          }}
                        />
                        <TableContainer sx={{ maxHeight: { xs: '40vh', sm: '50vh' }, overflow: 'auto' }}>
                          <Table size="small" sx={{ '& .MuiTableCell-root': { fontSize: { xs: '0.75rem', sm: '0.875rem' }, py: { xs: 0.5, sm: 1 } } }}>
                            <TableHead>
                              <TableRow>
                                <TableCell sx={{ fontWeight: 'bold', px: { xs: 1, sm: 2 } }}>메뉴</TableCell>
                                <TableCell align="right" sx={{ fontWeight: 'bold', px: { xs: 1, sm: 2 } }}>가격</TableCell>
                                <TableCell width={40} sx={{ px: { xs: 0.5, sm: 1 } }}></TableCell>
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {editableMenus.map((menuItem) => (
                                <TableRow key={menuItem.id}>
                                  <TableCell sx={{ px: { xs: 1, sm: 2 } }}>
                                    <TextField
                                      value={menuItem.menu}
                                      onChange={(e) => handleMenuChange(menuItem.id, 'menu', e.target.value)}
                                      placeholder="메뉴명"
                                      size="small"
                                      fullWidth
                                      InputProps={{
                                        sx: { fontSize: { xs: '0.75rem', sm: '0.875rem' } }
                                      }}
                                    />
                                  </TableCell>
                                  <TableCell align="right" sx={{ px: { xs: 1, sm: 2 } }}>
                                    <TextField
                                      type="number"
                                      value={menuItem.cost || ''}
                                      onChange={(e) => handleMenuChange(menuItem.id, 'cost', parseInt(e.target.value) || 0)}
                                      placeholder="금액"
                                      size="small"
                                      inputProps={{ min: 0 }}
                                      sx={{ width: { xs: 100, sm: 120 } }}
                                      InputProps={{
                                        sx: { fontSize: { xs: '0.75rem', sm: '0.875rem' } }
                                      }}
                                    />
                                  </TableCell>
                                  <TableCell sx={{ px: { xs: 0.5, sm: 1 } }}>
                                    <IconButton
                                      size="small"
                                      onClick={() => handleDeleteRow(menuItem.id)}
                                      aria-label="삭제"
                                      sx={{ p: { xs: 0.5, sm: 1 } }}
                                    >
                                      <EraserIcon fontSize="small" />
                                    </IconButton>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </TableContainer>
                      </Box>
                    </TabPanel>
                    
                    <TabPanel value={tabValue} index={1}>
                      <TableContainer sx={{ maxHeight: { xs: '40vh', sm: '50vh' }, overflow: 'auto' }}>
                        <Table size="small" sx={{ '& .MuiTableCell-root': { fontSize: { xs: '0.75rem', sm: '0.875rem' }, py: { xs: 0.5, sm: 1 } }, tableLayout: 'fixed', width: '100%' }}>
                          <TableHead>
                            <TableRow>
                              <TableCell sx={{ fontWeight: 'bold', px: { xs: 0.5, sm: 0.75 }, width: { xs: '48%', sm: '42%' } }}>날짜</TableCell>
                              <TableCell align="right" sx={{ fontWeight: 'bold', px: { xs: 0.5, sm: 0.75 }, width: { xs: '37%', sm: '43%' } }}>금액</TableCell>
                              <TableCell sx={{ px: { xs: 0.25, sm: 0.5 }, width: { xs: '15%', sm: '15%' } }}></TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {prepayments.map((prepayment) => (
                              <TableRow key={prepayment.id}>
                                <TableCell sx={{ px: { xs: 0.5, sm: 0.75 }, verticalAlign: 'middle' }}>
                                  <DatePicker
                                    value={prepayment.date}
                                    onChange={(newValue) => handlePrepaymentChange(prepayment.id, 'date', newValue)}
                                    format="YYYY.MM.DD"
                                    slotProps={{
                                      textField: {
                                        size: 'small',
                                        fullWidth: false,
                                        sx: {
                                          width: { xs: '100%', sm: '100%' },
                                          maxWidth: { xs: 135, sm: 155 },
                                          '& .MuiInputBase-root': {
                                            paddingRight: { xs: '28px', sm: '36px' }
                                          },
                                          '& .MuiInputBase-input': {
                                            fontSize: { xs: '0.75rem', sm: '0.875rem' },
                                            padding: { xs: '8px 8px 8px 10px', sm: '10px 10px 10px 12px' },
                                            width: '100%'
                                          }
                                        },
                                        InputProps: {
                                          sx: { fontSize: { xs: '0.75rem', sm: '0.875rem' } }
                                        }
                                      }
                                    }}
                                  />
                                </TableCell>
                                <TableCell align="right" sx={{ px: { xs: 0.5, sm: 0.75 }, verticalAlign: 'middle' }}>
                                  <TextField
                                    type="number"
                                    value={prepayment.amount === 0 ? '' : prepayment.amount}
                                    onChange={(e) => handlePrepaymentChange(prepayment.id, 'amount', e.target.value)}
                                    placeholder="금액"
                                    size="small"
                                    inputProps={{ min: 0 }}
                                    sx={{ width: { xs: 95, sm: 115 } }}
                                    InputProps={{
                                      sx: { fontSize: { xs: '0.75rem', sm: '0.875rem' } }
                                    }}
                                  />
                                </TableCell>
                                <TableCell sx={{ px: { xs: 0.25, sm: 0.5 }, verticalAlign: 'middle' }}>
                                  <IconButton
                                    size="small"
                                    onClick={() => handleDeletePrepaymentRow(prepayment.id)}
                                    aria-label="삭제"
                                    sx={{ p: { xs: 0.25, sm: 0.5 } }}
                                  >
                                    <EraserIcon fontSize="small" />
                                  </IconButton>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </TableContainer>
                    </TabPanel>
                  </Box>
                </DialogContent>
                <Divider />
                <DialogActions 
                  sx={{ 
                    justifyContent: 'center', 
                    gap: { xs: 0.5, sm: 1 }, 
                    p: { xs: 1, sm: 2 },
                    flexWrap: 'wrap',
                    '& .MuiIconButton-root': {
                      fontSize: { xs: '1.25rem', sm: '1.5rem' },
                      p: { xs: 0.75, sm: 1 },
                    }
                  }}
                >
                  <IconButton color="primary" aria-label="공유" size="small">
                    <ShareIcon fontSize="small" />
                  </IconButton>
                  <IconButton color="primary" aria-label="수령" size="small">
                    <ReceiptIcon fontSize="small" />
                  </IconButton>
                  {tabValue === 0 ? (
                    <IconButton 
                      color="primary" 
                      aria-label="저장" 
                      onClick={handleSave}
                      disabled={saving}
                      size="small"
                    >
                      <SaveIcon fontSize="small" />
                    </IconButton>
                  ) : null}
                  {tabValue === 0 ? (
                    <>
                      <IconButton 
                        color="primary" 
                        aria-label="추가"
                        onClick={handleAddRow}
                        size="small"
                      >
                        <AddIcon fontSize="small" />
                      </IconButton>
                      <IconButton 
                        color="error" 
                        aria-label="삭제"
                        onClick={handleDelete}
                        size="small"
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </>
                  ) : (
                    <>
                      <IconButton 
                        color="primary" 
                        aria-label="추가"
                        onClick={handleAddPrepaymentRow}
                        size="small"
                      >
                        <AddIcon fontSize="small" />
                      </IconButton>
                      <IconButton 
                        color="primary" 
                        aria-label="저장" 
                        onClick={handleSavePrepayment}
                        disabled={savingPrepayment}
                        size="small"
                      >
                        <SaveIcon fontSize="small" />
                      </IconButton>
                      <IconButton 
                        color="error" 
                        aria-label="삭제"
                        onClick={handleDeletePrepayment}
                        size="small"
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </>
                  )}
                  <IconButton onClick={handleCloseDialog} aria-label="닫기" size="small">
                    <CloseIcon fontSize="small" />
                  </IconButton>
                </DialogActions>
              </>
            )}
          </Dialog>
        </Container>
      </ProtectedRoute>
    </ThemeProvider>
    </LocalizationProvider>
  );
}
