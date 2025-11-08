import { Buffer } from 'node:buffer';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

const IMAGEKIT_UPLOAD_ENDPOINT = 'https://upload.imagekit.io/api/v1/files/upload';
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

export async function POST(request: Request) {
  try {
    const privateKey = process.env.NEXT_PRIVATE_IMAGEKIT;
    const urlEndpoint = process.env.NEXT_PUBLIC_IMAGEKIT;

    if (!privateKey || !urlEndpoint) {
      return NextResponse.json(
        { error: 'ImageKit 환경 변수가 설정되어 있지 않습니다.' },
        { status: 500 }
      );
    }

    const requestFormData = await request.formData();
    const file = requestFormData.get('file');

    if (!(file instanceof File)) {
      return NextResponse.json({ error: '업로드할 파일이 필요합니다.' }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: '최대 5MB까지 업로드할 수 있습니다.' }, { status: 400 });
    }

    const fileBuffer = await file.arrayBuffer();
    const uploadFormData = new FormData();
    uploadFormData.append(
      'file',
      new Blob([fileBuffer], { type: file.type || 'application/octet-stream' }),
      file.name
    );
    uploadFormData.append('fileName', file.name);
    uploadFormData.append('folder', 'restaurants');

    const response = await fetch(IMAGEKIT_UPLOAD_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${privateKey}:`).toString('base64')}`,
      },
      body: uploadFormData,
    });

    const payload = await response.json();

    if (!response.ok) {
      const message =
        typeof payload?.message === 'string'
          ? payload.message
          : '이미지 업로드 중 오류가 발생했습니다.';
      return NextResponse.json({ error: message }, { status: response.status });
    }

    const trimmedPath =
      typeof payload?.filePath === 'string' ? payload.filePath.replace(/^\//, '') : '';
    const normalizedEndpoint = urlEndpoint.replace(/\/$/, '');
    const url =
      typeof payload?.url === 'string' && payload.url.length > 0
        ? payload.url
        : trimmedPath
          ? `${normalizedEndpoint}/${trimmedPath}`
          : '';

    return NextResponse.json(
      {
        fileId: payload.fileId,
        filePath: trimmedPath,
        url,
        name: payload.name,
        size: payload.size,
        width: payload.width,
        height: payload.height,
        thumbnailUrl: payload.thumbnailUrl,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('ImageKit upload error', error);
    return NextResponse.json(
      { error: '이미지 업로드 중 예기치 않은 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
