import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { FastifyPluginAsync } from 'fastify';
import sharp from 'sharp';
import { v7 as uuidv7 } from 'uuid';
import { audit } from '../services/audit.js';
import { getSingleEvent } from '../services/events.js';
import { eventLogoUploadDir } from '../uploads/paths.js';

function isAcceptedImage(buffer: Buffer): boolean {
  const jpeg = buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  const png = buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  return jpeg || png;
}

export const uploadRoutes: FastifyPluginAsync = async (app) => {
  app.post('/event/logo', { preHandler: app.requireRole(['admin']) }, async (request, reply) => {
    const file = await request.file();
    if (!file) return reply.badRequest('Logo file is required');
    const buffer = await file.toBuffer();
    if (buffer.length > 2 * 1024 * 1024 || !isAcceptedImage(buffer)) return reply.badRequest('Logo must be JPEG or PNG and at most 2 MB');
    const event = await getSingleEvent(app.app.db);
    if (!event) return reply.notFound('Event not found');
    const uploadDir = eventLogoUploadDir();
    await fs.mkdir(uploadDir, { recursive: true });
    const filename = `${uuidv7()}.webp`;
    const target = path.join(uploadDir, filename);
    await sharp(buffer).rotate().resize(400, 400, { fit: 'cover' }).webp().toFile(target);
    if (event.logo_path) {
      await fs.unlink(path.join(uploadDir, event.logo_path)).catch(() => undefined);
    }
    await app.app.db.updateTable('event').set({ logo_path: filename }).where('id', '=', event.id).execute();
    await audit(app.app.db, request.user!.id, 'event.logo_uploaded', 'event', String(event.id));
    return { logoUrl: `/uploads/event-logo/${filename}` };
  });
};
