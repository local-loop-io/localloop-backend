import { S3Client } from '@aws-sdk/client-s3';
import { config } from '../config';

export const s3Client = new S3Client({
  region: 'us-east-1',
  endpoint: `${config.minio.useSSL ? 'https' : 'http'}://${config.minio.endpoint}:${config.minio.port}`,
  forcePathStyle: true,
  credentials: {
    accessKeyId: config.minio.accessKey,
    secretAccessKey: config.minio.secretKey,
  },
});
