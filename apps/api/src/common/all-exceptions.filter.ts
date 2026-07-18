import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import { captureException } from '../observability/telemetry';

interface MinimalResponse {
  status(code: number): { json(body: unknown): void };
}

/**
 * Filtre global : les erreurs serveur (≥ 500) sont rapportées à l'observabilité
 * (Sentry si actif, sinon logs). Les `HttpException` gardent leur réponse ; le
 * reste renvoie un 500 générique (aucune fuite d'interne au client).
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const res = host.switchToHttp().getResponse<MinimalResponse>();
    const status =
      exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;

    if (status >= 500) captureException(exception);

    if (exception instanceof HttpException) {
      res.status(status).json(exception.getResponse());
    } else {
      res.status(status).json({ statusCode: status, message: 'Erreur interne' });
    }
  }
}
