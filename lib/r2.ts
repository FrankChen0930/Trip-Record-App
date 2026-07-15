import { S3Client } from '@aws-sdk/client-s3';

// 伺服器端專用的 Cloudflare R2 client。
// R2 secret 只存在 Vercel / .env.local 的環境變數，絕不進前端 bundle —
// 前端一律透過 /api/photos/* Route Handler 取得 presigned URL 後直傳。
export const R2_BUCKET = process.env.R2_BUCKET ?? 'trip-photos';

let client: S3Client | null = null;

export function getR2Client(): S3Client {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error('R2 環境變數未設定（R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY）');
  }
  client ??= new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });
  return client;
}
