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
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Divider,
  Tabs,
  Tab,
  AppBar,
  Toolbar,
  Button,
  Menu,
  MenuItem,
  InputAdornment,
  Snackbar,
  Alert,
} from '@mui/material';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import PhoneIcon from '@mui/icons-material/Phone';
import NavigationIcon from '@mui/icons-material/Navigation';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import ShareIcon from '@mui/icons-material/Share';
import ReceiptIcon from '@mui/icons-material/Receipt';
import SaveIcon from '@mui/icons-material/Save';
import DeleteIcon from '@mui/icons-material/Delete';
import ExitToAppIcon from '@mui/icons-material/ExitToApp';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import AddCircleIcon from '@mui/icons-material/AddCircle';
import ClearIcon from '@mui/icons-material/Clear';
import EditIcon from '@mui/icons-material/Edit';
import CameraAltIcon from '@mui/icons-material/CameraAlt';
import RestaurantIcon from '@mui/icons-material/Restaurant';
import LunchDiningIcon from '@mui/icons-material/LunchDining';
import RamenDiningIcon from '@mui/icons-material/RamenDining';
import LocalDiningIcon from '@mui/icons-material/LocalDining';
import SetMealIcon from '@mui/icons-material/SetMeal';
import GroupsIcon from '@mui/icons-material/Groups';
import CoffeeIcon from '@mui/icons-material/Coffee';
import BakeryDiningIcon from '@mui/icons-material/BakeryDining';
import HistoryIcon from '@mui/icons-material/History';
import TextField from '@mui/material/TextField';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import dayjs, { Dayjs } from 'dayjs';

const theme = createTheme({
  typography: {
    fontFamily: 'var(--font-inter), -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    fontSize: 14,
    fontWeightRegular: 400,
    fontWeightMedium: 500,
    fontWeightBold: 600,
  },
  palette: {
    mode: 'light',
    primary: {
      main: '#000000',
      contrastText: '#ffffff',
    },
    background: {
      default: '#ffffff',
      paper: '#ffffff',
    },
    text: {
      primary: '#0a0a0a',
      secondary: '#666666',
    },
    divider: '#e5e5e5',
    action: {
      hover: '#f5f5f5',
      selected: '#000000',
    },
  },
  shape: {
    borderRadius: 2,
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 500,
          borderRadius: 2,
          padding: '6px 12px',
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          borderColor: '#e5e5e5',
          fontSize: 14,
          padding: '12px 16px',
        },
        head: {
          fontWeight: 600,
          fontSize: 13,
          color: '#666666',
          backgroundColor: '#fafafa',
        },
      },
    },
    MuiTableRow: {
      styleOverrides: {
        root: {
          '&:hover': {
            backgroundColor: '#fafafa',
          },
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: 12,
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.08)',
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: 2,
            fontSize: 14,
          },
        },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          borderRadius: 2,
        },
      },
    },
  },
});

// Cloudinary 타입 정의
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
  date: string; // yyyyMMdd
}

interface EditablePrepaymentItem {
  id: string;
  amount: number;
  date: string; // yyyyMMdd
  dateValue: Dayjs | null;
}

interface RestaurantWithReservation extends Restaurant {
  reservationDate?: string;
  reservation?: ReservationData;
  prepaymentTotal?: number;
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
  const [currentTab, setCurrentTab] = useState(0);
  const [prepayments, setPrepayments] = useState<EditablePrepaymentItem[]>([]);
  const [savingPrepayment, setSavingPrepayment] = useState(false);
  const [menuAnchorEl, setMenuAnchorEl] = useState<null | HTMLElement>(null);
  const [restaurantEditDialogOpen, setRestaurantEditDialogOpen] = useState(false);
  const [restaurantAddDialogOpen, setRestaurantAddDialogOpen] = useState(false);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [deleteConfirmDialogOpen, setDeleteConfirmDialogOpen] = useState(false);
  const [deleteType, setDeleteType] = useState<'reservation' | 'prepayment' | null>(null);
  const [menuHistoryDialogOpen, setMenuHistoryDialogOpen] = useState(false);
  const [menuHistoryList, setMenuHistoryList] = useState<{ menu: string; cost: number }[]>([]);
  const [editableRestaurant, setEditableRestaurant] = useState<Restaurant | null>(null);
  const [newRestaurant, setNewRestaurant] = useState<Omit<Restaurant, 'id'> & { id: string }>({
    id: '',
    name: '',
    telNo: '',
    kind: '',
    menuImgId: '',
    menuUrl: '',
    naviUrl: '',
  });
  const [uploadWidget, setUploadWidget] = useState<CloudinaryUploadWidget | null>(null);

  // Cloudinary widget 초기화
  useEffect(() => {
    const initCloudinaryWidget = () => {
      if (typeof window !== 'undefined') {
        const cloudinaryWindow = window as unknown as CloudinaryWindow;
        if (cloudinaryWindow.cloudinary) {
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
              styles: { palette: { windowBorder: '#ddd' } }
            },
            (error: Error | null, result: { event?: string; info?: { public_id: string } }) => {
              if (!error && result && result.event === 'success' && result.info) {
                const publicId = result.info.public_id;
                
                // 현재 열려있는 다이얼로그에 따라 menuImgId 업데이트
                // 함수형 업데이트를 사용하여 최신 상태를 보장
                setEditableRestaurant(prev => {
                  if (prev && restaurantEditDialogOpen) {
                    return { ...prev, menuImgId: publicId };
                  }
                  return prev;
                });
                
                setNewRestaurant(prev => {
                  if (restaurantAddDialogOpen) {
                    return { ...prev, menuImgId: publicId };
                  }
                  return prev;
                });
              } else if (result && result.event === 'close') {
                // 닫기 시 아무것도 하지 않음
              } else if (error) {
                console.error('Cloudinary upload error:', error);
              }
            }
          );
          
          setUploadWidget(widget);
        }
      }
    };

    // Cloudinary 스크립트가 로드되었는지 확인
    if (typeof window !== 'undefined') {
      const cloudinaryWindow = window as unknown as CloudinaryWindow;
      if (cloudinaryWindow.cloudinary) {
        initCloudinaryWidget();
      } else {
        // 스크립트 로드를 기다림
        const checkCloudinary = setInterval(() => {
          if (cloudinaryWindow.cloudinary) {
            initCloudinaryWidget();
            clearInterval(checkCloudinary);
          }
        }, 100);

        // 10초 후 타임아웃
        setTimeout(() => {
          clearInterval(checkCloudinary);
        }, 10000);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurantEditDialogOpen, restaurantAddDialogOpen]);

