import { MessagingService } from './messaging.service';

const makeService = () => {
  const outboxModel = {
    create: jest.fn(),
    findByPk: jest.fn(),
    findAndCountAll: jest.fn(),
    update: jest.fn(),
  };
  const logModel = {
    create: jest.fn(),
    findAndCountAll: jest.fn(),
  };
  const sequelize = {
    transaction: jest.fn((cb: (tx: unknown) => unknown) => cb('tx')),
  };
  const config = { get: jest.fn() };
  const provider = { send: jest.fn() };

  const service = new MessagingService(
    outboxModel as any,
    logModel as any,
    sequelize as any,
    config as any,
    provider as any,
  );

  return { service, outboxModel, logModel, sequelize, config, provider };
};

describe('MessagingService', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('enqueue()', () => {
    it('creates an outbox record with PENDING status, priority 5, maxAttempts 6', async () => {
      const { service, outboxModel } = makeService();
      outboxModel.create.mockResolvedValue({ id: 'msg-1' });

      await service.enqueue({
        channel: 'EMAIL',
        recipient: 'patient@example.com',
        templateCode: 'WELCOME_PATIENT',
        payload: { email: 'patient@example.com' },
      });

      expect(outboxModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          channel: 'EMAIL',
          recipient: 'patient@example.com',
          templateCode: 'WELCOME_PATIENT',
          priority: 5,
          attempts: 0,
          maxAttempts: 6,
        }),
        { transaction: undefined },
      );
    });

    it('passes the caller transaction through when provided', async () => {
      const { service, outboxModel } = makeService();
      outboxModel.create.mockResolvedValue({ id: 'msg-2' });

      await service.enqueue(
        { channel: 'EMAIL', recipient: 'x@x.com', templateCode: 'T', payload: {} },
        { transaction: 'caller-tx' as any },
      );

      expect(outboxModel.create).toHaveBeenCalledWith(expect.anything(), {
        transaction: 'caller-tx',
      });
    });
  });
});
