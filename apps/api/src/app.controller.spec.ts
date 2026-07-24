import { Test, type TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { HealthService } from './health/health.service';

jest.mock('./health/health.service', () => ({
  HealthService: class HealthService {},
}));

describe('AppController', () => {
  let appController: AppController;
  const healthService = { isDatabaseUp: jest.fn() };

  beforeEach(async () => {
    healthService.isDatabaseUp.mockReset();
    healthService.isDatabaseUp.mockResolvedValue(true);
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        AppService,
        { provide: HealthService, useValue: healthService },
      ],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  it('keeps the versioned shell route available', () => {
    expect(appController.getHello()).toBe('Hello World!');
  });

  it('returns an up health result', async () => {
    await expect(
      appController.getHealth({ status: jest.fn() } as never),
    ).resolves.toMatchObject({ status: 'ok', database: 'up' });
  });

  it('returns a degraded health result when the database is unavailable', async () => {
    healthService.isDatabaseUp.mockResolvedValue(false);
    const response = { status: jest.fn() };

    await expect(
      appController.getHealth(response as never),
    ).resolves.toMatchObject({ status: 'degraded', database: 'down' });
    expect(response.status).toHaveBeenCalledWith(503);
  });
});
