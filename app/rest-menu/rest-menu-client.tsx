'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ref, onValue, set, get, remove } from 'firebase/database';
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
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { MenuEditDialog, RestaurantEditDialog } from './components';

import {
  UtensilsCrossed,
  MoreVertical,
  Phone,
  Navigation,
  X,
  PlusCircle,
  Palette,
  Camera,
  Save,
  Pencil,
  Trash2,
  Plus,
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
}

interface RestaurantMenu {
  name: string;
  img: string;        // Cloudinary 이미지 ID (mobile용)
  thumbnail: string;  // Cloudinary 이미지 ID (thumbnail용)
  cost: number;
  remark: string;
}

const formatCurrency = (value: number) => value.toLocaleString('ko-KR');

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
  loading: boolean;
  error: string;
  currentTheme: ThemeMode;
  restaurantIcons: Record<string, string>;
};

function RestaurantList({
  restaurants,
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

  return (
    <Table>
      <TableHeader>
        <TableRow className="border-border/40">
          <TableHead className="w-[60%] text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            식당
          </TableHead>
          <TableHead className="w-[40%] text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            전화/네비
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {restaurants.map((restaurant) => (
          <TableRow
            key={restaurant.id}
            onClick={() => onSelect(restaurant)}
            className="cursor-pointer border-border/30 transition hover:bg-muted/70"
          >
            <TableCell className="align-middle">
              <Button
                variant="outline"
                size="sm"
                className={cn(
                  'w-[140px] max-w-[140px] justify-start transition-colors overflow-hidden',
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
                    <IconComponent className="mr-2 h-4 w-4 shrink-0" />
                  ) : null;
                })()}
                <span className="truncate min-w-0">
                  {restaurant.name}
                </span>
              </Button>
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
        ))}

        {!restaurants.length && (
          <TableRow>
            <TableCell
              colSpan={2}
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
  onDeleteMenu?: (menuKey: string) => void;
  onAddMenu?: () => void;
  onMenuClick?: (menuKey: string) => void;
};

function RestaurantMenuDialog({
  open,
  restaurant,
  menus,
  onClose,
  onImageClick,
  onEditRestaurant,
  onDeleteMenu,
  onAddMenu,
  onMenuClick,
}: RestaurantMenuDialogProps) {
  const menuEntries = Object.entries(menus);
  const [deleteMenuKey, setDeleteMenuKey] = useState<string | null>(null);

  return (
    <>
      <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
        <DialogContent className="flex h-[90vh] max-h-[90vh] max-w-md flex-col p-0 overflow-hidden !items-start !mt-0 [&>div]:h-full [&>div]:max-h-[90vh] [&>div]:flex [&>div]:flex-col [&>div]:overflow-hidden">
          <DialogHeader className="border-b border-border/50 px-5 py-4 shrink-0 flex-shrink-0">
            <div className="flex items-center gap-2">
              <DialogTitle>{restaurant?.name || '식당 메뉴'}</DialogTitle>
              {onEditRestaurant && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={onEditRestaurant}
                >
                  <Pencil className="h-4 w-4" />
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
                          <img
                            src={thumbnailUrl}
                            alt={menu.name}
                            className="h-[60px] w-[60px] rounded object-cover"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = 'none';
                            }}
                          />
                        </div>
                      ) : (
                        <div className="h-[60px] w-[60px] rounded bg-muted shrink-0" />
                      )}
                      <div 
                        className="flex-1 min-w-0 flex items-center justify-between gap-2 cursor-pointer"
                        onClick={() => {
                          if (onMenuClick) {
                            onMenuClick(key);
                          }
                        }}
                      >
                        <div className="text-sm font-medium truncate">{menu.name}</div>
                        <div className="flex items-center gap-2 shrink-0">
                          {menu.cost > 0 && (
                            <div className="text-sm text-muted-foreground whitespace-nowrap">
                              {formatCurrency(menu.cost)}원
                            </div>
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
          <img
            src={imageUrl}
            alt="메뉴 이미지"
            className="w-full h-auto max-h-[90vh] object-contain"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function RestMenuPageClient() {
  const { user } = useAuth();
  const router = useRouter();

  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [selectedRestaurant, setSelectedRestaurant] = useState<Restaurant | null>(null);
  const [menus, setMenus] = useState<Record<string, RestaurantMenu>>({});
  const [menuDialogOpen, setMenuDialogOpen] = useState(false);
  const [imageViewOpen, setImageViewOpen] = useState(false);
  const [currentImageUrl, setCurrentImageUrl] = useState('');

  const [currentTheme, setCurrentTheme] = useState<ThemeMode>('white');
  const [selectedTheme, setSelectedTheme] = useState<ThemeMode>('white');
  const [themeDialogOpen, setThemeDialogOpen] = useState(false);
  const [savingTheme, setSavingTheme] = useState(false);
  const [restaurantIcons, setRestaurantIcons] = useState<Record<string, string>>({});
  const [restaurantKinds, setRestaurantKinds] = useState<Record<string, { icon?: string; name?: string }>>({});

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newRestaurant, setNewRestaurant] = useState<Restaurant>({
    id: '',
    name: '',
    telNo: '',
    kind: '',
    menuImgId: '',
    menuUrl: '',
    naviUrl: '',
  });
  const [creatingRestaurant, setCreatingRestaurant] = useState(false);

  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editableRestaurant, setEditableRestaurant] = useState<Restaurant | null>(null);
  const [savingRestaurant, setSavingRestaurant] = useState(false);

  const [menuEditOpen, setMenuEditOpen] = useState(false);
  const [selectedMenuKey, setSelectedMenuKey] = useState<string | null>(null);
  const [selectedMenu, setSelectedMenu] = useState<RestaurantMenu | null>(null);

  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || 'da5h7wjxc';
  const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET_MOBILE || 'menu-mobile';
  const thumbnailPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET_THUMBNAIL || uploadPreset;

  useEffect(() => {
    document.documentElement.classList.toggle('dark', currentTheme === 'black');
  }, [currentTheme]);

  // 식당 목록 조회
  useEffect(() => {
    if (!user) return;

    const restaurantsRef = ref(database, 'food-resv/restaurant');
    const unsubscribe = onValue(
      restaurantsRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.val();
          const restaurantList: Restaurant[] = Object.entries(data).map(([id, restaurant]: [string, Partial<Restaurant>]) => ({
            id,
            name: restaurant.name || '',
            telNo: restaurant.telNo || '',
            kind: restaurant.kind || '',
            menuImgId: restaurant.menuImgId || '',
            menuUrl: restaurant.menuUrl || '',
            naviUrl: restaurant.naviUrl || '',
          }));
          setRestaurants(restaurantList);
        } else {
          setRestaurants([]);
        }
        setLoading(false);
      },
      (error) => {
        console.error('Error fetching restaurants:', error);
        setError('식당 목록을 불러오는 중 오류가 발생했습니다.');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user]);

  // 식당 종류 및 아이콘 조회
  useEffect(() => {
    if (!user) return;

    const kindsRef = ref(database, 'food-resv/restaurant-kind');
    const iconsRef = ref(database, 'food-resv/restaurant-icon');

    const unsubscribeKinds = onValue(
      kindsRef,
      (snapshot) => {
        if (snapshot.exists()) {
          setRestaurantKinds(snapshot.val() || {});
        }
      },
      (error) => {
        console.error('Error fetching restaurant kinds:', error);
      }
    );

    const unsubscribeIcons = onValue(
      iconsRef,
      (snapshot) => {
        if (snapshot.exists()) {
          setRestaurantIcons(snapshot.val() || {});
        }
      },
      (error) => {
        console.error('Error fetching restaurant icons:', error);
      }
    );

    return () => {
      unsubscribeKinds();
      unsubscribeIcons();
    };
  }, [user]);

  // 테마 조회
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
      (error) => {
        console.error('Error fetching theme:', error);
      }
    );

    return () => unsubscribe();
  }, [user]);

  // 메뉴 조회
  useEffect(() => {
    if (!menuDialogOpen || !selectedRestaurant) {
      setMenus({});
      return;
    }

    const menuRef = ref(database, `food-resv/restaurant/${selectedRestaurant.id}/menu`);
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
  }, [menuDialogOpen, selectedRestaurant]);

  const handleRestaurantClick = useCallback((restaurant: Restaurant) => {
    setSelectedRestaurant(restaurant);
    setMenuDialogOpen(true);
  }, []);

  const handleImageClick = useCallback((imageUrl: string) => {
    setCurrentImageUrl(imageUrl);
    setImageViewOpen(true);
  }, []);

  const handleShareThemeDialog = () => {
    setSelectedTheme(currentTheme);
    setThemeDialogOpen(true);
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
    });
    setEditDialogOpen(true);
  }, [selectedRestaurant, restaurants]);

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
      // 식당 목록 업데이트
      const updated = restaurants.map((r) =>
        r.id === id ? { ...r, name: name.trim(), telNo, kind, menuImgId, menuUrl, naviUrl } : r
      );
      setRestaurants(updated);
      if (selectedRestaurant?.id === id) {
        setSelectedRestaurant({ ...selectedRestaurant, name: name.trim(), telNo, kind, menuImgId, menuUrl, naviUrl });
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
      toast.success('메뉴를 저장했습니다.');
      setMenuEditOpen(false);
      setSelectedMenuKey(null);
      setSelectedMenu(null);
    } catch (error) {
      console.error('Error saving menu:', error);
      toast.error('메뉴 저장 중 오류가 발생했습니다.');
      throw error;
    }
  }, [user, selectedRestaurant]);

  const handleDeleteMenu = useCallback(async (menuKey: string) => {
    if (!user || !selectedRestaurant) return;

    try {
      const menuRef = ref(database, `food-resv/restaurant/${selectedRestaurant.id}/menu/${menuKey}`);
      await remove(menuRef);
      toast.success('메뉴를 삭제했습니다.');
    } catch (error) {
      console.error('Error deleting menu:', error);
      toast.error('메뉴 삭제 중 오류가 발생했습니다.');
    }
  }, [user, selectedRestaurant]);

  const handleMenuClick = useCallback((menuKey: string) => {
    const menu = menus[menuKey];
    setSelectedMenuKey(menuKey);
    setSelectedMenu(menu || null);
    setMenuEditOpen(true);
  }, [menus]);

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
                onClick={() => router.push('/')}
              >
                <UtensilsCrossed className="h-5 w-5" />
              </Button>
              <div className="flex items-center gap-2">
                <span className="text-base font-semibold leading-tight">식당 메뉴</span>
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
                  onSelect={() => router.push('/')}
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
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main className="mx-auto w-full max-w-xl px-3 pb-28">
          <RestaurantList
            restaurants={restaurants}
            onSelect={handleRestaurantClick}
            loading={loading}
            error={error}
            currentTheme={currentTheme}
            restaurantIcons={restaurantIcons}
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
          onDeleteMenu={handleDeleteMenu}
          onAddMenu={handleAddNewMenu}
          onMenuClick={handleMenuClick}
        />

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
          saving={savingTheme}
        />

        <RestaurantCreateDialog
          open={createDialogOpen}
          restaurant={newRestaurant}
          onChange={(updates) => setNewRestaurant((prev) => ({ ...prev, ...updates }))}
          onClose={() => setCreateDialogOpen(false)}
          onSave={handleRestaurantCreate}
          saving={creatingRestaurant}
          restaurantKinds={restaurantKinds}
          restaurantIcons={restaurantIcons}
        />

        {editableRestaurant && (
          <RestaurantEditDialog
            open={editDialogOpen}
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
      </div>
    </ProtectedRoute>
  );
}

