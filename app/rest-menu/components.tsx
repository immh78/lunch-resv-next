'use client';

import React, { useCallback, useEffect, useState, useRef } from 'react';
import { ref, onValue, set, update } from 'firebase/database';
import { toast } from 'sonner';

import { database } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import { getLucideIcon } from '@/lib/icon-utils';

import { Camera, Save, Plus } from 'lucide-react';

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
  img: string;
  thumbnail: string;
  cost: number;
  remark: string;
}

type ImageUploadDialogProps = {
  open: boolean;
  onClose: () => void;
  onUploaded: (publicId: string) => void;
  cloudName: string;
  uploadPreset: string;
  initialPublicId?: string | null;
  uploadBoth?: boolean;
  onBothUploaded?: (mobileId: string, thumbnailId: string) => void;
};

export function ImageUploadDialog({
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
      cleanupPreview();
      setFile(null);
      setErrorMessage(null);
      setShowSourceMenu(false);
      setImageLoadError(false);
      setImageLoading(false);
      setImageUrl(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      if (cameraInputRef.current) {
        cameraInputRef.current.value = '';
      }
      return;
    }

    cleanupPreview();
    setFile(null);
    setErrorMessage(null);
    setShowSourceMenu(false);
    setImageLoadError(false);
    setImageLoading(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    if (cameraInputRef.current) {
      cameraInputRef.current.value = '';
    }

    if (initialPublicId && initialPublicId.trim()) {
      try {
        let publicId = initialPublicId.trim();
        publicId = publicId.replace(/\.(jpg|jpeg|png|webp|gif)$/i, '');
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
        const thumbnailPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET_THUMBNAIL || uploadPreset;
        
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
          <DialogDescription>
            Cloudinary에 이미지를 업로드하여 메뉴 이미지 ID를 자동으로 채워요.
          </DialogDescription>
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
                    key={imageUrl}
                    src={imageUrl}
                    alt="등록된 메뉴 이미지 미리보기"
                    className="h-40 w-full object-cover"
                    onError={() => {
                      console.error('이미지 로드 실패:', initialPublicId?.trim(), 'URL:', imageUrl);
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

export function MenuEditDialog({
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

type RestaurantEditDialogProps = {
  open: boolean;
  restaurant: Restaurant;
  onChange: (updates: Partial<Restaurant>) => void;
  onClose: () => void;
  onSave: () => void;
  saving: boolean;
  restaurantKinds: Record<string, { icon?: string; name?: string }>;
  restaurantIcons: Record<string, string>;
  cloudName: string;
  uploadPreset: string;
  thumbnailPreset: string;
  onMenuSave: (menuKey: string, menu: RestaurantMenu) => void;
};

export function RestaurantEditDialog({
  open,
  restaurant,
  onChange,
  onClose,
  onSave,
  saving,
  restaurantKinds,
  restaurantIcons,
  cloudName,
  uploadPreset,
  thumbnailPreset,
  onMenuSave,
}: RestaurantEditDialogProps) {
  const [kindSelectOpen, setKindSelectOpen] = useState(false);
  const [menuEditOpen, setMenuEditOpen] = useState(false);
  const [menuListOpen, setMenuListOpen] = useState(false);
  const [selectedMenuKey, setSelectedMenuKey] = useState<string | null>(null);
  const [selectedMenu, setSelectedMenu] = useState<RestaurantMenu | null>(null);
  const [menus, setMenus] = useState<Record<string, RestaurantMenu>>({});
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const selectedKindData = restaurant.kind ? restaurantKinds[restaurant.kind] : null;
  const selectedKindName = selectedKindData?.name || restaurant.kind || '';
  const selectedKindIcon = selectedKindData?.icon || (restaurant.kind ? restaurantIcons[restaurant.kind] : undefined);
  const SelectedIconComponent = selectedKindIcon ? getLucideIcon(selectedKindIcon) : null;
  const hasMenuListImage = Boolean(restaurant.menuImgId?.trim());

  useEffect(() => {
    if (!open || !restaurant.id) {
      setMenus({});
      return;
    }

    const menuRef = ref(database, `food-resv/restaurant/${restaurant.id}/menu`);
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
  }, [open, restaurant.id]);

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
      handleAddNewMenu();
    } else {
      setMenuListOpen(true);
    }
  }, [menus, handleAddNewMenu]);

  const handleMenuSave = useCallback((menuKey: string, menu: RestaurantMenu) => {
    if (onMenuSave) {
      onMenuSave(menuKey, menu);
    }
  }, [onMenuSave]);

  const handleUploadSuccess = useCallback(
    async (publicId: string) => {
      const currentRestaurant = restaurant;
      if (currentRestaurant?.id) {
        try {
          const restaurantRef = ref(database, `food-resv/restaurant/${currentRestaurant.id}`);
          await update(restaurantRef, {
            menuImgId: publicId,
          });
          onChange({ menuImgId: publicId });
          toast.success('이미지를 업로드하고 저장했습니다.');
        } catch (error) {
          console.error('Error saving menu image:', error);
          toast.error('이미지를 저장하는 중 오류가 발생했습니다.');
          return;
        }
      }
      setUploadDialogOpen(false);
    },
    [restaurant, onChange]
  );

  const menuNames = Object.entries(menus).map(([key, menu]) => menu.name).filter(Boolean);

  return (
    <>
      <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
        <DialogContent className={cn(
          "flex h-[90vh] max-h-[90vh] max-w-md flex-col p-0 overflow-hidden !items-start !mt-0",
          "[&>div]:h-full [&>div]:max-h-[90vh] [&>div]:flex [&>div]:flex-col [&>div]:overflow-hidden"
        )}>
          <DialogHeader className="border-b border-border/50 px-5 py-4 shrink-0 flex-shrink-0">
            <DialogTitle>{restaurant.id}</DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto overflow-x-hidden px-5 py-4 min-h-0">
            <div className="space-y-4">
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
                  onClick={() => setUploadDialogOpen(true)}
                >
                  <Camera className={cn("mr-2 h-4 w-4", hasMenuListImage && "text-green-500")} />
                  {hasMenuListImage ? '이미지 업로드됨' : '이미지 업로드'}
                </Button>
              </div>

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
                  disabled={saving}
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

      {cloudName && uploadPreset && thumbnailPreset && (
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
            mobilePreset={uploadPreset}
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

      <ImageUploadDialog
        open={uploadDialogOpen}
        onClose={() => setUploadDialogOpen(false)}
        onUploaded={handleUploadSuccess}
        cloudName={cloudName}
        uploadPreset={uploadPreset}
        initialPublicId={restaurant.menuImgId || null}
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

type MenuListDialogProps = {
  open: boolean;
  restaurantName: string;
  menus: Record<string, RestaurantMenu>;
  onClose: () => void;
  onMenuClick: (menuKey: string) => void;
  onAddNewMenu: () => void;
};

export function MenuListDialog({
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
              <Plus className="h-4 w-4" />
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
                    {menu.cost.toLocaleString('ko-KR')}원
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

