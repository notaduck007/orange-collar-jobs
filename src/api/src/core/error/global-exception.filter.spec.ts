import { GlobalExceptionFilter } from './global-exception.filter.js';
import { HttpException, HttpStatus } from '@nestjs/common';
import { AppError, NotFoundError, ForbiddenError } from './errors.js';
import type { ArgumentsHost } from '@nestjs/common';

function buildMockHost(method = 'GET', url = '/test'): ArgumentsHost {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  const getResponse = jest.fn().mockReturnValue({ status });
  const getRequest = jest.fn().mockReturnValue({ method, url });
  const switchToHttp = jest.fn().mockReturnValue({ getResponse, getRequest });
  return { switchToHttp } as unknown as ArgumentsHost;
}

describe('GlobalExceptionFilter', () => {
  const filter = new GlobalExceptionFilter();

  it('maps AppError to its statusCode', () => {
    const host = buildMockHost();
    const err = new NotFoundError('Job', '123');
    filter.catch(err, host);

    const statusMock = (
      host.switchToHttp().getResponse() as { status: jest.Mock }
    ).status;
    expect(statusMock).toHaveBeenCalledWith(404);
  });

  it('maps HttpException to its status', () => {
    const host = buildMockHost();
    const err = new HttpException('Not allowed', HttpStatus.METHOD_NOT_ALLOWED);
    filter.catch(err, host);

    const statusMock = (
      host.switchToHttp().getResponse() as { status: jest.Mock }
    ).status;
    expect(statusMock).toHaveBeenCalledWith(405);
  });

  it('maps ForbiddenError to 403', () => {
    const host = buildMockHost();
    filter.catch(new ForbiddenError(), host);

    const statusMock = (
      host.switchToHttp().getResponse() as { status: jest.Mock }
    ).status;
    expect(statusMock).toHaveBeenCalledWith(403);
  });

  it('maps unknown errors to 500', () => {
    const host = buildMockHost();
    filter.catch(new Error('unhandled'), host);

    const statusMock = (
      host.switchToHttp().getResponse() as { status: jest.Mock }
    ).status;
    expect(statusMock).toHaveBeenCalledWith(500);
  });

  it('includes code and message in the JSON body', () => {
    const host = buildMockHost();
    const err = new AppError('Something failed', 'CUSTOM_CODE', 418);
    filter.catch(err, host);

    const jsonMock = (
      host.switchToHttp().getResponse() as { status: jest.Mock }
    ).status.mock.results[0].value as { json: jest.Mock };
    expect(jsonMock.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'CUSTOM_CODE', message: 'Something failed' }),
    );
  });
});
