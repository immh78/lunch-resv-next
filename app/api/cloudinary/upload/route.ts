import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const uploadPreset = formData.get('upload_preset') as string;
    const eager = formData.get('eager') as string | null;

    if (!file) {
      return NextResponse.json(
        { error: '파일이 제공되지 않았습니다.' },
        { status: 400 }
      );
    }

    const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.NEXT_PUBLIC_CLOUDINARY_API_KEY;
    const apiSecret = process.env.NEXT_PUBLIC_CLOUDINARY_API_SECRET;

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

    // eager 변환 추가
    if (eager) {
      params.eager = eager;
    }

    // upload_preset이 제공된 경우 추가 (signed 프리셋인 경우)
    if (uploadPreset) {
      params.upload_preset = uploadPreset;
    }

    // 서명 생성: 파라미터를 정렬하여 문자열로 변환 후 SHA-1 해시
    const sortedParams = Object.keys(params)
      .sort()
      .map((key) => `${key}=${params[key]}`)
      .join('&');
    
    const signatureString = sortedParams + apiSecret;
    const signature = crypto
      .createHash('sha1')
      .update(signatureString)
      .digest('hex');

    // Cloudinary에 업로드할 FormData 생성
    const uploadFormData = new FormData();
    uploadFormData.append('file', file);
    uploadFormData.append('timestamp', timestamp.toString());
    uploadFormData.append('api_key', apiKey);
    uploadFormData.append('signature', signature);
    
    if (uploadPreset) {
      uploadFormData.append('upload_preset', uploadPreset);
    }
    
    if (eager) {
      uploadFormData.append('eager', eager);
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

