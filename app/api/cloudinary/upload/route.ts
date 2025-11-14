import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

// Vercel 배포를 위해 Node.js runtime 명시
export const runtime = 'nodejs';

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

    // 환경 변수 확인 (서버 사이드에서는 NEXT_PUBLIC_ 접두사 없이 우선 사용)
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME || process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY || process.env.NEXT_PUBLIC_CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET || process.env.NEXT_PUBLIC_CLOUDINARY_API_SECRET;

    if (!cloudName || !apiKey || !apiSecret) {
      console.error('Cloudinary 환경 변수 누락:', {
        cloudName: !!cloudName,
        apiKey: !!apiKey,
        apiSecret: !!apiSecret,
      });
      return NextResponse.json(
        { error: 'Cloudinary 설정이 완료되지 않았습니다.' },
        { status: 500 }
      );
    }

    // 서명된 업로드를 위한 파라미터 준비
    // Cloudinary 서명 규칙: timestamp와 upload_preset을 포함하여 서명 생성
    const timestamp = Math.round(new Date().getTime() / 1000);
    
    // 서명에 포함할 파라미터 (알파벳 순으로 정렬 필요)
    const paramsToSign: Record<string, string> = {
      timestamp: timestamp.toString(),
    };

    // upload_preset이 제공된 경우 서명에 포함
    if (uploadPreset) {
      paramsToSign.upload_preset = uploadPreset;
    }

    // Cloudinary 서명 생성 규칙:
    // 1. 파라미터를 알파벳 순으로 정렬
    // 2. key=value 형식으로 연결 (앰퍼샌드로 구분)
    // 3. API secret을 끝에 추가
    // 4. SHA-1 해시 생성
    const sortedKeys = Object.keys(paramsToSign).sort();
    const paramsString = sortedKeys
      .map((key) => `${key}=${paramsToSign[key]}`)
      .join('&');
    
    const signatureString = paramsString + apiSecret;
    const signature = crypto
      .createHash('sha1')
      .update(signatureString)
      .digest('hex');

    // 디버깅용 로그 (개발 환경에서만)
    if (process.env.NODE_ENV === 'development') {
      console.log('Cloudinary 서명 생성:');
      console.log('Params to sign:', paramsString);
      console.log('Signature:', signature);
      console.log('Upload preset:', uploadPreset);
    }

    // 파일을 ArrayBuffer로 변환
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Cloudinary API에 전송할 FormData 생성
    // Node.js 환경에서는 파일을 직접 전송하는 것이 더 안정적
    const uploadFormData = new FormData();
    
    // 파일을 File 객체로 직접 추가 (Node.js 18+에서 지원)
    // 또는 Blob으로 변환하여 추가
    const fileBlob = new Blob([buffer], { type: file.type || 'image/jpeg' });
    uploadFormData.append('file', fileBlob, file.name || 'image');
    
    // 필수 파라미터 추가
    uploadFormData.append('timestamp', timestamp.toString());
    uploadFormData.append('api_key', apiKey);
    uploadFormData.append('signature', signature);
    
    // upload_preset 추가 (signed 프리셋인 경우 필수)
    if (uploadPreset) {
      uploadFormData.append('upload_preset', uploadPreset);
    }

    // Cloudinary API에 업로드
    const uploadUrl = `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`;
    
    let response: Response;
    try {
      response = await fetch(uploadUrl, {
        method: 'POST',
        body: uploadFormData,
      });
    } catch (fetchError) {
      console.error('Cloudinary API fetch 오류:', fetchError);
      const errorDetails = fetchError instanceof Error ? fetchError.message : String(fetchError);
      return NextResponse.json(
        { error: `Cloudinary 서버에 연결할 수 없습니다: ${errorDetails}` },
        { status: 503 }
      );
    }

    let data: any;
    try {
      data = await response.json();
    } catch (jsonError) {
      console.error('Cloudinary 응답 JSON 파싱 오류:', jsonError);
      const responseText = await response.text().catch(() => '응답을 읽을 수 없습니다');
      console.error('응답 본문:', responseText);
      return NextResponse.json(
        { error: `Cloudinary 응답을 처리할 수 없습니다. (${response.status})` },
        { status: response.status || 500 }
      );
    }

    if (!response.ok) {
      // Cloudinary 오류 응답을 더 자세히 로깅
      console.error('Cloudinary API 오류:', {
        status: response.status,
        statusText: response.statusText,
        data: data,
        errorMessage: data.error?.message,
        error: data.error,
      });
      
      // 오류 메시지를 더 구체적으로 반환
      const errorMessage = data.error?.message || data.error || `업로드 실패 (${response.status})`;
      return NextResponse.json(
        { error: errorMessage },
        { status: response.status }
      );
    }

    // 성공 응답 반환
    return NextResponse.json({
      public_id: data.public_id,
      secure_url: data.secure_url,
      url: data.url,
      eager: data.eager,
      width: data.width,
      height: data.height,
    });
  } catch (error) {
    console.error('Cloudinary 업로드 오류:', error);
    const errorMessage = error instanceof Error ? error.message : '이미지 업로드 중 오류가 발생했습니다.';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

