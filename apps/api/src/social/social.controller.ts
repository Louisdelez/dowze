import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { sendMessageInputSchema } from '@dowze/schemas';
import { parseOr400 } from '../common/validate-body';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { SocialService } from './social.service';

const uuid = z.string().uuid();
const targetBody = z.object({ targetProfileId: uuid });

@Controller('social')
@UseGuards(SupabaseAuthGuard)
export class SocialController {
  constructor(private readonly service: SocialService) {}

  // ---- Amis ----
  @Get(':profileId/friends')
  overview(@Param('profileId') profileId: string) {
    return this.service.overview(uuid.parse(profileId));
  }

  @Get(':profileId/search')
  search(@Param('profileId') profileId: string, @Query('q') q = '') {
    return this.service.search(uuid.parse(profileId), q);
  }

  @Post(':profileId/friends/request')
  request(@Param('profileId') profileId: string, @Body() body: unknown) {
    const { targetProfileId } = parseOr400(targetBody, body);
    return this.service.request(uuid.parse(profileId), targetProfileId);
  }

  @Post(':profileId/friends/accept')
  accept(@Param('profileId') profileId: string, @Body() body: unknown) {
    const { targetProfileId } = parseOr400(targetBody, body);
    return this.service.accept(uuid.parse(profileId), targetProfileId);
  }

  @Post(':profileId/friends/remove')
  remove(@Param('profileId') profileId: string, @Body() body: unknown) {
    const { targetProfileId } = parseOr400(targetBody, body);
    return this.service.remove(uuid.parse(profileId), targetProfileId);
  }

  // ---- Protections ----
  @Post(':profileId/block')
  block(@Param('profileId') profileId: string, @Body() body: unknown) {
    const { targetProfileId } = parseOr400(targetBody, body);
    return this.service.block(uuid.parse(profileId), targetProfileId);
  }

  @Post(':profileId/unblock')
  unblock(@Param('profileId') profileId: string, @Body() body: unknown) {
    const { targetProfileId } = parseOr400(targetBody, body);
    return this.service.unblock(uuid.parse(profileId), targetProfileId);
  }

  @Post(':profileId/report')
  report(@Param('profileId') profileId: string, @Body() body: unknown) {
    const { reportedProfileId, reason, conversationId } = parseOr400(
      z.object({
        reportedProfileId: uuid,
        reason: z.string().min(3).max(2000),
        conversationId: uuid.nullable().default(null),
      }),
      body,
    );
    return this.service.report(uuid.parse(profileId), reportedProfileId, reason, conversationId);
  }

  // ---- Conversations ----
  @Get(':profileId/inbox')
  inbox(@Param('profileId') profileId: string) {
    return this.service.inbox(uuid.parse(profileId));
  }

  @Get(':profileId/conversation/:conversationId')
  conversation(
    @Param('profileId') profileId: string,
    @Param('conversationId') conversationId: string,
  ) {
    return this.service.conversation(uuid.parse(profileId), uuid.parse(conversationId));
  }

  @Post(':profileId/conversation/:conversationId/send')
  send(
    @Param('profileId') profileId: string,
    @Param('conversationId') conversationId: string,
    @Body() body: unknown,
  ) {
    const input = parseOr400(sendMessageInputSchema, body);
    return this.service.send(uuid.parse(profileId), uuid.parse(conversationId), input);
  }

  @Post(':profileId/conversation/:conversationId/typing')
  typing(@Param('profileId') profileId: string, @Param('conversationId') conversationId: string) {
    return this.service.typing(uuid.parse(profileId), uuid.parse(conversationId));
  }

  @Post(':profileId/direct')
  startDirect(@Param('profileId') profileId: string, @Body() body: unknown) {
    const { friendProfileId } = parseOr400(z.object({ friendProfileId: uuid }), body);
    return this.service.startDirect(uuid.parse(profileId), friendProfileId);
  }

  @Post(':profileId/group')
  createGroup(@Param('profileId') profileId: string, @Body() body: unknown) {
    const { name, memberIds } = parseOr400(
      z.object({ name: z.string().min(1).max(80), memberIds: z.array(uuid).min(1) }),
      body,
    );
    return this.service.createGroup(uuid.parse(profileId), name, memberIds);
  }

  // ---- Option 3 validation : partager un sujet in-app ----
  @Post(':profileId/share-subject')
  shareSubject(@Param('profileId') profileId: string, @Body() body: unknown) {
    const { conversationId, subjectId } = parseOr400(
      z.object({ conversationId: uuid, subjectId: uuid }),
      body,
    );
    return this.service.shareSubject(uuid.parse(profileId), conversationId, subjectId);
  }
}
