import type { INestApplication } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, type OpenAPIObject, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';

import { ProblemDetailsFilter } from './common/errors/problem-details.filter';
import { ProblemDetailsResponse } from './common/errors/problem-details.response';
import { createValidationPipe } from './common/errors/validation';

/** Shared by main.ts, e2e tests and the OpenAPI emit script so they all see the same app. */
export function configureApp(app: NestExpressApplication): void {
  app.useLogger(app.get(Logger));
  // Behind Caddy in production (one proxy hop): needed for the client IP in rate limits.
  app.set('trust proxy', 1);
  app.use(helmet());
  app.useGlobalPipes(createValidationPipe());
  app.useGlobalFilters(new ProblemDetailsFilter());
  app.enableShutdownHooks();
}

export function buildOpenApiDocument(app: INestApplication): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle('ClockIn API')
    .setVersion('1')
    .setDescription(
      'Errors are application/problem+json with a stable `code` (see ProblemDetails).',
    )
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config, {
    extraModels: [ProblemDetailsResponse],
    operationIdFactory: (controller, method) =>
      `${controller.replace(/Controller$/, '')}_${method}`,
  });
  addProblemDetailsResponses(document);
  return document;
}

/** Every operation can fail with problem+json; saying so once here keeps controllers short. */
function addProblemDetailsResponses(document: OpenAPIObject): void {
  const problem = {
    description: 'Error (see `code`)',
    content: {
      'application/problem+json': {
        schema: { $ref: '#/components/schemas/ProblemDetailsResponse' },
      },
    },
  };
  for (const pathItem of Object.values(document.paths)) {
    for (const operation of Object.values(pathItem)) {
      if (operation && typeof operation === 'object' && 'responses' in operation) {
        operation.responses.default ??= problem;
      }
    }
  }
}
