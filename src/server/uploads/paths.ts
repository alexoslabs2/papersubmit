import path from 'node:path';

export function eventLogoUploadDir(): string {
  return process.env.NODE_ENV === 'production' ? '/app/uploads/event-logo' : path.resolve(process.cwd(), 'uploads/event-logo');
}
