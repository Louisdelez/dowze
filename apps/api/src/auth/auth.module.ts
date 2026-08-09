import { Global, Module } from '@nestjs/common';
import { SupabaseAuthGuard } from './supabase-auth.guard';
import { OwnershipService } from './ownership.service';

/** Rend la garde JWT (+ autorisation de propriété des profils) injectable partout. */
@Global()
@Module({
  providers: [SupabaseAuthGuard, OwnershipService],
  exports: [SupabaseAuthGuard, OwnershipService],
})
export class AuthModule {}