  useEffect(() => {
    if (!user) return;

    const restaurantsRef = ref(database, 'food-resv/restaurant');
    const reservationRef = ref(database, `food-resv/reservation/${user.uid}`);
    const prepaymentRef = ref(database, `food-resv/prepayment/${user.uid}`);
    
    let restaurantsData: { [key: string]: Restaurant } = {};
    let reservationData: { [key: string]: { [date: string]: ReservationData } } = {};
    let prepaymentData: { [key: string]: PrepaymentItem[] } = {};

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

    const unsubscribePrepayments = onValue(
      prepaymentRef,
      (snapshot) => {
        if (snapshot.exists()) {
          prepaymentData = snapshot.val();
        } else {
          prepaymentData = {};
        }
        combineData();
      },
      (err) => {
        console.error('Error fetching prepayments:', err);
        // 선결제 데이터가 없어도 계속 진행
        prepaymentData = {};
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

        // 선결제 총합 계산
        let prepaymentTotal = 0;
        if (prepaymentData[restaurantKey]) {
          prepaymentTotal = prepaymentData[restaurantKey].reduce((sum, item) => sum + (item.amount || 0), 0);
        }

        return {
          id: restaurantKey,
          name: restaurant.name,
          telNo: restaurant.telNo,
          kind: restaurant.kind,
          menuImgId: restaurant.menuImgId,
          menuUrl: restaurant.menuUrl,
          naviUrl: restaurant.naviUrl,
          reservationDate: latestDate,
          reservation: latestReservation,
          prepaymentTotal,
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
      unsubscribePrepayments();
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

  // yyyyMMdd를 한국어 형식으로 변환 (예: 1.15 (월)) - 현재 사용되지 않음
  // const formatKoreanDate = (dateStr: string): string => {
  //   if (!dateStr || dateStr.length !== 8) return '';
  //   
  //   const year = parseInt(dateStr.substring(0, 4), 10);
  //   const month = parseInt(dateStr.substring(4, 6), 10) - 1; // JS는 0부터 시작
  //   const day = parseInt(dateStr.substring(6, 8), 10);
  //   
  //   const date = new Date(year, month, day);
  //   if (isNaN(date.getTime())) return '잘못된 날짜';
  //   
  //   const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
  //   const weekday = dayNames[date.getDay()];
  //   
  //   return `${month + 1}.${day} (${weekday})`;
  // };

  // yyyyMMdd를 공유용 날짜 형식으로 변환 (예: 11.5(수))
  const formatShareDate = (dateStr: string): string => {
    if (!dateStr || dateStr.length !== 8) return '';
    
    const year = parseInt(dateStr.substring(0, 4), 10);
    const month = parseInt(dateStr.substring(4, 6), 10) - 1; // JS는 0부터 시작
    const day = parseInt(dateStr.substring(6, 8), 10);
    
    const date = new Date(year, month, day);
    if (isNaN(date.getTime())) return '';
    
    const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
    const weekday = dayNames[date.getDay()];
    
    return `${month + 1}.${day}(${weekday})`;
  };

  // yyyy.MM.dd를 공유용 예약일 형식으로 변환 (예: 11.7 (금))
  const formatShareReservationDate = (dateStr: string): string => {
    if (!dateStr || dateStr.length !== 10) return '';
    
    // yyyy.MM.dd 형식을 파싱
    const parts = dateStr.split('.');
    if (parts.length !== 3) return '';
    
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1; // JS는 0부터 시작
    const day = parseInt(parts[2], 10);
    
    const date = new Date(year, month, day);
    if (isNaN(date.getTime())) return '';
    
    const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
    const weekday = dayNames[date.getDay()];
    
    return `${month + 1}.${day} (${weekday})`;
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

  const handleRestaurantClick = async (restaurant: RestaurantWithReservation) => {
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
      await loadPrepayments(user.uid, restaurant.id);
    }
    
    setCurrentTab(0);
    setDialogOpen(true);
  };
  
  const loadPrepayments = async (userId: string, restaurantId: string) => {
    try {
      const prepaymentRef = ref(database, `food-resv/prepayment/${userId}/${restaurantId}`);
      const snapshot = await get(prepaymentRef);
      
      if (snapshot.exists()) {
        const data: PrepaymentItem[] = snapshot.val();
        const today = dayjs().format('YYYYMMDD');
        const prepaymentItems: EditablePrepaymentItem[] = data.map((item, idx) => ({
          id: `prepayment-${idx}`,
          amount: item.amount || 0,
          date: item.date || today,
          dateValue: parseDateToDayjs(item.date || today),
        }));
        setPrepayments(prepaymentItems);
      } else {
        // 선결제 데이터가 없으면 기본 행 하나 추가
        const today = dayjs().format('YYYYMMDD');
        setPrepayments([{
          id: `prepayment-${Date.now()}`,
          amount: 0,
          date: today,
          dateValue: dayjs(),
        }]);
      }
    } catch (error) {
      console.error('Error loading prepayments:', error);
      // 에러 발생 시 기본 행 하나 추가
      const today = dayjs().format('YYYYMMDD');
      setPrepayments([{
        id: `prepayment-${Date.now()}`,
        amount: 0,
        date: today,
        dateValue: dayjs(),
      }]);
    }
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setSelectedRestaurant(null);
    setEditableMenus([]);
    setEditableDate('');
    setEditableDateValue(null);
    setPrepayments([]);
    setCurrentTab(0);
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
      setSnackbarMessage('저장되었습니다.');
      setSnackbarOpen(true);
      handleCloseDialog();
    } catch (error) {
      console.error('Error saving reservation:', error);
      alert('저장 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    if (!user || !selectedRestaurant) return;
    setDeleteType('reservation');
    setDeleteConfirmDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!user || !selectedRestaurant || !deleteType) return;
    
    try {
      if (deleteType === 'reservation') {
        const reservationPath = `food-resv/reservation/${user.uid}/${selectedRestaurant.id}`;
        await remove(ref(database, reservationPath));
        setSnackbarMessage('삭제되었습니다.');
        setSnackbarOpen(true);
        handleCloseDialog();
      } else if (deleteType === 'prepayment') {
        const prepaymentPath = `food-resv/prepayment/${user.uid}/${selectedRestaurant.id}`;
        await remove(ref(database, prepaymentPath));
        setSnackbarMessage('삭제되었습니다.');
        setSnackbarOpen(true);
        // 선결제 데이터 다시 로드
        await loadPrepayments(user.uid, selectedRestaurant.id);
      }
    } catch (error) {
      console.error('Error deleting:', error);
      alert('삭제 중 오류가 발생했습니다.');
    } finally {
      setDeleteConfirmDialogOpen(false);
      setDeleteType(null);
    }
  };

  // 선결제 관련 핸들러
  const handleAddPrepaymentRow = () => {
    const today = dayjs().format('YYYYMMDD');
    setPrepayments([
      ...prepayments,
      {
        id: `prepayment-${Date.now()}`,
        amount: 0,
        date: today,
        dateValue: dayjs(),
      },
    ]);
  };

  const handleDeletePrepaymentRow = (id: string) => {
    if (prepayments.length === 1) {
      // 마지막 행이면 초기화만
      const today = dayjs().format('YYYYMMDD');
      setPrepayments([{
        id: prepayments[0].id,
        amount: 0,
        date: today,
        dateValue: dayjs(),
      }]);
    } else {
      setPrepayments(prepayments.filter((item) => item.id !== id));
    }
  };

  const handlePrepaymentChange = (id: string, field: 'amount' | 'date', value: number | Dayjs | null) => {
    setPrepayments(prepayments.map((item) => {
      if (item.id === id) {
        if (field === 'amount') {
          return { ...item, amount: value as number };
        } else {
          const dateValue = value as Dayjs | null;
          if (dateValue) {
            return {
              ...item,
              date: dateValue.format('YYYYMMDD'),
              dateValue: dateValue,
            };
          }
          return item;
        }
      }
      return item;
    }));
  };

  const handleSavePrepayment = async () => {
    if (!user || !selectedRestaurant) return;
    
    setSavingPrepayment(true);
    try {
      const prepaymentPath = `food-resv/prepayment/${user.uid}/${selectedRestaurant.id}`;
      
      // 유효한 데이터만 필터링 (금액이 0보다 큰 것만)
      const validPrepayments = prepayments
        .filter((item) => item.amount > 0 && item.date)
        .map((item) => ({
          amount: item.amount,
          date: item.date,
        }));
      
      if (validPrepayments.length === 0) {
        // 빈 배열로 저장하면 삭제 효과
        await set(ref(database, prepaymentPath), []);
        setSnackbarMessage('저장되었습니다.');
        setSnackbarOpen(true);
      } else {
        await set(ref(database, prepaymentPath), validPrepayments);
        setSnackbarMessage('저장되었습니다.');
        setSnackbarOpen(true);
      }
    } catch (error) {
      console.error('Error saving prepayment:', error);
      alert('저장 중 오류가 발생했습니다.');
    } finally {
      setSavingPrepayment(false);
    }
  };

  const handleDeletePrepayment = () => {
    if (!user || !selectedRestaurant) return;
    setDeleteType('prepayment');
    setDeleteConfirmDialogOpen(true);
  };

  const handleReceipt = async () => {
    if (!user || !selectedRestaurant) return;
    
    if (!editableDate || editableDate.length !== 10) {
      alert('예약일이 필요합니다.');
      return;
    }
    
    try {
      // isReceipt를 true로 변경
      const reservationDate = parseReservationDate(editableDate);
      const reservationPath = `food-resv/reservation/${user.uid}/${selectedRestaurant.id}/${reservationDate}`;
      
      // 기존 예약 데이터 가져오기
      const reservationRef = ref(database, reservationPath);
      const snapshot = await get(reservationRef);
      
      if (snapshot.exists()) {
        const existingData: ReservationData = snapshot.val();
        const updatedData: ReservationData = {
          ...existingData,
          isReceipt: true,
        };
        await set(ref(database, reservationPath), updatedData);
      }
      
      // prepayment 삭제
      const prepaymentPath = `food-resv/prepayment/${user.uid}/${selectedRestaurant.id}`;
      await remove(ref(database, prepaymentPath));
      
      setSnackbarMessage('수령 처리되었습니다.');
      setSnackbarOpen(true);
      handleCloseDialog();
    } catch (error) {
      console.error('Error processing receipt:', error);
      alert('수령 처리 중 오류가 발생했습니다.');
    }
  };

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setMenuAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setMenuAnchorEl(null);
  };

  const handleShare = async () => {
    if (!selectedRestaurant) return;

    try {
      // 메뉴 문자열 생성
      let menuText = '';
      let totalAmount = 0;
      if (editableMenus && editableMenus.length > 0) {
        const validMenus = editableMenus.filter((m) => m.menu.trim() !== '' && m.cost > 0);
        if (validMenus.length > 0) {
          menuText = validMenus.map((m) => m.menu).join(' + ');
          totalAmount = validMenus.reduce((sum, m) => sum + (m.cost || 0), 0);
        }
      }

      // 선결제 정보 생성
      let prepaymentLines: string[] = [];
      let prepaymentTotal = 0;
      if (prepayments && prepayments.length > 0) {
        const validPrepayments = prepayments
          .filter((p) => p.amount > 0 && p.date)
          .sort((a, b) => a.date.localeCompare(b.date)); // 날짜 순으로 정렬
        
        if (validPrepayments.length > 0) {
          prepaymentLines = validPrepayments
            .map((p) => `${formatShareDate(p.date)} ${p.amount.toLocaleString()}원`);
          prepaymentTotal = validPrepayments.reduce((sum, p) => sum + (p.amount || 0), 0);
        }
      }

      // 공유 텍스트 생성
      let shareText = '━━━━━━━━━\n';
      
      if (menuText) {
        shareText += `■ 메뉴 : ${menuText}\n`;
      }
      if (totalAmount > 0) {
        shareText += `■ 가격 : ${totalAmount.toLocaleString()}원\n`;
      }
      if (editableDate) {
        const formattedDate = formatShareReservationDate(editableDate);
        shareText += `■ 예약일 : ${formattedDate}\n`;
      }
      shareText += '━━━━━━━━━━\n\n';

      if (prepaymentLines.length > 0) {
        shareText += '□ 선결제\n';
        shareText += prepaymentLines.join('\n') + '\n';
        shareText += '──────────\n';
        shareText += `합계 ${prepaymentTotal.toLocaleString()}원`;
      }

      // navigator.share 사용
      if (navigator.share) {
        await navigator.share({
          title: '',
          text: shareText,
        });
      } else {
        // navigator.share가 지원되지 않는 경우 클립보드에 복사
        await navigator.clipboard.writeText(shareText);
        alert('공유 내용이 클립보드에 복사되었습니다.');
      }
    } catch (error) {
      // 사용자가 공유를 취소한 경우 등은 무시
      if ((error as Error).name !== 'AbortError') {
        console.error('공유 중 오류:', error);
      }
    }
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <ProtectedRoute>
        <Box sx={{ flexGrow: 1 }}>
          <AppBar 
            position="static"
            elevation={0}
            sx={{
              backgroundColor: '#ffffff',
              color: '#0a0a0a',
              borderBottom: 'none',
            }}
          >
            <Toolbar sx={{ minHeight: '56px !important', px: { xs: 2, sm: 3 } }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mr: 0.25 }}>
                {loading ? (
                  <CircularProgress size={20} sx={{ color: '#0a0a0a' }} />
                ) : (
                  <IconButton 
                    edge="start" 
                    onClick={() => window.location.reload()}
                    sx={{ 
                      mr: 0.25,
                      color: '#0a0a0a',
                      '&:hover': {
                        backgroundColor: '#f5f5f5',
                      },
                    }}
                  >
                    <RestaurantIcon fontSize="small" />
                  </IconButton>
                )}
              </Box>
              <Box sx={{ flexGrow: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography 
                  variant="h6" 
                  component="div" 
                  sx={{ 
                    fontWeight: 600,
                    fontSize: 20,
                    color: '#0a0a0a',
                  }}
                >
                  포장 예약
                </Typography>
                {(() => {
                  // 잔여금액 합계 계산 (totalAmount - prepaymentTotal)
                  const totalRemainingAmount = restaurants.reduce((sum, restaurant) => {
                    if (restaurant.reservation && !restaurant.reservation.isReceipt && restaurant.reservation.menus) {
                      const restaurantTotal = restaurant.reservation.menus.reduce((menuSum, menu) => menuSum + (menu.cost || 0), 0);
                      const prepaymentTotal = restaurant.prepaymentTotal || 0;
                      const remainingAmount = restaurantTotal - prepaymentTotal;
                      return sum + remainingAmount;
                    }
                    return sum;
                  }, 0);
                  
                  if (totalRemainingAmount > 0) {
                    return (
                      <Typography
                        variant="body2"
                        sx={{
                          color: '#999999',
                          fontSize: 14,
                          fontWeight: 400,
                        }}
                      >
                        {totalRemainingAmount.toLocaleString()}원
                      </Typography>
                    );
                  }
                  return null;
                })()}
              </Box>
              <IconButton
                edge="end"
                onClick={handleMenuOpen}
                sx={{
                  color: '#0a0a0a',
                  '&:hover': {
                    backgroundColor: '#f5f5f5',
                  },
                }}
              >
                <MoreVertIcon fontSize="small" />
              </IconButton>
              <Menu
                anchorEl={menuAnchorEl}
                open={Boolean(menuAnchorEl)}
                onClose={handleMenuClose}
                PaperProps={{
                  sx: {
                    borderRadius: 2,
                    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.08)',
                    border: '1px solid #e5e5e5',
                    mt: 1,
                    minWidth: 180,
                  },
                }}
              >
                <MenuItem 
                  onClick={() => {
                    setNewRestaurant({
                      id: '',
                      name: '',
                      telNo: '',
                      kind: '',
                      menuImgId: '',
                      menuUrl: '',
                      naviUrl: '',
                    });
                    setRestaurantAddDialogOpen(true);
                    handleMenuClose();
                  }}
                  sx={{
                    fontSize: 14,
                    py: 1.5,
                    '&:hover': {
                      backgroundColor: '#f5f5f5',
                    },
                  }}
                >
                  <AddCircleIcon sx={{ mr: 1.5, fontSize: 18 }} />
                  식당 등록
                </MenuItem>
              </Menu>
            </Toolbar>
          </AppBar>
        </Box>
        <Container maxWidth="sm" sx={{ py: 0, px: { xs: 1, sm: 2 } }}>

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
            <Box sx={{ mt: 0 }}>
              {restaurants.length === 0 ? (
                <Typography variant="body1" align="center" sx={{ mt: 4 }}>
                  등록된 레스토랑이 없습니다.
                </Typography>
              ) : (
                <TableContainer 
                  component={Paper}
                  elevation={0}
                  sx={{
                    borderRadius: 0,
                    overflow: 'hidden',
                    border: 'none',
                  }}
                >
                  <Table sx={{ borderCollapse: 'separate', tableLayout: 'fixed' }}>
                    <TableHead>
                      <TableRow>
                        <TableCell 
                          sx={{ 
                            fontWeight: 600,
                            backgroundColor: 'rgb(246, 246, 246)',
                            borderTop: '1px solid rgb(220, 220, 220)',
                            borderBottom: '1px solid rgb(220, 220, 220)',
                            borderLeft: 'none',
                            borderRight: 'none',
                            px: 0,
                            width: '45%',
                          }}
                        >
                          식당
                        </TableCell>
                        <TableCell 
                          sx={{ 
                            fontWeight: 600,
                            backgroundColor: 'rgb(246, 246, 246)',
                            borderTop: '1px solid rgb(220, 220, 220)',
                            borderBottom: '1px solid rgb(220, 220, 220)',
                            borderLeft: 'none',
                            borderRight: 'none',
                            px: 0,
                            width: '40%',
                          }}
                        >
                          예약메뉴
                        </TableCell>
                        <TableCell 
                          sx={{ 
                            fontWeight: 600, 
                            whiteSpace: 'nowrap',
                            backgroundColor: 'rgb(246, 246, 246)',
                            borderTop: '1px solid rgb(220, 220, 220)',
                            borderBottom: '1px solid rgb(220, 220, 220)',
                            borderLeft: 'none',
                            borderRight: 'none',
                            px: 0,
                          }}
                        >
                          전화/네비
                        </TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {restaurants.map((restaurant, index) => {
                        // 예약 메뉴 문자열 생성
                        let menuText = '';
                        let totalAmount = 0;
                        if (restaurant.reservation && restaurant.reservation.menus) {
                          menuText = restaurant.reservation.menus
                            .map((m) => m.menu)
                            .join(' + ');
                          totalAmount = restaurant.reservation.menus.reduce((sum, m) => sum + (m.cost || 0), 0);
                        }

                        // reservation이 존재하지 않으면 isReceipt를 true로 처리
                        const isReceipt = restaurant.reservation ? (restaurant.reservation.isReceipt ?? false) : true;
                        const prepaymentTotal = restaurant.prepaymentTotal || 0;
                        
                        // isReceipt가 false일 때 색상 결정
                        let amountColor = 'inherit';
                        if (!isReceipt) {
                          if (prepaymentTotal === 0) {
                            amountColor = 'red';
                          } else if (prepaymentTotal >= totalAmount) {
                            amountColor = 'blue';
                          } else {
                            amountColor = 'orange';
                          }
                        }

                        const remainingAmount = totalAmount - prepaymentTotal;

                        return (
                          <TableRow
                            key={restaurant.id}
                            onClick={(e) => {
                              // 네비 아이콘이 disabled 상태일 때는 상세 팝업 열지 않음
                              const target = e.target as HTMLElement;
                              const clickedButton = target.closest('button');
                              const isDisabledNavIcon = clickedButton && (
                                clickedButton.hasAttribute('disabled') ||
                                clickedButton.classList.contains('Mui-disabled') ||
                                (!restaurant.naviUrl && clickedButton.querySelector('svg'))
                              );
                              
                              // 네비 아이콘 영역인지 확인 (NavigationIcon이 포함된 버튼)
                              if (isDisabledNavIcon && !restaurant.naviUrl) {
                                return; // 아무 동작도 하지 않음
                              }
                              
                              handleRestaurantClick(restaurant);
                            }}
                            sx={{
                              cursor: 'pointer',
                              backgroundColor: '#ffffff',
                              borderBottom: 'none',
                              '&:hover': {
                                backgroundColor: '#fafafa',
                              },
                            }}
                          >
                            <TableCell 
                              align="left"
                              sx={{
                                borderLeft: 'none',
                                borderRight: 'none',
                                px: 0,
                                width: '45%',
                              }}
                            >
                              <Button
                                variant="outlined"
                                size="small"
                                sx={{
                                  textTransform: 'none',
                                  justifyContent: 'flex-start',
                                  px: 1,
                                  fontWeight: !isReceipt ? 600 : 500,
                                  color: !isReceipt ? '#2563eb' : '#0a0a0a',
                                  borderColor: !isReceipt ? '#2563eb' : '#e5e5e5',
                                  '&:hover': {
                                    backgroundColor: !isReceipt ? 'rgba(37, 99, 235, 0.04)' : '#f5f5f5',
                                    borderColor: !isReceipt ? '#2563eb' : '#e5e5e5',
                                  },
                                }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRestaurantClick(restaurant);
                                }}
                              >
                                {restaurant.name}
                              </Button>
                            </TableCell>
                            <TableCell
                              onClick={(e) => {
                                e.stopPropagation();
                              }}
                              sx={{
                                borderLeft: 'none',
                                borderRight: 'none',
                                px: 0,
                                width: '40%',
                              }}
                            >
                              <Box>
                                {menuText && (
                                  <Typography
                                    variant="body2"
                                    sx={{
                                      color: isReceipt ? 'rgba(0, 0, 0, 0.2)' : amountColor,
                                      opacity: isReceipt ? 0.3 : 1,
                                      fontSize: '0.75rem',
                                    }}
                                  >
                                    {menuText}
                                  </Typography>
                                )}
                                {!isReceipt && (
                                  prepaymentTotal === 0 ? (
                                    <Typography
                                      variant="body2"
                                      sx={{
                                        color: '#999999',
                                        fontWeight: 400,
                                        fontSize: '0.75rem',
                                        mt: 0.5,
                                      }}
                                    >
                                      ({totalAmount.toLocaleString()})
                                    </Typography>
                                  ) : remainingAmount > 0 && remainingAmount !== totalAmount && (
                                    <Typography
                                      variant="body2"
                                      sx={{
                                        color: '#999999',
                                        fontWeight: 400,
                                        fontSize: '0.75rem',
                                        mt: 0.5,
                                      }}
                                    >
                                      ({remainingAmount.toLocaleString()})
                                    </Typography>
                                  )
                                )}
                              </Box>
                            </TableCell>
                            <TableCell
                              sx={{
                                borderLeft: 'none',
                                borderRight: 'none',
                                px: 0,
                              }}
                            >
                              <Box 
                                sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 0.5 }}
                                onClick={(e) => {
                                  // naviUrl이 없을 때 네비 아이콘 영역 클릭 시 이벤트 전파 차단
                                  const target = e.target as HTMLElement;
                                  const clickedButton = target.closest('button');
                                  if (clickedButton && !restaurant.naviUrl) {
                                    e.stopPropagation();
                                  }
                                }}
                              >
                                <Link
                                  href={`tel:${restaurant.telNo}`}
                                  sx={{ 
                                    textDecoration: 'none', 
                                    display: 'flex', 
                                    alignItems: 'center',
                                    color: '#666666',
                                    '&:hover': {
                                      color: '#0a0a0a',
                                    },
                                  }}
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <PhoneIcon fontSize="small" />
                                </Link>
                                <Box
                                  onClick={(e) => {
                                    if (!restaurant.naviUrl) {
                                      e.stopPropagation();
                                    }
                                  }}
                                >
                                  <IconButton
                                    size="small"
                                    disabled={!restaurant.naviUrl}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (restaurant.naviUrl) {
                                        window.open(restaurant.naviUrl, '_blank');
                                      }
                                    }}
                                    sx={{
                                      color: '#666666',
                                      opacity: restaurant.naviUrl ? 1 : 0.3,
                                      '&:hover': {
                                        backgroundColor: restaurant.naviUrl ? '#f5f5f5' : 'transparent',
                                        color: restaurant.naviUrl ? '#0a0a0a' : '#666666',
                                      },
                                      '&.Mui-disabled': {
                                        opacity: 0.3,
                                      },
                                      p: 0.5,
                                      ml: 0,
                                    }}
                                  >
                                    <NavigationIcon fontSize="small" />
                                  </IconButton>
                                </Box>
                              </Box>
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
                m: { xs: 0.5, sm: 2 },
                height: '80vh',
                maxHeight: '80vh',
                display: 'flex',
                flexDirection: 'column',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.08)',
                border: '1px solid #e5e5e5',
                width: { xs: 'calc(100% - 8px)', sm: 'auto' },
              },
            }}
          >
            {selectedRestaurant && (
              <>
                <DialogTitle 
                  sx={{ 
                    pb: 2, 
                    pt: 2,
                    px: { xs: 1.5, sm: 3 },
                    borderBottom: 'none',
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <Typography 
                        variant="h6" 
                        sx={{ 
                          fontSize: 16,
                          fontWeight: 600,
                          color: '#0a0a0a',
                          wordBreak: 'break-word' 
                        }}
                      >
                        {selectedRestaurant.name}
                      </Typography>
                      <IconButton
                        size="small"
                        onClick={() => {
                          // 최신 restaurants 리스트에서 식당 정보를 가져옴
                          const latestRestaurant = restaurants.find(r => r.id === selectedRestaurant.id);
                          if (latestRestaurant) {
                            setEditableRestaurant({
                              id: latestRestaurant.id,
                              name: latestRestaurant.name || '',
                              telNo: latestRestaurant.telNo || '',
                              kind: latestRestaurant.kind || '',
                              menuImgId: latestRestaurant.menuImgId || '',
                              menuUrl: latestRestaurant.menuUrl || '',
                              naviUrl: latestRestaurant.naviUrl || '',
                            });
                          } else {
                            setEditableRestaurant({
                              id: selectedRestaurant.id,
                              name: selectedRestaurant.name || '',
                              telNo: selectedRestaurant.telNo || '',
                              kind: selectedRestaurant.kind || '',
                              menuImgId: selectedRestaurant.menuImgId || '',
                              menuUrl: selectedRestaurant.menuUrl || '',
                              naviUrl: selectedRestaurant.naviUrl || '',
                            });
                          }
                          setRestaurantEditDialogOpen(true);
                        }}
                        sx={{ 
                          p: 0.5,
                          color: '#666666',
                          '&:hover': {
                            backgroundColor: '#f5f5f5',
                            color: '#0a0a0a',
                          },
                        }}
                      >
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      {(selectedRestaurant.menuImgId || selectedRestaurant.menuUrl) && (
                        <IconButton
                          size="small"
                          onClick={() => {
                            // menuImgId를 우선 적용
                            if (selectedRestaurant.menuImgId) {
                              const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || 'da5h7wjxc';
                              const url = `https://res.cloudinary.com/${cloudName}/image/upload/${selectedRestaurant.menuImgId}`;
                              window.open(url, '_blank', 'noopener');
                            } else if (selectedRestaurant.menuUrl) {
                              window.open(selectedRestaurant.menuUrl, '_blank', 'noopener');
                            }
                          }}
                          sx={{ 
                            flexShrink: 0,
                            color: '#666666',
                            '&:hover': {
                              backgroundColor: '#f5f5f5',
                            },
                          }}
                        >
                          <MenuBookIcon fontSize="small" />
                        </IconButton>
                      )}
                    </Box>
                  </Box>
                </DialogTitle>
                {(() => {
                  // summary 계산
                  const totalAmount = editableMenus.reduce((sum, menu) => sum + (menu.cost || 0), 0);
                  const prepaymentTotal = selectedRestaurant.prepaymentTotal || 0;
                  const remainingAmount = totalAmount - prepaymentTotal;
                  
                  if (totalAmount > 0) {
                    return (
                      <Box sx={{ px: { xs: 1.5, sm: 3 }, pb: 1, pt: 0 }}>
                        <Alert
                          severity="info"
                          sx={{
                            fontSize: '0.75rem',
                            color: '#999999',
                            backgroundColor: '#f5f5f5',
                            padding: '4px 8px',
                            '& .MuiAlert-icon': {
                              display: 'none',
                            },
                            '& .MuiAlert-message': {
                              fontSize: '0.75rem',
                              color: '#999999',
                              padding: 0,
                            },
                          }}
                        >
                          가격 {totalAmount.toLocaleString()}원 - 선결제 {prepaymentTotal.toLocaleString()}원 = {remainingAmount.toLocaleString()}원
                        </Alert>
                      </Box>
                    );
                  }
                  return null;
                })()}
                <Box sx={{ borderBottom: 'none', px: { xs: 1, sm: 2 } }}>
                  <Tabs 
                    value={currentTab} 
                    onChange={(e, newValue) => setCurrentTab(newValue)}
                    sx={{
                      '& .MuiTab-root': {
                        textTransform: 'none',
                        fontWeight: 500,
                        fontSize: 14,
                        minHeight: 48,
                        color: '#666666',
                        '&.Mui-selected': {
                          color: '#0a0a0a',
                        },
                      },
                      '& .MuiTabs-indicator': {
                        backgroundColor: '#0a0a0a',
                      },
                    }}
                  >
                    <Tab label="메뉴" />
                    <Tab label="선결제" />
                  </Tabs>
                </Box>
                <DialogContent 
                  sx={{ 
                    px: { xs: 1, sm: 3 }, 
                    py: 2,
                    overflow: 'auto',
                    flex: 1,
                    minHeight: 0,
                  }}
                >
                  {currentTab === 0 && (
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
                                fontSize: '0.8125rem'
                              },
                              '& .MuiInputLabel-root': {
                                fontSize: '0.8125rem'
                              }
                            }
                          }
                        }}
                      />
                      <TableContainer sx={{ maxHeight: { xs: '40vh', sm: '50vh' }, overflow: 'auto' }}>
                        <Table 
                          size="small" 
                          sx={{ 
                            '& .MuiTableCell-root': { 
                              fontSize: '0.875rem', 
                              py: { xs: 0.5, sm: 1 },
                              border: 'none',
                              backgroundColor: 'transparent',
                            },
                            '& .MuiTableHead-root .MuiTableCell-root': {
                              backgroundColor: 'transparent',
                              border: 'none',
                            },
                            '& .MuiTableBody-root .MuiTableRow-root': {
                              backgroundColor: 'transparent',
                              border: 'none',
                            },
                          }}
                        >
                          <TableHead>
                            <TableRow>
                              <TableCell sx={{ fontWeight: 'bold', px: { xs: 0.5, sm: 1 }, border: 'none', backgroundColor: 'transparent' }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                  <span>메뉴</span>
                                  <IconButton
                                    size="small"
                                    onClick={async () => {
                                      if (!user || !selectedRestaurant) return;
                                      
                                      try {
                                        // 해당 식당의 모든 예약 데이터 조회
                                        const reservationPath = `food-resv/reservation/${user.uid}/${selectedRestaurant.id}`;
                                        const reservationRef = ref(database, reservationPath);
                                        const snapshot = await get(reservationRef);
                                        
                                        const menuSet = new Set<string>();
                                        
                                        if (snapshot.exists()) {
                                          const reservations = snapshot.val();
                                          // 모든 날짜의 예약 데이터 순회
                                          Object.keys(reservations).forEach((date) => {
                                            const reservation: ReservationData = reservations[date];
                                            if (reservation && reservation.menus) {
                                              reservation.menus.forEach((menuItem: MenuItem) => {
                                                // 메뉴명과 가격을 조합한 키로 중복 체크
                                                const key = `${menuItem.menu}|${menuItem.cost}`;
                                                menuSet.add(key);
                                              });
                                            }
                                          });
                                        }
                                        
                                        // 중복 없는 메뉴 리스트 생성
                                        const uniqueMenus: { menu: string; cost: number }[] = [];
                                        menuSet.forEach((key) => {
                                          const [menu, costStr] = key.split('|');
                                          uniqueMenus.push({
                                            menu,
                                            cost: parseInt(costStr, 10),
                                          });
                                        });
                                        
                                        // 메뉴명으로 정렬
                                        uniqueMenus.sort((a, b) => a.menu.localeCompare(b.menu));
                                        
                                        setMenuHistoryList(uniqueMenus);
                                        setMenuHistoryDialogOpen(true);
                                      } catch (error) {
                                        console.error('Error fetching menu history:', error);
                                        alert('메뉴 이력을 불러오는 중 오류가 발생했습니다.');
                                      }
                                    }}
                                    sx={{
                                      p: 0.5,
                                      color: '#666666',
                                      '&:hover': {
                                        backgroundColor: '#f5f5f5',
                                        color: '#0a0a0a',
                                      },
                                    }}
                                  >
                                    <HistoryIcon fontSize="small" />
                                  </IconButton>
                                </Box>
                              </TableCell>
                              <TableCell align="right" sx={{ fontWeight: 'bold', px: { xs: 0.5, sm: 1 }, border: 'none', backgroundColor: 'transparent' }}>가격</TableCell>
                              <TableCell width={32} sx={{ px: 0, border: 'none', backgroundColor: 'transparent' }}></TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {editableMenus.map((menuItem) => (
                              <TableRow 
                                key={menuItem.id}
                                sx={{
                                  '&:nth-of-type(even)': {
                                    backgroundColor: 'transparent',
                                  },
                                  border: 'none',
                                }}
                              >
                                <TableCell sx={{ px: { xs: 0.5, sm: 1 }, border: 'none', backgroundColor: 'transparent' }}>
                                  <TextField
                                    value={menuItem.menu}
                                    onChange={(e) => handleMenuChange(menuItem.id, 'menu', e.target.value)}
                                    placeholder="메뉴명"
                                    size="small"
                                    fullWidth
                                    InputProps={{
                                      sx: { fontSize: '0.875rem' }
                                    }}
                                  />
                                </TableCell>
                                <TableCell align="right" sx={{ px: { xs: 0.5, sm: 1 }, border: 'none', backgroundColor: 'transparent' }}>
                                  <TextField
                                    type="number"
                                    value={menuItem.cost || ''}
                                    onChange={(e) => handleMenuChange(menuItem.id, 'cost', parseInt(e.target.value) || 0)}
                                    placeholder="금액"
                                    size="small"
                                    inputProps={{ min: 0 }}
                                    sx={{ width: { xs: 100, sm: 120 } }}
                                    InputProps={{
                                      sx: { fontSize: '0.875rem' }
                                    }}
                                  />
                                </TableCell>
                                <TableCell sx={{ px: 0, width: 32, border: 'none', backgroundColor: 'transparent' }}>
                                  <IconButton
                                    size="small"
                                    onClick={() => handleDeleteRow(menuItem.id)}
                                    aria-label="삭제"
                                    sx={{ 
                                      p: 0.5,
                                      color: '#dc2626',
                                      '&:hover': {
                                        backgroundColor: '#fef2f2',
                                        color: '#b91c1c',
                                      },
                                    }}
                                  >
                                    <ClearIcon fontSize="small" />
                                  </IconButton>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </TableContainer>
                    </Box>
                  )}
                  {currentTab === 1 && (
                    <Box>
                      <TableContainer sx={{ maxHeight: { xs: '40vh', sm: '50vh' }, overflow: 'auto' }}>
                        <Table 
                          size="small" 
                          sx={{ 
                            '& .MuiTableCell-root': { 
                              fontSize: '0.875rem', 
                              py: { xs: 0.5, sm: 1 },
                              whiteSpace: 'nowrap',
                              border: 'none',
                              backgroundColor: 'transparent',
                            },
                            '& .MuiTableHead-root .MuiTableCell-root': {
                              backgroundColor: 'transparent',
                              border: 'none',
                            },
                            '& .MuiTableBody-root .MuiTableRow-root': {
                              backgroundColor: 'transparent',
                              border: 'none',
                            },
                            width: '100%',
                            tableLayout: 'fixed',
                          }}
                        >
                          <TableHead>
                            <TableRow>
                              <TableCell sx={{ fontWeight: 'bold', px: { xs: 0.5, sm: 1 }, width: '45%', border: 'none', backgroundColor: 'transparent' }}>날짜</TableCell>
                              <TableCell align="right" sx={{ fontWeight: 'bold', px: { xs: 0.5, sm: 1 }, width: '40%', border: 'none', backgroundColor: 'transparent' }}>금액</TableCell>
                              <TableCell width={32} sx={{ px: 0, border: 'none', backgroundColor: 'transparent' }}></TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {prepayments.map((prepaymentItem) => (
                              <TableRow 
                                key={prepaymentItem.id}
                                sx={{
                                  '&:nth-of-type(even)': {
                                    backgroundColor: 'transparent',
                                  },
                                  border: 'none',
                                }}
                              >
                                <TableCell sx={{ px: { xs: 0.5, sm: 1 }, overflow: 'visible', border: 'none', backgroundColor: 'transparent' }}>
                                  <DatePicker
                                    value={prepaymentItem.dateValue}
                                    onChange={(newValue) => handlePrepaymentChange(prepaymentItem.id, 'date', newValue)}
                                    format="YYYY.MM.DD"
                                    slotProps={{
                                      textField: {
                                        size: 'small',
                                        fullWidth: true,
                                        sx: {
                                          '& .MuiInputBase-input': {
                                            fontSize: '0.8125rem',
                                            paddingRight: '48px !important',
                                            minWidth: 0,
                                          },
                                          '& .MuiInputBase-root': {
                                            width: '100%',
                                            minWidth: 0,
                                          },
                                          '& .MuiInputAdornment-root': {
                                            position: 'absolute',
                                            right: 8,
                                          }
                                        }
                                      }
                                    }}
                                  />
                                </TableCell>
                                <TableCell align="right" sx={{ px: { xs: 0.5, sm: 1 }, border: 'none', backgroundColor: 'transparent' }}>
                                  <TextField
                                    type="number"
                                    value={prepaymentItem.amount || ''}
                                    onChange={(e) => handlePrepaymentChange(prepaymentItem.id, 'amount', parseInt(e.target.value) || 0)}
                                    placeholder="금액"
                                    size="small"
                                    inputProps={{ min: 0 }}
                                    sx={{ width: '100%', maxWidth: 120 }}
                                    InputProps={{
                                      sx: { fontSize: '0.875rem' }
                                    }}
                                  />
                                </TableCell>
                                <TableCell sx={{ px: 0, width: 32, border: 'none', backgroundColor: 'transparent' }}>
                                  <IconButton
                                    size="small"
                                    onClick={() => handleDeletePrepaymentRow(prepaymentItem.id)}
                                    aria-label="삭제"
                                    sx={{ 
                                      p: 0.5,
                                      color: '#dc2626',
                                      '&:hover': {
                                        backgroundColor: '#fef2f2',
                                        color: '#b91c1c',
                                      },
                                    }}
                                  >
                                    <ClearIcon fontSize="small" />
                                  </IconButton>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </TableContainer>
                    </Box>
                  )}
                </DialogContent>
                <DialogActions 
                  sx={{ 
                    justifyContent: 'center', 
                    gap: 1, 
                    p: { xs: 1.5, sm: 3 },
                    borderTop: 'none',
                    flexWrap: 'wrap',
                  }}
                >
                  <IconButton 
                    aria-label="공유" 
                    size="small"
                    onClick={handleShare}
                    sx={{
                      color: '#666666',
                      '&:hover': {
                        backgroundColor: '#f5f5f5',
                        color: '#0a0a0a',
                      },
                    }}
                  >
                    <ShareIcon fontSize="small" />
                  </IconButton>
                  <IconButton 
                    aria-label="수령" 
                    size="small"
                    onClick={handleReceipt}
                    sx={{
                      color: '#666666',
                      '&:hover': {
                        backgroundColor: '#f5f5f5',
                        color: '#0a0a0a',
                      },
                    }}
                  >
                    <ReceiptIcon fontSize="small" />
                  </IconButton>
                  {currentTab === 0 && (
                    <>
                      <IconButton 
                        aria-label="저장" 
                        onClick={handleSave}
                        disabled={saving}
                        size="small"
                        sx={{
                          color: saving ? '#999999' : '#666666',
                          '&:hover:not(:disabled)': {
                            backgroundColor: '#f5f5f5',
                            color: '#0a0a0a',
                          },
                        }}
                      >
                        <SaveIcon fontSize="small" />
                      </IconButton>
                      <IconButton 
                        aria-label="추가"
                        onClick={handleAddRow}
                        size="small"
                        sx={{
                          color: '#666666',
                          '&:hover': {
                            backgroundColor: '#f5f5f5',
                            color: '#0a0a0a',
                          },
                        }}
                      >
                        <AddCircleIcon fontSize="small" />
                      </IconButton>
                      <IconButton 
                        aria-label="삭제"
                        onClick={handleDelete}
                        size="small"
                        sx={{
                          color: '#dc2626',
                          '&:hover': {
                            backgroundColor: '#fef2f2',
                            color: '#b91c1c',
                          },
                        }}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </>
                  )}
                  {currentTab === 1 && (
                    <>
                      <IconButton 
                        aria-label="저장" 
                        onClick={handleSavePrepayment}
                        disabled={savingPrepayment}
                        size="small"
                        sx={{
                          color: savingPrepayment ? '#999999' : '#666666',
                          '&:hover:not(:disabled)': {
                            backgroundColor: '#f5f5f5',
                            color: '#0a0a0a',
                          },
                        }}
                      >
                        <SaveIcon fontSize="small" />
                      </IconButton>
                      <IconButton 
                        aria-label="추가"
                        onClick={handleAddPrepaymentRow}
                        size="small"
                        sx={{
                          color: '#666666',
                          '&:hover': {
                            backgroundColor: '#f5f5f5',
                            color: '#0a0a0a',
                          },
                        }}
                      >
                        <AddCircleIcon fontSize="small" />
                      </IconButton>
                      <IconButton 
                        aria-label="삭제"
                        onClick={handleDeletePrepayment}
                        size="small"
                        sx={{
                          color: '#dc2626',
                          '&:hover': {
                            backgroundColor: '#fef2f2',
                            color: '#b91c1c',
                          },
                        }}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </>
                  )}
                  <IconButton 
                    onClick={handleCloseDialog} 
                    aria-label="닫기" 
                    size="small"
                    sx={{
                      color: '#666666',
                      '&:hover': {
                        backgroundColor: '#f5f5f5',
                        color: '#0a0a0a',
                      },
                    }}
                  >
                    <ExitToAppIcon fontSize="small" />
                  </IconButton>
                </DialogActions>
              </>
            )}
          </Dialog>
          
          {/* 식당 수정 팝업 */}
          <Dialog
            open={restaurantEditDialogOpen}
            onClose={() => setRestaurantEditDialogOpen(false)}
            maxWidth="sm"
            fullWidth
            PaperProps={{
              sx: {
                borderRadius: 2,
                m: { xs: 0.5, sm: 2 },
                width: { xs: 'calc(100% - 8px)', sm: 'auto' },
                maxHeight: { xs: '95vh', sm: '80vh' },
              },
            }}
          >
            <DialogTitle 
              sx={{ 
                pb: 2, 
                pt: 2,
                px: { xs: 1.5, sm: 3 },
                borderBottom: 'none',
                fontSize: 16,
                fontWeight: 600,
                color: '#0a0a0a',
              }}
            >
              {editableRestaurant?.id || '식당 수정'}
            </DialogTitle>
            <DialogContent 
              sx={{ 
                px: { xs: 2, sm: 4 }, 
                py: 2,
              }}
            >
              {editableRestaurant && (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
                  <TextField
                    label="식당명"
                    value={editableRestaurant.name}
                    onChange={(e) => setEditableRestaurant(prev => prev ? { ...prev, name: e.target.value } : null)}
                    fullWidth
                    size="small"
                    sx={{
                      '& .MuiInputBase-input': {
                        fontSize: '0.875rem',
                      },
                      '& .MuiInputLabel-root': {
                        fontSize: '0.875rem',
                      },
                    }}
                  />
                  <TextField
                    label="전화번호"
                    value={editableRestaurant.telNo || ''}
                    onChange={(e) => setEditableRestaurant(prev => prev ? { ...prev, telNo: e.target.value } : null)}
                    fullWidth
                    size="small"
                    sx={{
                      '& .MuiInputBase-input': {
                        fontSize: '0.875rem',
                      },
                      '& .MuiInputLabel-root': {
                        fontSize: '0.875rem',
                      },
                    }}
                  />
                  <TextField
                    label="식당 종류"
                    value={editableRestaurant.kind || ''}
                    onChange={(e) => setEditableRestaurant(prev => prev ? { ...prev, kind: e.target.value } : null)}
                    fullWidth
                    size="small"
                    sx={{
                      '& .MuiInputBase-input': {
                        fontSize: '0.875rem',
                      },
                      '& .MuiInputLabel-root': {
                        fontSize: '0.875rem',
                      },
                    }}
                  />
                  <TextField
                    label="메뉴 URL"
                    value={editableRestaurant.menuUrl || ''}
                    onChange={(e) => setEditableRestaurant(prev => prev ? { ...prev, menuUrl: e.target.value } : null)}
                    fullWidth
                    size="small"
                    sx={{
                      '& .MuiInputBase-input': {
                        fontSize: '0.875rem',
                      },
                      '& .MuiInputLabel-root': {
                        fontSize: '0.875rem',
                      },
                    }}
                  />
                  <TextField
                    label="메뉴 이미지 ID"
                    value={editableRestaurant.menuImgId || ''}
                    onChange={(e) => setEditableRestaurant(prev => prev ? { ...prev, menuImgId: e.target.value } : null)}
                    fullWidth
                    size="small"
                    InputProps={{
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton
                            size="small"
                            onClick={() => {
                              if (uploadWidget) {
                                uploadWidget.open();
                              }
                            }}
                            sx={{
                              color: '#666666',
                              '&:hover': {
                                backgroundColor: '#f5f5f5',
                                color: '#0a0a0a',
                              },
                            }}
                          >
                            <CameraAltIcon fontSize="small" />
                          </IconButton>
                        </InputAdornment>
                      ),
                    }}
                    sx={{
                      '& .MuiInputBase-input': {
                        fontSize: '0.875rem',
                      },
                      '& .MuiInputLabel-root': {
                        fontSize: '0.875rem',
                      },
                    }}
                  />
                  <TextField
                    label="식당위치"
                    value={editableRestaurant.naviUrl || ''}
                    onChange={(e) => setEditableRestaurant(prev => prev ? { ...prev, naviUrl: e.target.value } : null)}
                    fullWidth
                    size="small"
                    sx={{
                      '& .MuiInputBase-input': {
                        fontSize: '0.875rem',
                      },
                      '& .MuiInputLabel-root': {
                        fontSize: '0.875rem',
                      },
                    }}
                  />
                </Box>
              )}
            </DialogContent>
            <DialogActions 
              sx={{ 
                justifyContent: 'flex-end', 
                gap: 1, 
                p: { xs: 1.5, sm: 3 },
                borderTop: 'none',
              }}
            >
              <Button
                onClick={() => setRestaurantEditDialogOpen(false)}
                sx={{
                  color: '#666666',
                  '&:hover': {
                    backgroundColor: '#f5f5f5',
                  },
                }}
              >
                취소
              </Button>
              <Button
                onClick={async () => {
                  if (!editableRestaurant) return;
                  
                  try {
                    const restaurantPath = `food-resv/restaurant/${editableRestaurant.id}`;
                    const savedRestaurantId = editableRestaurant.id;
                    await set(ref(database, restaurantPath), {
                      name: editableRestaurant.name,
                      telNo: editableRestaurant.telNo || '',
                      kind: editableRestaurant.kind || '',
                      menuImgId: editableRestaurant.menuImgId || '',
                      menuUrl: editableRestaurant.menuUrl || '',
                      naviUrl: editableRestaurant.naviUrl || '',
                    });
                    setRestaurantEditDialogOpen(false);
                    setEditableRestaurant(null);
                    // 다이얼로그가 완전히 닫힌 후 alert 표시 및 식당 상세 팝업창 다시 열기
                    setTimeout(() => {
                      setSnackbarMessage('저장되었습니다.');
                      setSnackbarOpen(true);
                      // 저장 후 최신 데이터로 selectedRestaurant 업데이트하여 식당 상세 팝업창 유지
                      // Firebase에서 데이터가 업데이트되기를 기다린 후 최신 데이터 가져오기
                      const restaurantRef = ref(database, `food-resv/restaurant/${savedRestaurantId}`);
                      get(restaurantRef).then((snapshot) => {
                        if (snapshot.exists()) {
                          const restaurantData = snapshot.val();
                          // 최신 restaurants 리스트에서 찾기
                          const updatedRestaurant = restaurants.find(r => r.id === savedRestaurantId);
                          if (updatedRestaurant) {
                            // 기존 예약 정보는 유지하고 restaurant 데이터만 업데이트
                            setSelectedRestaurant({
                              ...updatedRestaurant,
                              name: restaurantData.name || updatedRestaurant.name,
                              telNo: restaurantData.telNo || updatedRestaurant.telNo,
                              kind: restaurantData.kind || updatedRestaurant.kind,
                              menuImgId: restaurantData.menuImgId || updatedRestaurant.menuImgId,
                              menuUrl: restaurantData.menuUrl || updatedRestaurant.menuUrl,
                              naviUrl: restaurantData.naviUrl || updatedRestaurant.naviUrl,
                            });
                            setDialogOpen(true);
                          }
                        }
                      }).catch((error) => {
                        console.error('Error fetching updated restaurant:', error);
                      });
                    }, 200);
                  } catch (error) {
                    console.error('Error saving restaurant:', error);
                    alert('저장 중 오류가 발생했습니다.');
                  }
                }}
                variant="contained"
                sx={{
                  backgroundColor: '#000000',
                  color: '#ffffff',
                  '&:hover': {
                    backgroundColor: '#333333',
                  },
                }}
              >
                저장
              </Button>
            </DialogActions>
          </Dialog>
          
          {/* 식당 등록 팝업 */}
          <Dialog
            open={restaurantAddDialogOpen}
            onClose={() => setRestaurantAddDialogOpen(false)}
            maxWidth="sm"
            fullWidth
            PaperProps={{
              sx: {
                borderRadius: 2,
                m: { xs: 0.5, sm: 2 },
                width: { xs: 'calc(100% - 8px)', sm: 'auto' },
                maxHeight: { xs: '95vh', sm: '80vh' },
              },
            }}
          >
            <DialogTitle 
              sx={{ 
                pb: 2, 
                pt: 2,
                px: { xs: 1.5, sm: 3 },
                borderBottom: 'none',
                fontSize: 16,
                fontWeight: 600,
                color: '#0a0a0a',
              }}
            >
              식당 등록
            </DialogTitle>
            <DialogContent 
              sx={{ 
                px: { xs: 2, sm: 4 }, 
                py: 2,
              }}
            >
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <TextField
                  label="식당 ID"
                  value={newRestaurant.id}
                  onChange={(e) => {
                    // 영어대문자와 숫자만 허용
                    const value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
                    setNewRestaurant(prev => ({ ...prev, id: value }));
                  }}
                  fullWidth
                  size="small"
                  required
                  sx={{
                    '& .MuiInputBase-input': {
                      fontSize: '0.875rem',
                    },
                    '& .MuiInputLabel-root': {
                      fontSize: '0.875rem',
                    },
                  }}
                />
                <TextField
                  label="식당명"
                  value={newRestaurant.name}
                  onChange={(e) => setNewRestaurant(prev => ({ ...prev, name: e.target.value }))}
                  fullWidth
                  size="small"
                  required
                  sx={{
                    '& .MuiInputBase-input': {
                      fontSize: '0.875rem',
                    },
                    '& .MuiInputLabel-root': {
                      fontSize: '0.875rem',
                    },
                  }}
                />
                <TextField
                  label="종류"
                  value={newRestaurant.kind}
                  onChange={(e) => setNewRestaurant(prev => ({ ...prev, kind: e.target.value }))}
                  fullWidth
                  size="small"
                  sx={{
                    '& .MuiInputBase-input': {
                      fontSize: '0.875rem',
                    },
                    '& .MuiInputLabel-root': {
                      fontSize: '0.875rem',
                    },
                  }}
                />
                <TextField
                  label="전화번호"
                  value={newRestaurant.telNo}
                  onChange={(e) => setNewRestaurant(prev => ({ ...prev, telNo: e.target.value }))}
                  fullWidth
                  size="small"
                  sx={{
                    '& .MuiInputBase-input': {
                      fontSize: '0.875rem',
                    },
                    '& .MuiInputLabel-root': {
                      fontSize: '0.875rem',
                    },
                  }}
                />
                <TextField
                  label="메뉴 URL"
                  value={newRestaurant.menuUrl}
                  onChange={(e) => setNewRestaurant(prev => ({ ...prev, menuUrl: e.target.value }))}
                  fullWidth
                  size="small"
                  sx={{
                    '& .MuiInputBase-input': {
                      fontSize: '0.875rem',
                    },
                    '& .MuiInputLabel-root': {
                      fontSize: '0.875rem',
                    },
                  }}
                />
                <TextField
                  label="메뉴 이미지 ID"
                  value={newRestaurant.menuImgId}
                  onChange={(e) => setNewRestaurant(prev => ({ ...prev, menuImgId: e.target.value }))}
                  fullWidth
                  size="small"
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          size="small"
                          onClick={() => {
                            if (uploadWidget) {
                              uploadWidget.open();
                            }
                          }}
                          sx={{
                            color: '#666666',
                            '&:hover': {
                              backgroundColor: '#f5f5f5',
                              color: '#0a0a0a',
                            },
                          }}
                        >
                          <CameraAltIcon fontSize="small" />
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                  sx={{
                    '& .MuiInputBase-input': {
                      fontSize: '0.875rem',
                    },
                    '& .MuiInputLabel-root': {
                      fontSize: '0.875rem',
                    },
                  }}
                />
                <TextField
                  label="식당위치"
                  value={newRestaurant.naviUrl}
                  onChange={(e) => setNewRestaurant(prev => ({ ...prev, naviUrl: e.target.value }))}
                  fullWidth
                  size="small"
                  sx={{
                    '& .MuiInputBase-input': {
                      fontSize: '0.875rem',
                    },
                    '& .MuiInputLabel-root': {
                      fontSize: '0.875rem',
                    },
                  }}
                />
              </Box>
            </DialogContent>
            <DialogActions 
              sx={{ 
                justifyContent: 'flex-end', 
                gap: 1, 
                p: { xs: 1.5, sm: 3 },
                borderTop: 'none',
              }}
            >
              <Button
                onClick={() => setRestaurantAddDialogOpen(false)}
                sx={{
                  color: '#666666',
                  '&:hover': {
                    backgroundColor: '#f5f5f5',
                  },
                }}
              >
                취소
              </Button>
              <Button
                onClick={async () => {
                  if (!newRestaurant.id || !newRestaurant.name) {
                    alert('식당 ID와 식당명을 입력해주세요.');
                    return;
                  }
                  
                  try {
                    const restaurantPath = `food-resv/restaurant/${newRestaurant.id}`;
                    // 기존 식당이 있는지 확인
                    const restaurantRef = ref(database, restaurantPath);
                    const snapshot = await get(restaurantRef);
                    
                    if (snapshot.exists()) {
                      setSnackbarMessage('이미 존재하는 식당 ID입니다.');
                      setSnackbarOpen(true);
                      return;
                    }
                    
                    await set(ref(database, restaurantPath), {
                      name: newRestaurant.name,
                      telNo: newRestaurant.telNo || '',
                      kind: newRestaurant.kind || '',
                      menuImgId: newRestaurant.menuImgId || '',
                      menuUrl: newRestaurant.menuUrl || '',
                      naviUrl: newRestaurant.naviUrl || '',
                    });
                    setRestaurantAddDialogOpen(false);
                    setNewRestaurant({
                      id: '',
                      name: '',
                      telNo: '',
                      kind: '',
                      menuImgId: '',
                      menuUrl: '',
                      naviUrl: '',
                    });
                    // 다이얼로그가 완전히 닫힌 후 Snackbar 표시
                    setTimeout(() => {
                      setSnackbarMessage('저장되었습니다.');
                      setSnackbarOpen(true);
                    }, 100);
                  } catch (error) {
                    console.error('Error saving restaurant:', error);
                    alert('저장 중 오류가 발생했습니다.');
                  }
                }}
                variant="contained"
                sx={{
                  backgroundColor: '#000000',
                  color: '#ffffff',
                  '&:hover': {
                    backgroundColor: '#333333',
                  },
                }}
              >
                저장
              </Button>
            </DialogActions>
          </Dialog>
          
          {/* 삭제 확인 Dialog */}
          <Dialog
            open={deleteConfirmDialogOpen}
            onClose={() => {
              setDeleteConfirmDialogOpen(false);
              setDeleteType(null);
            }}
            maxWidth="xs"
            fullWidth
            PaperProps={{
              sx: {
                borderRadius: 2,
                p: 2,
              },
            }}
          >
            <DialogTitle sx={{ fontSize: 16, fontWeight: 600, pb: 1 }}>
              삭제 확인
            </DialogTitle>
            <DialogContent>
              <Typography sx={{ fontSize: '0.875rem' }}>
                {deleteType === 'reservation' 
                  ? '예약 정보를 삭제하시겠습니까?' 
                  : '선결제 정보를 삭제하시겠습니까?'}
              </Typography>
            </DialogContent>
            <DialogActions sx={{ gap: 1, px: 2, pb: 2 }}>
              <Button
                onClick={() => {
                  setDeleteConfirmDialogOpen(false);
                  setDeleteType(null);
                }}
                sx={{
                  color: '#666666',
                  '&:hover': {
                    backgroundColor: '#f5f5f5',
                  },
                }}
              >
                취소
              </Button>
              <Button
                onClick={handleConfirmDelete}
                variant="contained"
                sx={{
                  backgroundColor: '#dc2626',
                  color: '#ffffff',
                  '&:hover': {
                    backgroundColor: '#b91c1c',
                  },
                }}
              >
                삭제
              </Button>
            </DialogActions>
          </Dialog>
          
          {/* 메뉴 이력 선택 Dialog */}
          <Dialog
            open={menuHistoryDialogOpen}
            onClose={() => setMenuHistoryDialogOpen(false)}
            maxWidth="xs"
            fullWidth
            PaperProps={{
              sx: {
                borderRadius: 2,
                m: { xs: 0.5, sm: 2 },
                maxHeight: { xs: '80vh', sm: '70vh' },
              },
            }}
          >
            <DialogTitle sx={{ fontSize: 16, fontWeight: 600, pb: 1 }}>
              메뉴 선택
            </DialogTitle>
            <DialogContent sx={{ p: 0 }}>
              <TableContainer sx={{ maxHeight: { xs: '60vh', sm: '50vh' }, overflow: 'auto' }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 'bold', fontSize: '0.875rem' }}>메뉴</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold', fontSize: '0.875rem' }}>가격</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {menuHistoryList.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={2} align="center" sx={{ py: 3, color: '#999999' }}>
                          등록된 메뉴가 없습니다.
                        </TableCell>
                      </TableRow>
                    ) : (
                      menuHistoryList.map((menuItem, index) => (
                        <TableRow
                          key={`${menuItem.menu}-${menuItem.cost}-${index}`}
                          onClick={() => {
                            // 첫 행이 비어있으면 첫 행에 반영, 아니면 새 행 추가
                            setEditableMenus(prev => {
                              if (prev.length > 0 && prev[0].menu.trim() === '' && prev[0].cost === 0) {
                                // 첫 행이 비어있으면 첫 행에 반영
                                return [
                                  {
                                    ...prev[0],
                                    menu: menuItem.menu,
                                    cost: menuItem.cost,
                                  },
                                  ...prev.slice(1),
                                ];
                              } else {
                                // 새 행 추가
                                const newMenu: EditableMenuItem = {
                                  id: `menu-${Date.now()}-${index}`,
                                  menu: menuItem.menu,
                                  cost: menuItem.cost,
                                };
                                return [...prev, newMenu];
                              }
                            });
                            setMenuHistoryDialogOpen(false);
                          }}
                          sx={{
                            cursor: 'pointer',
                            '&:hover': {
                              backgroundColor: '#f5f5f5',
                            },
                          }}
                        >
                          <TableCell sx={{ fontSize: '0.875rem' }}>{menuItem.menu}</TableCell>
                          <TableCell align="right" sx={{ fontSize: '0.875rem' }}>
                            {menuItem.cost.toLocaleString()}원
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </DialogContent>
            <DialogActions sx={{ p: 2 }}>
              <Button
                onClick={() => setMenuHistoryDialogOpen(false)}
                sx={{
                  color: '#666666',
                  '&:hover': {
                    backgroundColor: '#f5f5f5',
                  },
                }}
              >
                닫기
              </Button>
            </DialogActions>
          </Dialog>

          {/* Snackbar */}
          <Snackbar
            open={snackbarOpen}
            autoHideDuration={1000}
            onClose={() => setSnackbarOpen(false)}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
          >
            <Alert 
              onClose={() => setSnackbarOpen(false)} 
              severity="success" 
              sx={{ width: '100%' }}
            >
              {snackbarMessage}
            </Alert>
          </Snackbar>
        </Container>
      </ProtectedRoute>
    </ThemeProvider>
    </LocalizationProvider>
  );
}
