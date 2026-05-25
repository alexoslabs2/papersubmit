import type { FastifyPluginAsync } from 'fastify';
import type { EventUpdateInput } from '../services/events.js';
import { getSingleEvent, publicEvent, updateEvent } from '../services/events.js';

const eventLongTextMaxLength = 1000;

const eventBodySchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    name: { type: 'string', maxLength: 200 },
    slug: { type: 'string', maxLength: 200 },
    location: { anyOf: [{ type: 'string', maxLength: 255 }, { type: 'null' }] },
    startDate: { type: 'string', format: 'date-time' },
    endDate: { type: 'string', format: 'date-time' },
    timezone: { type: 'string', maxLength: 128 },
    description: { anyOf: [{ type: 'string', maxLength: eventLongTextMaxLength }, { type: 'null' }] },
    codeOfConduct: { anyOf: [{ type: 'string', maxLength: eventLongTextMaxLength }, { type: 'null' }] },
    cfpOpensAt: { type: 'string', format: 'date-time' },
    cfpClosesAt: { type: 'string', format: 'date-time' },
    cfpDescription: { anyOf: [{ type: 'string', maxLength: eventLongTextMaxLength }, { type: 'null' }] },
    talkFormats: {
      type: 'array',
      minItems: 1,
      uniqueItems: true,
      items: { type: 'string', enum: ['talk', 'lightning', 'workshop'] }
    },
    scoringScale: { type: 'string', enum: ['SCALE_1_5', 'SCALE_1_10'] },
    minReviewsRequired: { type: 'integer', minimum: 1 },
    travelAssistance: { anyOf: [{ type: 'string', maxLength: 100 }, { type: 'null' }] },
    status: { type: 'string', enum: ['draft', 'open', 'reviewing', 'closed'] }
  }
};

export const eventRoutes: FastifyPluginAsync = async (app) => {
  app.get('/event', {
    schema: {
      tags: ['event'],
      response: {
        200: {
          type: 'object',
          properties: { event: { type: 'object', additionalProperties: true } }
        }
      }
    }
  }, async (_request, reply) => {
    const event = await getSingleEvent(app.app.db);
    if (!event) return reply.notFound('Event is not configured');
    return { event: publicEvent(event) };
  });

  app.patch('/event', {
    preHandler: app.requireRole(['admin']),
    schema: {
      tags: ['event'],
      body: eventBodySchema
    }
  }, async (request, reply) => {
    try {
      const event = await updateEvent(app.app.db, request.body as EventUpdateInput, request.user!.id);
      return { event: publicEvent(event) };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Event update failed';
      if (message === 'Event is not configured') return reply.notFound(message);
      return reply.badRequest(message);
    }
  });
};
