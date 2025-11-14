import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const uploadPreset = formData.get('upload_preset') as string;

    if (!file) {
      return NextResponse.json(
        { error: '파일이 제공되지 않았습니다.' },
        { status: 400 }
      );
    }

    // 서버 사이드에서는 NEXT_PUBLIC_ 접두사 없이 환경 변수 사용
    const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY || process.env.NEXT_PUBLIC_CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET || process.env.NEXT_PUBLIC_CLOUDINARY_API_SECRET;

    if (!cloudName || !apiKey || !apiSecret) {
      return NextResponse.json(
        { error: 'Cloudinary 설정이 완료되지 않았습니다.' },
        { status: 500 }
      );
    }

    // 서명된 업로드를 위한 파라미터 준비
    const timestamp = Math.round(new Date().getTime() / 1000);
    const params: Record<string, string> = {
      timestamp: timestamp.toString(),
    };

    // upload_preset이 제공된 경우 추가 (signed 프리셋인 경우)
    if (uploadPreset) {
      params.upload_preset = uploadPreset;
    }

    // 서명 생성: 파라미터를 알파벳 순으로 정렬하여 문자열로 변환 후 SHA-1 해시
    // Cloudinary 서명 규칙: 파라미터를 알파벳 순으로 정렬하고 key=value 형식으로 연결
    const sortedKeys = Object.keys(params).sort();
    const paramsToSign = sortedKeys
      .map((key) => `${key}=${params[key]}`)
      .join('&');
    
    // API secret을 끝에 추가하여 서명 생성
    const signatureString = paramsToSign + apiSecret;
    const signature = crypto
      .createHash('sha1')
      .update(signatureString)
      .digest('hex');

    // 디버깅용 로그 (개발 환경에서만)
    if (process.env.NODE_ENV === 'development') {
      console.log('Cloudinary 서명 생성:');
      console.log('Params to sign:', paramsToSign);
      console.log('Signature:', signature);
    }

    // Cloudinary에 업로드할 FormData 생성
    const uploadFormData = new FormData();
    uploadFormData.append('file', file);
    uploadFormData.append('timestamp', timestamp.toString());
    uploadFormData.append('api_key', apiKey);
    uploadFormData.append('signature', signature);
    
    if (uploadPreset) {
      uploadFormData.append('upload_preset', uploadPreset);
    }

    // Cloudinary API에 업로드
    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
      {
        method: 'POST',
        body: uploadFormData,
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { error: data.error?.message || '이미지 업로드에 실패했습니다.' },
        { status: response.status }
      );
    }

    return NextResponse.json({
      public_id: data.public_id,
      secure_url: data.secure_url,
      eager: data.eager,
    });
  } catch (error) {
    console.error('Cloudinary 업로드 오류:', error);
    return NextResponse.json(
      { error: '이미지 업로드 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

