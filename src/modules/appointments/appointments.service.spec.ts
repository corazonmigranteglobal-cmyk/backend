import { TraceContextService } from '@/observability/trace-context.service';
import { TracingService } from '@/observability/tracing.service';
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
    const userModel = { findByPk: jest.fn().mockResolvedValue(null) };
    const scheduling = { isSlotAvailable: jest.fn(), getAvailability: jest.fn() };
    const audit = { log: jest.fn() };
    const messaging = { enqueue: jest.fn() };
    const notifications = { emit: jest.fn().mockResolvedValue(undefined) };

    const service = new AppointmentsService(
      appointmentModel as any,
      historyModel as any,
      productModel as any,
      userModel as any,
      scheduling as any,
      audit as any,
      messaging as any,
      notifications as any,
      // Sin SDK activo los spans son no-op: se usa el servicio real.
      new TracingService(new TraceContextService()),
    );

    return {
      service,
      appointmentModel,
      historyModel,
      productModel,
      userModel,
      scheduling,
      audit,
      messaging,
      notifications,
    };
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
    appointmentModel.sequelize.transaction.mockImplementation(async (callback: any) =>
      callback('tx'),
    );
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

  it('rejects a patient trying to book on behalf of another patient', async () => {
    const { service, appointmentModel, productModel, scheduling } = makeService();

    productModel.findByPk.mockResolvedValue({
      id: 'product-1',
      durationMinutes: 45,
      price: 100,
      currency: 'BOB',
    });
    scheduling.isSlotAvailable.mockResolvedValue(true);

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
          productId: 'product-1',
          scheduledStartAt: '2026-07-17T09:00:00.000Z',
          timezone: 'America/La_Paz',
          patientUserId: 'victim-1',
        } as any,
      ),
    ).rejects.toMatchObject({
      response: { code: 'APPOINTMENT_ASSISTED_BOOKING_FORBIDDEN' },
    });
    expect(appointmentModel.create).not.toHaveBeenCalled();
  });

  it('sends the booking email to the patient, not to the admin who registered it', async () => {
    const { service, appointmentModel, productModel, scheduling, messaging, userModel } =
      makeService();

    productModel.findByPk.mockResolvedValue({
      id: 'product-1',
      durationMinutes: 45,
      price: 100,
      currency: 'BOB',
    });
    userModel.findByPk.mockResolvedValue({ email: 'paciente@example.com' });
    scheduling.isSlotAvailable.mockResolvedValue(true);
    appointmentModel.sequelize.transaction.mockImplementation(async (callback: any) =>
      callback('tx'),
    );
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

    expect(messaging.enqueue).toHaveBeenCalledWith(
      expect.objectContaining({ recipient: 'paciente@example.com' }),
      { transaction: 'tx' },
    );
  });

  it('does not let a failing domain event reject the completed booking', async () => {
    const { service, appointmentModel, productModel, scheduling, notifications } = makeService();

    productModel.findByPk.mockResolvedValue({
      id: 'product-1',
      durationMinutes: 45,
      price: 100,
      currency: 'BOB',
    });
    scheduling.isSlotAvailable.mockResolvedValue(true);
    appointmentModel.sequelize.transaction.mockImplementation(async (callback: any) =>
      callback('tx'),
    );
    appointmentModel.create.mockResolvedValue({ id: 'appt-1', toJSON: () => ({ id: 'appt-1' }) });
    notifications.emit.mockRejectedValue(new Error('bus caído'));

    await expect(
      service.create(
        {
          sub: 'patient-1',
          email: 'p@example.com',
          roles: ['PATIENT'],
          permissions: [],
          status: 'ACTIVE',
        },
        {
          therapistUserId: 'therapist-1',
          productId: 'product-1',
          scheduledStartAt: '2026-07-17T09:00:00.000Z',
          timezone: 'America/La_Paz',
        } as any,
      ),
    ).resolves.toMatchObject({ id: 'appt-1' });
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

  it('emits domain event after successful appointment creation', async () => {
    const { service, appointmentModel, productModel, scheduling, notifications } = makeService();

    productModel.findByPk.mockResolvedValue({
      id: 'product-1',
      durationMinutes: 45,
      price: 100,
      currency: 'BOB',
    });
    scheduling.isSlotAvailable.mockResolvedValue(true);
    appointmentModel.sequelize.transaction.mockImplementation(async (callback: any) =>
      callback('tx'),
    );
    appointmentModel.create.mockResolvedValue({ id: 'appt-1', toJSON: () => ({ id: 'appt-1' }) });

    await service.create(
      {
        sub: 'patient-1',
        email: 'p@example.com',
        roles: ['PATIENT'],
        permissions: [],
        status: 'ACTIVE',
      },
      {
        therapistUserId: 'therapist-1',
        productId: 'product-1',
        scheduledStartAt: '2026-07-17T09:00:00.000Z',
        timezone: 'America/La_Paz',
      } as any,
    );

    expect(notifications.emit).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'APPOINTMENT_REQUESTED', entityType: 'Appointment' }),
    );
  });
});
