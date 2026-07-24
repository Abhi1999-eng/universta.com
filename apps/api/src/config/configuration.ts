import {
  validateEnvironment,
  type EnvironmentName,
  type ValidatedEnvironment,
} from './environment';

export interface AppConfiguration {
  nodeEnv: EnvironmentName;
  port: number;
  databaseUrl: string;
  corsOrigins: string[];
  swaggerEnabled: boolean;
}

export const configuration = (): { app: AppConfiguration } => {
  const environment: ValidatedEnvironment = validateEnvironment(process.env);

  return {
    app: {
      nodeEnv: environment.NODE_ENV,
      port: environment.PORT,
      databaseUrl: environment.DATABASE_URL,
      corsOrigins: environment.CORS_ORIGINS,
      swaggerEnabled: environment.SWAGGER_ENABLED,
    },
  };
};
