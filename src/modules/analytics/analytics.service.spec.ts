import { getModelToken } from '@nestjs/sequelize';
import { Test } from '@nestjs/testing';
import { PublicVisit, UiEvent } from '@/database/models';
import { AnalyticsService } from './analytics.service';

describe('AnalyticsService', () => {
  let service: AnalyticsService;

  const visitModel = { create: jest.fn() };
  const eventModel = {
    create: jest.fn(),
    findAndCountAll: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        AnalyticsService,
        { provide: getModelToken(PublicVisit), useValue: visitModel },
        { provide: getModelToken(UiEvent), useValue: eventModel },
      ],
    }).compile();
    service = module.get(AnalyticsService);
  });

  describe('trackVisit()', () => {
    it('creates a visit record', async () => {
      visitModel.create.mockResolvedValue({ id: 'v1' });
      const result = await service.trackVisit({ path: '/home', ip: '1.2.3.4' });
      expect(visitModel.create).toHaveBeenCalledWith(expect.objectContaining({ path: '/home' }));
      expect(result).toEqual({ id: 'v1' });
    });

    it('hashes IP and userAgent before persisting', async () => {
      visitModel.create.mockResolvedValue({});
      await service.trackVisit({ path: '/about', ip: '10.0.0.1', userAgent: 'Mozilla/5.0' });
      const arg = visitModel.create.mock.calls[0][0];
      // hashed values are not the raw strings
      expect(arg.ipHash).toBeDefined();
      expect(arg.ipHash).not.toBe('10.0.0.1');
      expect(arg.userAgentHash).toBeDefined();
      expect(arg.userAgentHash).not.toBe('Mozilla/5.0');
    });

    it('omits ipHash and userAgentHash when not provided', async () => {
      visitModel.create.mockResolvedValue({});
      await service.trackVisit({ path: '/blog' });
      const arg = visitModel.create.mock.calls[0][0];
      expect(arg.ipHash).toBeUndefined();
      expect(arg.userAgentHash).toBeUndefined();
    });
  });

  describe('trackUiEvent()', () => {
    it('creates a UI event record', async () => {
      eventModel.create.mockResolvedValue({ id: 'e1' });
      await service.trackUiEvent({ sessionId: 'sess-1', eventName: 'CLICK_HERO' });
      expect(eventModel.create).toHaveBeenCalledWith(
        expect.objectContaining({ sessionId: 'sess-1', eventName: 'CLICK_HERO' }),
      );
    });

    it('defaults payload to empty object when not provided', async () => {
      eventModel.create.mockResolvedValue({});
      await service.trackUiEvent({ sessionId: 'sess-1', eventName: 'PAGE_VIEW' });
      const arg = eventModel.create.mock.calls[0][0];
      expect(arg.payload).toEqual({});
    });

    it('persists custom payload when provided', async () => {
      eventModel.create.mockResolvedValue({});
      await service.trackUiEvent({
        sessionId: 'sess-1',
        eventName: 'BOOK_CLICK',
        payload: { therapistId: 't-42' },
      });
      const arg = eventModel.create.mock.calls[0][0];
      expect(arg.payload).toEqual({ therapistId: 't-42' });
    });
  });

  describe('listEvents()', () => {
    it('returns paginated event list', async () => {
      eventModel.findAndCountAll.mockResolvedValue({
        rows: [{ id: 'e1' }],
        count: 1,
      });
      const result = await service.listEvents({ page: 1, limit: 10 } as any);
      expect(result.items).toHaveLength(1);
      expect(result.pagination).toBeDefined();
    });
  });
});
