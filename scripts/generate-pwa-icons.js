/* eslint-disable @typescript-eslint/no-require-imports */
// PWA 아이콘 생성 스크립트
// Node.js 환경에서 실행: node scripts/generate-pwa-icons.js

const fs = require('fs');
const path = require('path');

// 간단한 Restaurant 아이콘 SVG (Material Icons 스타일)
const svgIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="512" height="512">
  <path d="M8.1 13.34l2.83-2.83L3.91 3.5c-1.56 1.56-1.56 4.09 0 5.66l4.19 4.18zm6.78-1.81c1.53.71 3.68.21 5.27-1.38 1.91-1.91 2.28-4.65.81-6.12-1.46-1.46-4.2-1.1-6.12.81-1.59 1.59-2.09 3.74-1.38 5.27L3.7 19.87l1.41 1.41L12 14.41l6.88 6.88 1.41-1.41L13.41 13l1.47-1.47z" fill="#000000"/>
</svg>`;

// SVG 파일 저장
const publicDir = path.join(__dirname, '..', 'public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

fs.writeFileSync(path.join(publicDir, 'restaurant-icon-source.svg'), svgIcon);

console.log('SVG 아이콘 파일이 생성되었습니다: public/restaurant-icon-source.svg');
console.log('이 SVG 파일을 온라인 도구를 사용하여 PNG로 변환하세요:');
console.log('1. https://cloudconvert.com/svg-to-png');
console.log('2. https://convertio.co/kr/svg-png/');
console.log('3. 또는 브라우저에서 public/generate-icons.html 파일을 열어 아이콘을 생성하세요.');