type RestaurantCreateDialogProps = {
  open: boolean;
  restaurant: Restaurant;
  onChange: (updates: Partial<Restaurant>) => void;
  onClose: () => void;
  onSave: () => void;
  saving: boolean;
  restaurantKinds: Record<string, { icon?: string; name?: string }>;
  restaurantIcons: Record<string, string>;
};

function RestaurantCreateDialog({
  open,
  restaurant,
  onChange,
  onClose,
  onSave,
  saving,
  restaurantKinds,
  restaurantIcons,
}: RestaurantCreateDialogProps) {
  const [kindSelectOpen, setKindSelectOpen] = useState(false);
  const selectedKindData = restaurant.kind ? restaurantKinds[restaurant.kind] : null;
  const selectedKindName = selectedKindData?.name || restaurant.kind || '';
  const selectedKindIcon = selectedKindData?.icon || (restaurant.kind ? restaurantIcons[restaurant.kind] : undefined);
  const SelectedIconComponent = selectedKindIcon ? getLucideIcon(selectedKindIcon) : null;
  const hasMenuListImage = Boolean(restaurant.menuImgId?.trim());

  return (
    <>
      <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
        <DialogContent className={cn(
          "flex h-[90vh] max-h-[90vh] max-w-md flex-col p-0 overflow-hidden !items-start !mt-0",
          "[&>div]:h-full [&>div]:max-h-[90vh] [&>div]:flex [&>div]:flex-col [&>div]:overflow-hidden"
        )}>
          <DialogHeader className="border-b border-border/50 px-5 py-4 shrink-0 flex-shrink-0">
            <DialogTitle>식당 등록</DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto overflow-x-hidden px-5 py-4 min-h-0">
            <div className="space-y-4">
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
                  disabled
                >
                  <Camera className={cn("mr-2 h-4 w-4", hasMenuListImage && "text-green-500")} />
                  {hasMenuListImage ? '이미지 업로드됨' : '이미지 업로드 (식당 등록 후 수정 가능)'}
                </Button>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-medium text-muted-foreground">식당 위치</Label>
                <Input
                  value={restaurant.naviUrl ?? ''}
                  onChange={(event) => onChange({ naviUrl: event.target.value })}
                  placeholder="네이버 지도 검색어 또는 주소"
                />
              </div>

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
    </>
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

