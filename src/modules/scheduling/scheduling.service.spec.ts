import { SchedulingService } from './scheduling.service';

// UUIDs are required — normalizeAvailabilityQuery validates format
const THERAPIST_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
const PRODUCT_ID = 'b1fb3dd7-73c0-4a53-8a7e-78a22d6a9f4c';

const makeService = () => {
  const scheduleModel = { findAll: jest.fn(), create: jest.fn(), findByPk: jest.fn() };
  const blockedModel = { findOne: jest.fn(), findAll: jest.fn(), create: jest.fn() };
  const appointmentModel = { findOne: jest.fn(), findAll: jest.fn() };
  const productModel = { findByPk: jest.fn() };
  const therapistProfileModel = { findOne: jest.fn() };
  const therapistProductModel = { findOne: jest.fn(), findAll: jest.fn() };
  const userModel = { findByPk: jest.fn() };
  const fileModel = { findByPk: jest.fn() };
  const audit = { log: jest.fn() };

  const service = new SchedulingService(
    scheduleModel as any,
    blockedModel as any,
    appointmentModel as any,
    productModel as any,
    therapistProfileModel as any,
    therapistProductModel as any,
    userModel as any,
    fileModel as any,
    audit as any,
  );

  return {
    service,
    scheduleModel,
    blockedModel,
    appointmentModel,
    productModel,
    therapistProfileModel,
    therapistProductModel,
    userModel,
    fileModel,
    audit,
  };
};

describe('SchedulingService', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('isSlotAvailable()', () => {
    it('returns true when no overlapping appointment or block exists', async () => {
      const { service, appointmentModel, blockedModel } = makeService();
      appointmentModel.findOne.mockResolvedValue(null);
      blockedModel.findOne.mockResolvedValue(null);

      const result = await service.isSlotAvailable(
        THERAPIST_ID,
        new Date('2026-07-21T09:00:00Z'),
        new Date('2026-07-21T10:00:00Z'),
      );

      expect(result).toBe(true);
    });

    it('returns false when an overlapping appointment exists', async () => {
      const { service, appointmentModel, blockedModel } = makeService();
      appointmentModel.findOne.mockResolvedValue({ id: 'existing-appt' });
      blockedModel.findOne.mockResolvedValue(null);

      const result = await service.isSlotAvailable(
        THERAPIST_ID,
        new Date('2026-07-21T09:00:00Z'),
        new Date('2026-07-21T10:00:00Z'),
      );

      expect(result).toBe(false);
    });

    it('returns false when a blocked time overlaps the slot', async () => {
      const { service, appointmentModel, blockedModel } = makeService();
      appointmentModel.findOne.mockResolvedValue(null);
      blockedModel.findOne.mockResolvedValue({ id: 'block-1' });

      const result = await service.isSlotAvailable(
        THERAPIST_ID,
        new Date('2026-07-21T09:00:00Z'),
        new Date('2026-07-21T10:00:00Z'),
      );

      expect(result).toBe(false);
    });
  });

  describe('getAvailability()', () => {
    it('throws THERAPY_PRODUCT_NOT_FOUND when the product does not exist', async () => {
      const { service, productModel } = makeService();
      productModel.findByPk.mockResolvedValue(null);

      await expect(
        service.getAvailability({
          therapistUserId: THERAPIST_ID,
          productId: PRODUCT_ID,
          from: '2026-07-21',
          to: '2026-07-21',
          timezone: 'America/La_Paz',
        }),
      ).rejects.toMatchObject({ response: { code: 'THERAPY_PRODUCT_NOT_FOUND' } });
    });

    it('throws AVAILABILITY_RANGE_TOO_LONG when range exceeds 31 days', async () => {
      const { service, productModel } = makeService();
      productModel.findByPk.mockResolvedValue({ id: PRODUCT_ID, durationMinutes: 60 });

      await expect(
        service.getAvailability({
          therapistUserId: THERAPIST_ID,
          productId: PRODUCT_ID,
          from: '2026-07-01',
          to: '2026-09-01',
          timezone: 'America/La_Paz',
        }),
      ).rejects.toMatchObject({ response: { code: 'AVAILABILITY_RANGE_TOO_LONG' } });
    });

    it('returns empty slots with reason when therapist has no active schedules', async () => {
      const { service, productModel, scheduleModel } = makeService();
      productModel.findByPk.mockResolvedValue({ id: PRODUCT_ID, durationMinutes: 60 });
      scheduleModel.findAll.mockResolvedValue([]);

      const result = await service.getAvailability({
        therapistUserId: THERAPIST_ID,
        productId: PRODUCT_ID,
        from: '2026-07-21',
        to: '2026-07-21',
        timezone: 'America/La_Paz',
      });

      expect(result.slots).toHaveLength(0);
      expect(result.reason).toBe('THERAPIST_HAS_NO_ACTIVE_SCHEDULES');
    });
  });
});
