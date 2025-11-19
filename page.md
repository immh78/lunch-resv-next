# 페이지 및 팝업 구조 문서

## 목차
1. [공통 페이지/팝업](#공통-페이지팝업)
2. [포장예약 페이지](#포장예약-페이지)
3. [식당메뉴 페이지](#식당메뉴-페이지)

---

## 공통 페이지/팝업

### 1. 로그인 페이지 (`/login`)
**파일 위치**: `app/login/page.tsx`, `app/login/login-form.tsx`

**기능**:
- 이메일, 비밀번호 입력을 통한 로그인
- 비밀번호 재설정 링크 (sendPasswordResetEmail)
- 회원가입 페이지로 이동하는 링크
- 로그인 성공 시 이전 페이지로 리다이렉트

**주요 컴포넌트**:
- `LoginForm`: 로그인 폼 컴포넌트
- 이메일 입력 필드
- 비밀번호 입력 필드
- 로그인 버튼
- 비밀번호 재설정 링크
- 회원가입 링크

---

### 2. 회원가입 페이지 (`/signup`)
**파일 위치**: `app/signup/page.tsx`, `app/signup/signup-form.tsx`

**기능**:
- 이름, 이메일, 비밀번호 입력을 통한 회원가입
- Firebase Authentication에 사용자 등록
- Realtime Database에 추가 회원정보 저장
  - 경로: `user/{사용자UID}`
  - 데이터: `email`, `name`

**주요 컴포넌트**:
- `SignupForm`: 회원가입 폼 컴포넌트
- 이름 입력 필드
- 이메일 입력 필드
- 비밀번호 입력 필드
- 회원가입 버튼

---

### 3. 테마 선택 팝업
**파일 위치**: `app/home-page-client.tsx` (ThemeDialog), `app/rest-menu/rest-menu-client.tsx` (ThemeDialog)

**기능**:
- 화이트/블랙 테마 선택
- 선택한 테마를 Realtime Database에 저장
  - 경로: `food-resv/theme/{사용자UID}`
  - 데이터: `theme` (white | black)

**주요 컴포넌트**:
- 테마 선택 버튼 (화이트, 블랙)
- 닫기 버튼

**접근 방법**:
- 메인 화면 우측 상단 `...` 메뉴 → "테마" 선택

---

### 4. 식당 등록/수정 팝업
**파일 위치**: `app/rest-menu/components.tsx` (RestaurantFormDialog)

**기능**:
- 식당 등록 모드 (`mode: 'create'`)
- 식당 수정 모드 (`mode: 'edit'`)

**입력 항목**:
- 식당 ID (등록 모드만, 영문 대문자와 숫자만 입력 가능)
- 식당명
- 종류 (식당 종류 선택 팝업에서 선택)
- 전화번호
- 메뉴 URL
- 메뉴 리스트 이미지 (Cloudinary 업로드)
- 메뉴 관리 (수정 모드만, 등록된 메뉴 목록 표시)
- 식당 위치 (네이버 지도 검색어)

**저장 경로**:
- `food-resv/restaurant/{식당ID}`

**접근 방법**:
- 메인 화면 우측 상단 `...` 메뉴 → "식당 등록"
- 식당 상세 팝업 → 연필 아이콘 클릭 (수정 모드)

---

### 5. 메뉴 등록/수정 팝업
**파일 위치**: `app/rest-menu/components.tsx` (MenuEditDialog)

**기능**:
- 메뉴 등록 모드 (menu가 null일 때)
- 메뉴 수정 모드 (menu가 존재할 때)

**입력 항목**:
- 메뉴명
- 가격
- 사진 (Cloudinary 업로드, mobile용과 thumbnail용)
- 비고

**저장 경로**:
- `food-resv/restaurant/{식당ID}/menu/{menuKey}`

**접근 방법**:
- 식당 등록/수정 팝업 → 메뉴 관리 클릭 → 메뉴 목록 팝업 → 메뉴명 클릭 또는 + 아이콘
- 식당 메뉴 팝업 → 메뉴명 클릭 또는 연필 아이콘

---

### 6. 메뉴 목록 팝업
**파일 위치**: `app/rest-menu/components.tsx` (MenuListDialog)

**기능**:
- 식당별 등록된 메뉴 목록 표시
- 메뉴명 클릭 시 메뉴 수정 팝업 오픈
- + 아이콘 클릭 시 메뉴 등록 팝업 오픈
- 연필 아이콘 클릭 시 메뉴 수정 팝업 오픈

**주요 컴포넌트**:
- 타이틀: `{식당명} 메뉴목록`
- 메뉴 목록 (메뉴명, 가격 표시)
- + 아이콘 (메뉴 추가)

**접근 방법**:
- 식당 등록/수정 팝업 → 메뉴 관리 클릭 (등록된 메뉴가 있을 때)

---

### 7. 이미지 업로드 팝업
**파일 위치**: `app/rest-menu/components.tsx` (ImageUploadDialog)

**기능**:
- Cloudinary를 통한 이미지 업로드
- 사진 촬영 또는 파일 선택
- JPG 형식만 지원, 최대 5MB
- 등록된 이미지 미리보기 (initialPublicId가 있을 때)

**주요 컴포넌트**:
- 이미지 드래그 앤 드롭 영역
- 사진 촬영 버튼
- 파일 선택 버튼
- 업로드 버튼
- 등록된 이미지 표시 영역

**접근 방법**:
- 식당 등록/수정 팝업 → 메뉴 리스트 이미지 버튼 클릭
- 메뉴 등록/수정 팝업 → 사진 버튼 클릭

---

### 8. 종류 선택 팝업
**파일 위치**: `app/rest-menu/components.tsx` (RestaurantKindSelectDialog), `app/home-page-client.tsx` (RestaurantKindSelectDialog)

**기능**:
- 식당 종류 선택
- Lucide 아이콘과 함께 종류명 표시

**데이터 경로**:
- `food-resv/restaurant-kind/{kind}`
  - `icon`: Lucide 아이콘 이름
  - `name`: 종류 명칭

**접근 방법**:
- 식당 등록/수정 팝업 → 종류 버튼 클릭

---

## 포장예약 페이지

### 1. 메인 페이지 (`/`)
**파일 위치**: `app/home-page-client.tsx` (Home 컴포넌트)

**기능**:
- 식당 목록 표시
- 예약 정보 표시
- 선결제 정보 표시
- 잔여금액 합계 표시

**테이블 구조**:
- 컬럼: 식당, 예약메뉴, 전화/네비
- 식당: 식당명 버튼 (140px 고정, 아이콘 포함)
- 예약메뉴: 메뉴명 + 잔여금액 (색상 코딩)
  - 파란색: 선결제금액 >= 예약금액
  - 빨간색: 선결제금액 = 0
  - 주황색: 그 외
- 전화/네비: 전화 아이콘, 네비 아이콘

**정렬 기준**:
- 예약일 내림차순 (예약일이 없으면 가장 아래)

**필터링**:
- hideRestaurant 테이블에 있는 식당은 숨김 처리
- 하단 `...` 아이콘 클릭 시 숨긴 식당 표시

**헤더**:
- 타이틀: "포장 예약" (아이콘 포함)
- 우측 잔여금액 합계 표시
- 우측 상단 `...` 메뉴:
  - 식당 메뉴 (페이지 이동)
  - 식당 등록
  - 테마

**접근 방법**:
- 초기 페이지 (로그인 후 자동 이동)
- 식당 메뉴 페이지 → 타이틀 아이콘 또는 메뉴에서 "포장 예약" 선택

---

### 2. 식당 상세 팝업
**파일 위치**: `app/home-page-client.tsx` (RestaurantDetailDialog)

**기능**:
- 예약 메뉴 관리
- 선결제 관리
- 예약 정보 공유
- 수령 처리
- 예약 정보 삭제

**구조**:
- 타이틀: 식당명
- 연필 아이콘: 식당 수정 팝업 오픈
- 메뉴 아이콘: 메뉴 이미지/URL 오픈 (menuImgId 또는 menuUrl이 있을 때)
- Summary: 가격 합계 - 선결제 합계 = 잔여금액
- 탭: 메뉴, 선결제

**메뉴 탭**:
- 예약일 선택 (Calendar 컴포넌트)
- 메뉴 테이블:
  - 컬럼: 메뉴, 가격, 삭제 아이콘
  - 히스토리 아이콘: 이전 예약 메뉴 불러오기
  - 등록된 메뉴 아이콘: 식당에 등록된 메뉴 불러오기
  - 추가 버튼: 행 추가
- 하단 버튼:
  - 공유 (isReceipt가 false일 때만 활성화)
  - 수령 (isReceipt가 false일 때만 활성화)
  - 저장
  - 삭제 (isReceipt가 false일 때만 활성화)

**선결제 탭**:
- 선결제 테이블:
  - 컬럼: 날짜, 금액, 삭제 아이콘
  - 날짜 선택 (Calendar 컴포넌트)
  - 추가 버튼: 행 추가
- 하단 버튼:
  - 공유 (isReceipt가 false일 때만 활성화)
  - 수령 (isReceipt가 false일 때만 활성화)
  - 저장
  - 삭제 (isReceipt가 false일 때만 활성화)

**저장 경로**:
- 예약: `food-resv/reservation/{사용자UID}/{식당ID}/{예약일(yyyyMMdd)}`
- 선결제: `food-resv/prepayment/{사용자UID}/{식당ID}`

**접근 방법**:
- 메인 페이지 → 식당 클릭

---

### 3. 메뉴 히스토리 팝업
**파일 위치**: `app/home-page-client.tsx` (MenuHistoryDialog)

**기능**:
- 이전에 등록한 메뉴와 가격을 중복 없이 표시
- 메뉴 선택 시 예약 메뉴에 추가

**데이터 경로**:
- `food-resv/reservation/{사용자UID}/{식당ID}`

**접근 방법**:
- 식당 상세 팝업 → 메뉴 탭 → 히스토리 아이콘 클릭

---

### 4. 등록된 메뉴 선택 팝업
**파일 위치**: `app/home-page-client.tsx` (RestaurantMenuPickerDialog)

**기능**:
- 식당에 등록된 메뉴 목록 표시 (썸네일 이미지 포함)
- 메뉴 선택 시 예약 메뉴에 추가

**데이터 경로**:
- `food-resv/restaurant/{식당ID}/menu`

**접근 방법**:
- 식당 상세 팝업 → 메뉴 탭 → 등록된 메뉴 아이콘 클릭 (등록된 메뉴가 있을 때만 표시)

---

### 5. 삭제 확인 팝업
**파일 위치**: `app/home-page-client.tsx` (DeleteConfirmDialog)

**기능**:
- 예약 정보 삭제 확인
- 선결제 삭제 확인

**접근 방법**:
- 식당 상세 팝업 → 메뉴 탭 또는 선결제 탭 → 삭제 버튼 클릭

---

## 식당메뉴 페이지

### 1. 메인 페이지 (`/rest-menu`)
**파일 위치**: `app/rest-menu/rest-menu-client.tsx` (RestMenuPageClient)

**기능**:
- 식당 목록 표시
- 최근 메뉴 표시
- 식당명, 메뉴명 검색

**테이블 구조**:
- 컬럼: 식당, 최근 메뉴, 전화/네비
- 식당: 식당명 버튼 (140px 고정, 아이콘 포함)
- 최근 메뉴: `mm/dd(요일) 메뉴명` 형식 (클릭 시 메뉴 이력 팝업 오픈)
- 전화/네비: 전화 아이콘, 네비 아이콘

**정렬 기준**:
1. 최근 메뉴 방문일시 역순
2. 식당명 (한글이 영문보다 우선)

**검색 기능**:
- 식당명 또는 메뉴명으로 검색
- 검색어 입력란 (돋보기 아이콘, X 아이콘)

**헤더**:
- 타이틀: "식당 메뉴" (책 아이콘 포함)
- 우측 상단 `...` 메뉴:
  - 포장 예약 (페이지 이동)
  - 식당 등록
  - 테마

**접근 방법**:
- 포장 예약 페이지 → 타이틀 아이콘 또는 메뉴에서 "식당 메뉴" 선택

---

### 2. 식당 메뉴 팝업
**파일 위치**: `app/rest-menu/rest-menu-client.tsx` (RestaurantMenuDialog)

**기능**:
- 식당별 등록된 메뉴 목록 표시
- 메뉴 이미지 썸네일 표시 (60x60)
- 메뉴 선택 시 visit-log 저장 및 팝업 닫기
- 메뉴 수정
- 메뉴 삭제
- 메뉴 추가

**구조**:
- 타이틀: 식당명
- 연필 아이콘: 식당 수정 팝업 오픈
- 메뉴 목록:
  - 썸네일 이미지 (클릭 시 이미지 뷰어 팝업 오픈)
  - 메뉴명 (클릭 시 visit-log 저장 및 팝업 닫기)
  - 가격
  - 비고
  - 연필 아이콘 (메뉴 수정)
  - 삭제 아이콘 (메뉴 삭제)
- 플로팅 버튼 (+ 아이콘): 메뉴 등록 팝업 오픈

**데이터 경로**:
- 메뉴: `food-resv/restaurant/{식당ID}/menu`
- visit-log: `food-resv/visit-log/{사용자UID}/{식당ID}`

**접근 방법**:
- 식당 메뉴 페이지 → 식당 클릭

---

### 3. 이미지 뷰어 팝업
**파일 위치**: `app/rest-menu/rest-menu-client.tsx` (ImageViewDialog)

**기능**:
- 메뉴 이미지 전체 화면 표시
- 닫기 버튼

**접근 방법**:
- 식당 메뉴 팝업 → 썸네일 이미지 클릭

---

### 4. 메뉴 이력 팝업
**파일 위치**: `app/rest-menu/rest-menu-client.tsx` (메뉴 이력 Dialog)

**기능**:
- 식당별 메뉴 선택 이력 표시
- 날짜 역순 정렬
- 이력 삭제

**구조**:
- 타이틀: `{식당명}`
- 이력 목록:
  - 날짜 (yyyy.mm.dd 형식)
  - 메뉴명
  - 삭제 아이콘

**데이터 경로**:
- `food-resv/visit-log/{사용자UID}/{식당ID}`

**접근 방법**:
- 식당 메뉴 페이지 → 최근 메뉴 클릭

---

## 데이터 구조

### Restaurant 테이블
```
food-resv/restaurant/{식당ID}
  - name: 식당명
  - telNo: 전화번호
  - kind: 식당 종류
  - menuImgId: 메뉴 이미지 ID (Cloudinary)
  - menuUrl: 메뉴 페이지 URL
  - naviUrl: 식당 위치 (네이버 지도 검색어)
```

### Reservation 테이블
```
food-resv/reservation/{사용자UID}/{식당ID}/{예약일(yyyyMMdd)}
  - isReceipt: 수령여부 (true/false)
  - menus: [
      {
        menu: 메뉴명,
        cost: 금액
      }
    ]
```

### Prepayment 테이블
```
food-resv/prepayment/{사용자UID}/{식당ID}
  - [
      {
        amount: 금액,
        date: 날짜 (yyyyMMdd)
      }
    ]
```

### Menu 테이블
```
food-resv/restaurant/{식당ID}/menu/{menuKey}
  - name: 메뉴명
  - cost: 가격
  - img: Cloudinary 이미지 ID (mobile용)
  - thumbnail: Cloudinary 이미지 ID (thumbnail용)
  - remark: 비고
```

### Visit-log 테이블
```
food-resv/visit-log/{사용자UID}/{식당ID}/{logKey}
  - date: 날짜 (yyyyMMdd)
  - menuName: 메뉴명
```

### HideRestaurant 테이블
```
food-resv/hideRestaurant/{사용자UID}
  - [식당ID 배열]
```

### Theme 테이블
```
food-resv/theme/{사용자UID}
  - theme: 테마값 (white | black)
```

### Restaurant-kind 테이블
```
food-resv/restaurant-kind/{kind}
  - icon: Lucide 아이콘 이름
  - name: 종류 명칭
```

---

## 공통 기능

### 테마 적용
- 화이트 테마: 기본 배경색
- 블랙 테마: 검정색 배경, 실버색 텍스트
- 사용자별로 저장되어 페이지 전환 시에도 유지

### 알림 (Snackbar)
- 저장, 삭제, 수령 시 1초간 알림 표시

### 페이지 전환
- `router.replace()` 사용하여 history에 이력이 쌓이지 않도록 처리
- 타이틀 아이콘 클릭 또는 메뉴에서 페이지 선택

