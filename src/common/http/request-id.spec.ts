import { resolveRequestId } from './request-id';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe('resolveRequestId', () => {
  it('keeps a plausible correlation id sent by the client', () => {
    expect(resolveRequestId('req-2026-07-30_abc.123')).toBe('req-2026-07-30_abc.123');
  });

  it('takes the first entry when the header arrives repeated', () => {
    expect(resolveRequestId(['first-id', 'second-id'])).toBe('first-id');
  });

  it('discards values with newlines so they cannot forge log entries', () => {
    const forged = 'ok\n{"event":"ADMIN_LOGIN","user":"attacker"}';
    expect(resolveRequestId(forged)).not.toBe(forged);
    expect(resolveRequestId(forged)).toMatch(UUID_PATTERN);
  });

  it('discards values with characters invalid in a header', () => {
    expect(resolveRequestId('bad\r\nX-Admin: true')).toMatch(UUID_PATTERN);
  });

  it('discards oversized values', () => {
    expect(resolveRequestId('a'.repeat(129))).toMatch(UUID_PATTERN);
  });

  it('generates an id when the header is absent or not a string', () => {
    expect(resolveRequestId(undefined)).toMatch(UUID_PATTERN);
    expect(resolveRequestId('')).toMatch(UUID_PATTERN);
    expect(resolveRequestId(42)).toMatch(UUID_PATTERN);
  });
});
