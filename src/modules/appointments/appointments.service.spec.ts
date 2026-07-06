import { NotFoundException } from '@nestjs/common';
import { AppointmentsService } from './appointments.service';

describe('AppointmentsService', () => {
  const makeService = () => {
    const appointmentModel = {
      create: jest.fn(),
      findByPk: jest.fn(),
      findAndCountAll: jest.fn(),
      sequelize: {
        transaction: jest.fn(),
      },
    };
    const historyModel = { create: jest.fn() };
    const productModel = { findByPk: jest.fn() };
    const scheduling = { isSlotAvailable: jest.fn(), getAvailability: jest.fn() };
    const audit = { log: jest.fn() };
    const messaging = { enqueue: jest.fn() };

    const service = new AppointmentsService(
      appointmentModel as any,
      historyModel as any,
      productModel as any,
      scheduling as any,
      audit as any,
      messaging as any,
    );

    return { service, appointmentModel, historyModel, productModel, scheduling, audit, messaging };
  };

  it('creates an appointment for the requested patient when the actor is an admin', async () => {
    const { service, appointmentModel, historyModel, productModel, scheduling, audit, messaging } =
      makeService();

    productModel.findByPk.mockResolvedValue({
      id: 'product-1',
      durationMinutes: 45,
      price: 100,
      currency: 'BOB',
    });
    scheduling.isSlotAvailable.mockResolvedValue(true);
    appointmentModel.sequelize.transaction.mockImplementation(async (callback: any) => callback('tx'));
    appointmentModel.create.mockResolvedValue({ id: 'appt-1', toJSON: () => ({ id: 'appt-1' }) });

    await service.create(
      {
        sub: 'admin-1',
        email: 'admin@example.com',
        roles: ['ADMIN'],
        permissions: [],
        status: 'ACTIVE',
      },
      {
        therapistUserId: 'therapist-1',
        productId: 'product-1',
        scheduledStartAt: '2026-07-17T09:00:00.000Z',
        timezone: 'America/La_Paz',
        patientUserId: 'patient-1',
      } as any,
    );

    expect(appointmentModel.create).toHaveBeenCalledWith(
      expect.objectContaining({ patientUserId: 'patient-1' }),
      { transaction: 'tx' },
    );
    expect(historyModel.create).toHaveBeenCalled();
    expect(audit.log).toHaveBeenCalled();
    expect(messaging.enqueue).toHaveBeenCalled();
  });

  it('throws a structured not found when the therapy product does not exist', async () => {
    const { service, productModel } = makeService();
    productModel.findByPk.mockResolvedValue(null);

    await expect(
      service.create(
        {
          sub: 'patient-1',
          email: 'patient@example.com',
          roles: ['PATIENT'],
          permissions: [],
          status: 'ACTIVE',
        },
        {
          therapistUserId: 'therapist-1',
          productId: 'missing-product',
          scheduledStartAt: '2026-07-17T09:00:00.000Z',
          timezone: 'America/La_Paz',
        } as any,
      ),
    ).rejects.toMatchObject({ response: { code: 'THERAPY_PRODUCT_NOT_FOUND' } });
  });
});
