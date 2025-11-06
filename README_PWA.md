# PWA 아이콘 생성 가이드

PWA 기능을 활성화하기 위해 다음 아이콘 파일들이 필요합니다:

## 필요한 아이콘 파일

1. `/public/icon-192.png` - 192x192 픽셀
2. `/public/icon-512.png` - 512x512 픽셀

## 아이콘 생성 방법

`restaurant-icon.svg` 파일을 기반으로 PWA 아이콘을 생성합니다.

### 방법 1: 브라우저 도구 사용 (권장)
1. 브라우저에서 `public/create-pwa-icons.html` 파일을 엽니다
2. 페이지가 로드되면 자동으로 아이콘이 생성됩니다
3. "Download icon-192.png"와 "Download icon-512.png" 버튼을 클릭합니다
4. 다운로드한 파일을 `public` 폴더에 저장합니다

### 방법 2: 온라인 도구 사용
1. `public/restaurant-icon.svg` 파일을 업로드합니다
2. 온라인 PWA 아이콘 생성기 사용:
   - https://www.pwabuilder.com/imageGenerator
   - https://realfavicongenerator.net/
   - https://www.favicon-generator.org/
3. 192x192와 512x512 크기로 변환하여 다운로드합니다

### 아이콘 요구사항
- 형식: PNG
- 크기: 192x192, 512x512
- 배경: 투명 또는 흰색
- 스타일: 메인화면 타이틀의 RestaurantIcon과 동일한 컬러 스타일
- Maskable: 둥근 모서리 대응 (선택사항)

## 삼성 인터넷 브라우저 지원

삼성 인터넷 브라우저에서도 PWA 설치가 가능하도록 `manifest.json`에 다음 설정이 포함되어 있습니다:
- `display: "standalone"`
- 적절한 아이콘 크기 (192x192, 512x512)
- `purpose: "any maskable"` 설정

## 설치 확인

아이콘 파일을 생성한 후:
1. 개발 서버 재시작
2. 모바일 브라우저에서 접속
3. 브라우저 메뉴에서 "홈 화면에 추가" 또는 "앱 설치" 옵션 확인

