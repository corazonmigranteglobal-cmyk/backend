import { ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import {
  ForeignKeyConstraintError,
  UniqueConstraintError,
  ValidationError as SequelizeValidationError,
} from 'sequelize';
import { HttpExceptionFilter } from './http-exception.filter';

function makeHost(json: jest.Mock, status: jest.Mock) {
  return {
    switchToHttp: () => ({
      getResponse: () => ({ status, json }),
      getRequest: () => ({
        headers: { 'x-request-id': 'test-rid' },
        method: 'GET',
        originalUrl: '/test',
      }),
    }),
  } as unknown as ArgumentsHost;
}

describe('HttpExceptionFilter', () => {
  let filter: HttpExceptionFilter;
  let json: jest.Mock;
  let statusFn: jest.Mock;
  let host: ArgumentsHost;

  beforeEach(() => {
    filter = new HttpExceptionFilter();
    json = jest.fn();
    statusFn = jest.fn().mockReturnValue({ json });
    host = makeHost(json, statusFn);
  });

  it('handles HttpException with string body', () => {
    filter.catch(new HttpException('Not found', 404), host);
    expect(statusFn).toHaveBeenCalledWith(404);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.objectContaining({ message: 'Not found' }) }),
    );
  });

  it('handles HttpException with object body', () => {
    filter.catch(
      new HttpException({ code: 'MY_CODE', message: 'Custom msg', details: ['d1'] }, 422),
      host,
    );
    expect(statusFn).toHaveBeenCalledWith(422);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({ code: 'MY_CODE', message: 'Custom msg', details: ['d1'] }),
      }),
    );
  });

  it('handles UniqueConstraintError as 409', () => {
    const err = Object.assign(new UniqueConstraintError({ errors: [] }), {
      fields: { email: 'x' },
    });
    filter.catch(err, host);
    expect(statusFn).toHaveBeenCalledWith(HttpStatus.CONFLICT);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({ code: 'RESOURCE_ALREADY_EXISTS' }),
      }),
    );
  });

  it('handles ForeignKeyConstraintError as 409', () => {
    filter.catch(new ForeignKeyConstraintError({}), host);
    expect(statusFn).toHaveBeenCalledWith(HttpStatus.CONFLICT);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({ code: 'RESOURCE_REFERENCE_CONFLICT' }),
      }),
    );
  });

  it('handles SequelizeValidationError as 400', () => {
    filter.catch(
      new SequelizeValidationError('Validation error', [{ message: 'field required' } as never]),
      host,
    );
    expect(statusFn).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
  });

  it('handles http-errors style object (status 413)', () => {
    filter.catch({ status: 413, message: 'too large' } as unknown as Error, host);
    expect(statusFn).toHaveBeenCalledWith(413);
  });

  it('handles unknown errors as 500', () => {
    filter.catch(new Error('unexpected'), host);
    expect(statusFn).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({ code: 'INTERNAL_SERVER_ERROR' }),
      }),
    );
  });

  it('includes requestId in meta', () => {
    filter.catch(new HttpException('err', 400), host);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ meta: expect.objectContaining({ requestId: 'test-rid' }) }),
    );
  });
});
