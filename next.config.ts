import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 번들에 넣지 않고 Node에서 로드 (firebase-admin/app 등 서브패스 해석 안정화)
  serverExternalPackages: ["firebase-admin"],
};

export default nextConfig;
