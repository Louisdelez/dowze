import { Global, Module } from '@nestjs/common';
import { EmailService } from './email.service';

/** Global : l'envoi d'email est disponible partout (invitations parent, alertes…). */
@Global()
@Module({
  providers: [EmailService],
  exports: [EmailService],
})
export class EmailModule {}
