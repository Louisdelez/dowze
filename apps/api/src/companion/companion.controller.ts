import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  Res,
  UnauthorizedException,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { z } from 'zod';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { parseOr400 } from '../common/validate-body';
import { CompanionService, type UploadedPetFile } from './companion.service';
import { PetCareService } from './pet-care.service';

interface AuthedRequest {
  accountAuthId?: string;
}

/** Sous-ensemble de la réponse Express dont on a besoin (évite le type dep `@types/express`). */
interface HttpResponse {
  setHeader(name: string, value: string): void;
  send(body: Buffer): void;
}

/** Requête/réponse minimales pour l'endpoint MCP (JSON-RPC brut, sans dep `@types/express`). */
interface McpRequest {
  headers: Record<string, string | string[] | undefined>;
  body: unknown;
}
interface McpResponse {
  status(code: number): McpResponse;
  json(body: unknown): void;
  end(): void;
  setHeader(name: string, value: string): void;
}
interface JsonRpc {
  id?: unknown;
  method?: unknown;
  params?: unknown;
}
interface McpToolResult {
  content: { type: 'text'; text: string }[];
  isError?: boolean;
}

const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
const renameBody = z.object({ name: z.string().min(1).max(60) }).strict();
const posBody = z.object({ c: z.number(), r: z.number() }).strict();
const personalityBody = z
  .object({
    tone: z.string().max(60).optional(),
    traits: z.array(z.string().max(40)).max(12).optional(),
    description: z.string().max(600).optional(),
    emoji: z.string().max(8).optional(),
  })
  .strict();
const createAgentBody = z
  .object({
    name: z.string().min(1).max(40),
    skinUrl: z.string().max(600).nullable().optional(),
    size: z.number().int().min(40).max(240).optional(),
    personality: personalityBody.nullable().optional(),
    role: z.string().max(60).nullable().optional(),
    space: z.string().max(60).optional(),
    room: z.string().max(60).optional(),
    pos: posBody.nullable().optional(),
    mode: z.enum(['pnj', 'agent']).optional(),
  })
  .strict();
const patchAgentBody = createAgentBody.partial();
const spaceBody = z.object({ name: z.string().min(1).max(40) }).strict();
// Création d'open-space typé (organisation) : type + template de rôles + mission (tous optionnels).
const createSpaceBody = z
  .object({
    name: z.string().min(1).max(40),
    type: z.string().max(20).optional(),
    template: z.string().max(40).optional(),
    mission: z.string().max(500).optional(),
  })
  .strict();
const serviceOrgBody = z.object({ service: z.enum(['academie']).default('academie') }).strict();
const buildAgentBody = z
  .object({
    description: z.string().min(1).max(500),
    skinUrl: z.string().max(600).nullable().optional(),
    space: z.string().max(60).optional(),
  })
  .strict();
const chatAgentBody = z.object({ message: z.string().min(1).max(1000) }).strict();
const orchestrateBody = z
  .object({ message: z.string().min(1).max(1000), leaderId: z.string().uuid().optional() })
  .strict();
const spaceOrchestrateBody = z.object({ message: z.string().min(1).max(1000) }).strict();
const projectBody = z.object({ goal: z.string().min(1).max(1000) }).strict();
const knowledgeBody = z
  .object({ title: z.string().max(160).default(''), content: z.string().min(1).max(8000) })
  .strict();
const protectBody = z.object({ protected: z.boolean() }).strict();
const mergeBody = z
  .object({ survivorId: z.string().uuid(), absorbedId: z.string().uuid() })
  .strict();
const relayTokenBody = z.object({ label: z.string().max(60).optional() }).strict();
const relaySayBody = z.object({ text: z.string().min(1).max(1000) }).strict();
const bridgeIngestBody = z
  .object({
    source: z.enum(['chatgpt', 'claude', 'ia']).default('ia'),
    text: z.string().min(1).max(60000),
  })
  .strict();
const buyBody = z
  .object({ item: z.string().min(1).max(40), qty: z.number().int().min(1).max(999).optional() })
  .strict();
const roomItemsSchema = z
  .array(z.object({ item: z.string().max(40), c: z.number().int(), r: z.number().int() }).strict())
  .max(300);
// Meubles PAR pièce : map { idPièce → meubles }.
const roomBody = z
  .object({
    room: z.string().max(40),
    rooms: z.record(z.string().max(40), roomItemsSchema),
  })
  .strict();

@Controller('companion')
export class CompanionController {
  constructor(
    private readonly service: CompanionService,
    private readonly care: PetCareService,
  ) {}

  /** Tamagotchi : état de soin (jauges décroissantes, humeur, âge). */
  @Get('care')
  @UseGuards(SupabaseAuthGuard)
  async getCare(@Req() req: AuthedRequest) {
    if (!req.accountAuthId) throw new UnauthorizedException('non authentifié');
    return this.care.get(req.accountAuthId);
  }

  /** Tamagotchi : action de soin (feed/play/sleep/clean/heal/cuddle). */
  @Post('care/:action')
  @UseGuards(SupabaseAuthGuard)
  @Throttle({ default: { ttl: 60_000, limit: 60 } })
  async actCare(@Req() req: AuthedRequest, @Param('action') action: string) {
    if (!req.accountAuthId) throw new UnauthorizedException('non authentifié');
    return this.care.act(req.accountAuthId, action);
  }

  /** Boutique : achète un objet (débite le gold, débloque l'objet). */
  @Post('shop/buy')
  @UseGuards(SupabaseAuthGuard)
  @Throttle({ default: { ttl: 60_000, limit: 40 } })
  async buy(@Req() req: AuthedRequest, @Body() body: unknown) {
    if (!req.accountAuthId) throw new UnauthorizedException('non authentifié');
    const { item, qty } = parseOr400(buyBody, body);
    return this.care.buy(req.accountAuthId, item, qty ?? 1);
  }

  /** Care de TOUS les compagnons d'un espace (hors principal & relais) → moyenne + barres côté client. */
  @Get('care/space')
  @UseGuards(SupabaseAuthGuard)
  async spaceCare(@Req() req: AuthedRequest, @Query('space') space?: string) {
    if (!req.accountAuthId) throw new UnauthorizedException('non authentifié');
    return this.care.listSpaceCare(req.accountAuthId, space || 'home');
  }

  /** Care d'UN compagnon (jauges décroissantes). */
  @Get('agents/:id/care')
  @UseGuards(SupabaseAuthGuard)
  async getAgentCare(@Req() req: AuthedRequest, @Param('id') id: string) {
    if (!req.accountAuthId) throw new UnauthorizedException('non authentifié');
    return this.care.getAgentCare(req.accountAuthId, id);
  }

  /** Action de soin sur UN compagnon (feed/play/sleep/clean/heal/cuddle). */
  @Post('agents/:id/care/:action')
  @UseGuards(SupabaseAuthGuard)
  @Throttle({ default: { ttl: 60_000, limit: 120 } })
  async actAgentCare(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
    @Param('action') action: string,
  ) {
    if (!req.accountAuthId) throw new UnauthorizedException('non authentifié');
    return this.care.actAgentCare(req.accountAuthId, id, action);
  }

  /** « Maison » : pièce + meubles placés (jeu isométrique). */
  @Get('room')
  @UseGuards(SupabaseAuthGuard)
  async getRoom(@Req() req: AuthedRequest) {
    if (!req.accountAuthId) throw new UnauthorizedException('non authentifié');
    return this.care.getRoom(req.accountAuthId);
  }

  /** « Maison » : enregistre la pièce + les meubles. */
  @Put('room')
  @UseGuards(SupabaseAuthGuard)
  async setRoom(@Req() req: AuthedRequest, @Body() body: unknown) {
    if (!req.accountAuthId) throw new UnauthorizedException('non authentifié');
    const b = parseOr400(roomBody, body);
    return this.care.setRoom(req.accountAuthId, b.room, b.rooms);
  }

  /** Ajoute un pet à la bibliothèque depuis un fichier .zip/.webp/.png. Authentifié + rate-limité. */
  @Post('pet')
  @UseGuards(SupabaseAuthGuard)
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 12 * 1024 * 1024, files: 1 } }))
  async install(@Req() req: AuthedRequest, @UploadedFile() file: UploadedPetFile | undefined) {
    if (!req.accountAuthId) throw new UnauthorizedException('non authentifié');
    return this.service.install(req.accountAuthId, file);
  }

  /** Bibliothèque de pets du profil (métadonnées). */
  @Get('pets')
  @UseGuards(SupabaseAuthGuard)
  async list(@Req() req: AuthedRequest) {
    if (!req.accountAuthId) throw new UnauthorizedException('non authentifié');
    return this.service.list(req.accountAuthId);
  }

  /** Renomme un pet de la bibliothèque. */
  @Patch('pet/:id')
  @UseGuards(SupabaseAuthGuard)
  async rename(@Req() req: AuthedRequest, @Param('id') id: string, @Body() body: unknown) {
    if (!req.accountAuthId) throw new UnauthorizedException('non authentifié');
    if (!UUID_RE.test(id)) throw new NotFoundException();
    const { name } = parseOr400(renameBody, body);
    return this.service.rename(req.accountAuthId, id, name);
  }

  /** Supprime un pet de la bibliothèque. */
  @Delete('pet/:id')
  @UseGuards(SupabaseAuthGuard)
  async remove(@Req() req: AuthedRequest, @Param('id') id: string) {
    if (!req.accountAuthId) throw new UnauthorizedException('non authentifié');
    if (!UUID_RE.test(id)) throw new NotFoundException();
    return this.service.remove(req.accountAuthId, id);
  }

  // ---------- Compagnons-agents (« famille » + open-spaces) ----------

  /** Liste les compagnons d'un espace (défaut : la Maison). Sème le principal au besoin. */
  @Get('agents')
  @UseGuards(SupabaseAuthGuard)
  async agents(@Req() req: AuthedRequest, @Query('space') space?: string) {
    if (!req.accountAuthId) throw new UnauthorizedException('non authentifié');
    return this.service.listAgents(req.accountAuthId, space || 'home');
  }

  /** Crée un compagnon (PNJ par défaut). */
  @Post('agents')
  @UseGuards(SupabaseAuthGuard)
  @Throttle({ default: { ttl: 60_000, limit: 40 } })
  async createAgent(@Req() req: AuthedRequest, @Body() body: unknown) {
    if (!req.accountAuthId) throw new UnauthorizedException('non authentifié');
    return this.service.createAgent(req.accountAuthId, parseOr400(createAgentBody, body));
  }

  /** Met à jour un compagnon (nom / skin / personnalité / position / espace…). */
  @Patch('agents/:id')
  @UseGuards(SupabaseAuthGuard)
  async updateAgent(@Req() req: AuthedRequest, @Param('id') id: string, @Body() body: unknown) {
    if (!req.accountAuthId) throw new UnauthorizedException('non authentifié');
    if (!UUID_RE.test(id)) throw new NotFoundException();
    return this.service.updateAgent(req.accountAuthId, id, parseOr400(patchAgentBody, body));
  }

  /** Supprime un compagnon (le principal est protégé). */
  @Delete('agents/:id')
  @UseGuards(SupabaseAuthGuard)
  async deleteAgent(@Req() req: AuthedRequest, @Param('id') id: string) {
    if (!req.accountAuthId) throw new UnauthorizedException('non authentifié');
    if (!UUID_RE.test(id)) throw new NotFoundException();
    return this.service.deleteAgent(req.accountAuthId, id);
  }

  /** Auto-builder IA : construit un compagnon-agent depuis une courte description. */
  @Post('agents/build')
  @UseGuards(SupabaseAuthGuard)
  @Throttle({ default: { ttl: 60_000, limit: 15 } })
  async buildAgent(@Req() req: AuthedRequest, @Body() body: unknown) {
    if (!req.accountAuthId) throw new UnauthorizedException('non authentifié');
    const input = parseOr400(buildAgentBody, body);
    return this.service.buildAgent(req.accountAuthId, input);
  }

  /** Chat IA avec un compagnon-agent (réponse courte, mémoire persistante + apprentissage). */
  @Post('agents/:id/chat')
  @UseGuards(SupabaseAuthGuard)
  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  async chatAgent(@Req() req: AuthedRequest, @Param('id') id: string, @Body() body: unknown) {
    if (!req.accountAuthId) throw new UnauthorizedException('non authentifié');
    if (!UUID_RE.test(id)) throw new NotFoundException();
    const { message } = parseOr400(chatAgentBody, body);
    return this.service.chatAgent(req.accountAuthId, id, message);
  }

  /** Orchestration « ruche » : le compagnon principal délègue aux spécialistes et synthétise. */
  @Post('orchestrate')
  @UseGuards(SupabaseAuthGuard)
  @Throttle({ default: { ttl: 60_000, limit: 15 } })
  async orchestrate(@Req() req: AuthedRequest, @Body() body: unknown) {
    if (!req.accountAuthId) throw new UnauthorizedException('non authentifié');
    const { message, leaderId } = parseOr400(orchestrateBody, body);
    return this.service.orchestrate(req.accountAuthId, message, leaderId);
  }

  /** P2 — le leader d'un open-space (Directeur/CEO) délègue à l'effectif du space selon le rôle. */
  @Post('spaces/:id/orchestrate')
  @UseGuards(SupabaseAuthGuard)
  @Throttle({ default: { ttl: 60_000, limit: 15 } })
  async orchestrateSpace(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    if (!req.accountAuthId) throw new UnauthorizedException('non authentifié');
    if (!UUID_RE.test(id)) throw new NotFoundException();
    const { message } = parseOr400(spaceOrchestrateBody, body);
    return this.service.orchestrateSpace(req.accountAuthId, id, message);
  }

  /** P4 — chantier (SOP) : le leader découpe un objectif, l'équipe produit, l'évaluateur relit, on archive le livrable. */
  @Post('spaces/:id/project')
  @UseGuards(SupabaseAuthGuard)
  @Throttle({ default: { ttl: 60_000, limit: 8 } })
  async runProject(@Req() req: AuthedRequest, @Param('id') id: string, @Body() body: unknown) {
    if (!req.accountAuthId) throw new UnauthorizedException('non authentifié');
    if (!UUID_RE.test(id)) throw new NotFoundException();
    const { goal } = parseOr400(projectBody, body);
    return this.service.runProject(req.accountAuthId, id, goal);
  }

  // ---------- Jardinage de la ruche (cycle de vie & efficacité des abeilles) ----------

  /** Nettoyage de la ruche : dedup → fusion des doublons → prune des abeilles obsolètes/faibles. */
  @Post('hive/maintain')
  @UseGuards(SupabaseAuthGuard)
  @Throttle({ default: { ttl: 60_000, limit: 6 } })
  async maintainHive(@Req() req: AuthedRequest) {
    if (!req.accountAuthId) throw new UnauthorizedException('non authentifié');
    return this.service.maintainHive(req.accountAuthId);
  }

  /** Fusion manuelle de deux abeilles (survivante + absorbée). */
  @Post('hive/merge')
  @UseGuards(SupabaseAuthGuard)
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  async mergeAgents(@Req() req: AuthedRequest, @Body() body: unknown) {
    if (!req.accountAuthId) throw new UnauthorizedException('non authentifié');
    const { survivorId, absorbedId } = parseOr400(mergeBody, body);
    return this.service.mergeAgentsManual(req.accountAuthId, survivorId, absorbedId);
  }

  /** Ré-entraîne une abeille (consolide règles + réécrit son system prompt depuis son historique). */
  @Post('agents/:id/retrain')
  @UseGuards(SupabaseAuthGuard)
  @Throttle({ default: { ttl: 60_000, limit: 15 } })
  async retrainAgent(@Req() req: AuthedRequest, @Param('id') id: string) {
    if (!req.accountAuthId) throw new UnauthorizedException('non authentifié');
    if (!UUID_RE.test(id)) throw new NotFoundException();
    return this.service.retrainAgent(req.accountAuthId, id);
  }

  /** Annule le dernier ré-entraînement/fusion : restaure le system prompt précédent. */
  @Post('agents/:id/revert-prompt')
  @UseGuards(SupabaseAuthGuard)
  async revertAgentPrompt(@Req() req: AuthedRequest, @Param('id') id: string) {
    if (!req.accountAuthId) throw new UnauthorizedException('non authentifié');
    if (!UUID_RE.test(id)) throw new NotFoundException();
    return this.service.revertAgentPrompt(req.accountAuthId, id);
  }

  /** Retire une abeille (soft-delete, réversible). */
  @Post('agents/:id/retire')
  @UseGuards(SupabaseAuthGuard)
  async retireAgent(@Req() req: AuthedRequest, @Param('id') id: string) {
    if (!req.accountAuthId) throw new UnauthorizedException('non authentifié');
    if (!UUID_RE.test(id)) throw new NotFoundException();
    return this.service.retireAgent(req.accountAuthId, id);
  }

  /** Épingle/désépingle une abeille (protégée = exemptée de fusion/prune). */
  @Post('agents/:id/protect')
  @UseGuards(SupabaseAuthGuard)
  async protectAgent(@Req() req: AuthedRequest, @Param('id') id: string, @Body() body: unknown) {
    if (!req.accountAuthId) throw new UnauthorizedException('non authentifié');
    if (!UUID_RE.test(id)) throw new NotFoundException();
    const { protected: isProtected } = parseOr400(protectBody, body);
    return this.service.setAgentProtected(req.accountAuthId, id, isProtected);
  }

  /** Historique de conversation persistant d'un compagnon-agent. */
  @Get('agents/:id/messages')
  @UseGuards(SupabaseAuthGuard)
  async agentMessages(@Req() req: AuthedRequest, @Param('id') id: string) {
    if (!req.accountAuthId) throw new UnauthorizedException('non authentifié');
    if (!UUID_RE.test(id)) throw new NotFoundException();
    return this.service.getAgentMessages(req.accountAuthId, id);
  }

  // ---------- Espaces (open-spaces) ----------

  @Get('spaces')
  @UseGuards(SupabaseAuthGuard)
  async spaces(@Req() req: AuthedRequest) {
    if (!req.accountAuthId) throw new UnauthorizedException('non authentifié');
    return this.service.listSpaces(req.accountAuthId);
  }

  /** Catalogue de templates d'organisation (entreprise / SaaS / école…) pour la création d'open-space. */
  @Get('spaces/templates')
  @UseGuards(SupabaseAuthGuard)
  async orgTemplates(@Req() req: AuthedRequest) {
    if (!req.accountAuthId) throw new UnauthorizedException('non authentifié');
    return this.service.listOrgTemplates();
  }

  @Post('spaces')
  @UseGuards(SupabaseAuthGuard)
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  async createSpace(@Req() req: AuthedRequest, @Body() body: unknown) {
    if (!req.accountAuthId) throw new UnauthorizedException('non authentifié');
    const { name, type, template, mission } = parseOr400(createSpaceBody, body);
    return this.service.createSpace(req.accountAuthId, name, { type, template, mission });
  }

  /** Auto-provision de l'org de service (ex. Académie → école calibrée sur le rang). Idempotent. */
  @Post('service-org')
  @UseGuards(SupabaseAuthGuard)
  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  async ensureServiceOrg(@Req() req: AuthedRequest, @Body() body: unknown) {
    if (!req.accountAuthId) throw new UnauthorizedException('non authentifié');
    const { service } = parseOr400(serviceOrgBody, body);
    return this.service.ensureServiceOrg(req.accountAuthId, service);
  }

  @Patch('spaces/:id')
  @UseGuards(SupabaseAuthGuard)
  async renameSpace(@Req() req: AuthedRequest, @Param('id') id: string, @Body() body: unknown) {
    if (!req.accountAuthId) throw new UnauthorizedException('non authentifié');
    if (!UUID_RE.test(id)) throw new NotFoundException();
    const { name } = parseOr400(spaceBody, body);
    return this.service.renameSpace(req.accountAuthId, id, name);
  }

  // --- P3 : base de connaissances par organisation (RAG scopé à l'open-space) ---
  @Get('spaces/:id/knowledge')
  @UseGuards(SupabaseAuthGuard)
  async listSpaceKnowledge(@Req() req: AuthedRequest, @Param('id') id: string) {
    if (!req.accountAuthId) throw new UnauthorizedException('non authentifié');
    if (!UUID_RE.test(id)) throw new NotFoundException();
    return this.service.listSpaceKnowledge(req.accountAuthId, id);
  }

  @Post('spaces/:id/knowledge')
  @UseGuards(SupabaseAuthGuard)
  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  async addSpaceKnowledge(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    if (!req.accountAuthId) throw new UnauthorizedException('non authentifié');
    if (!UUID_RE.test(id)) throw new NotFoundException();
    const { title, content } = parseOr400(knowledgeBody, body);
    return this.service.addSpaceKnowledge(req.accountAuthId, id, title, content);
  }

  @Delete('knowledge/:id')
  @UseGuards(SupabaseAuthGuard)
  async deleteSpaceKnowledge(@Req() req: AuthedRequest, @Param('id') id: string) {
    if (!req.accountAuthId) throw new UnauthorizedException('non authentifié');
    if (!UUID_RE.test(id)) throw new NotFoundException();
    return this.service.deleteSpaceKnowledge(req.accountAuthId, id);
  }

  @Delete('spaces/:id')
  @UseGuards(SupabaseAuthGuard)
  async deleteSpace(@Req() req: AuthedRequest, @Param('id') id: string) {
    if (!req.accountAuthId) throw new UnauthorizedException('non authentifié');
    if (!UUID_RE.test(id)) throw new NotFoundException();
    return this.service.deleteSpace(req.accountAuthId, id);
  }

  // ---------- Relais Claude Code / Codex (serveur MCP) ----------

  /** Génère un jeton Bearer à coller dans SON Claude Code / Codex (montré une seule fois). */
  @Post('relay/token')
  @UseGuards(SupabaseAuthGuard)
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  async relayToken(@Req() req: AuthedRequest, @Body() body: unknown) {
    if (!req.accountAuthId) throw new UnauthorizedException('non authentifié');
    const { label } = parseOr400(relayTokenBody, body);
    return this.service.createRelayToken(req.accountAuthId, label);
  }

  /** Téléphone → Claude Code : l'utilisateur envoie une instruction dans le fil du relais. */
  @Post('relay/say')
  @UseGuards(SupabaseAuthGuard)
  @Throttle({ default: { ttl: 60_000, limit: 60 } })
  async relaySay(@Req() req: AuthedRequest, @Body() body: unknown) {
    if (!req.accountAuthId) throw new UnauthorizedException('non authentifié');
    const { text } = parseOr400(relaySayBody, body);
    return this.service.relaySay(req.accountAuthId, text);
  }

  // --- PONT IA (ChatGPT/Claude) : capter → synthétiser → réinjecter (zéro copier-coller) ---
  /** ② L'app envoie la conversation captée → l'abeille Mémorialiste la synthétise et la mémorise. */
  @Post('bridge/ingest')
  @UseGuards(SupabaseAuthGuard)
  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  async bridgeIngest(@Req() req: AuthedRequest, @Body() body: unknown) {
    if (!req.accountAuthId) throw new UnauthorizedException('non authentifié');
    const { source, text } = parseOr400(bridgeIngestBody, body);
    return this.service.ingestAiConversation(req.accountAuthId, source, text);
  }

  /** ③ Prompt de contexte à coller AUTO dans une nouvelle session (compose + dernière synthèse). */
  @Get('bridge/context')
  @UseGuards(SupabaseAuthGuard)
  async bridgeContext(@Req() req: AuthedRequest) {
    if (!req.accountAuthId) throw new UnauthorizedException('non authentifié');
    return this.service.getBridgeContext(req.accountAuthId);
  }

  /** État du pont : dernières synthèses mémorisées. */
  @Get('bridge/state')
  @UseGuards(SupabaseAuthGuard)
  async bridgeStateRoute(@Req() req: AuthedRequest) {
    if (!req.accountAuthId) throw new UnauthorizedException('non authentifié');
    return this.service.bridgeState(req.accountAuthId);
  }

  /**
   * Serveur MCP (JSON-RPC 2.0, transport HTTP) — auth par jeton Bearer du relais.
   * C'est ICI que SON Claude Code / Codex se connecte : `claude mcp add --transport http dowze https://api.dowze.ch/companion/mcp --header "Authorization: Bearer dwz_…"`.
   */
  @Post('mcp')
  @Throttle({ default: { ttl: 60_000, limit: 240 } })
  async mcp(@Req() req: McpRequest, @Res() res: McpResponse) {
    const auth = req.headers['authorization'];
    const header = Array.isArray(auth) ? auth[0] : auth;
    const token =
      header && /^Bearer\s+/i.test(header) ? header.replace(/^Bearer\s+/i, '').trim() : '';
    const profileId = token ? await this.service.relayProfileFromToken(token) : null;
    if (!profileId) {
      res.status(401).json({
        jsonrpc: '2.0',
        id: null,
        error: { code: -32001, message: 'Jeton relais invalide.' },
      });
      return;
    }
    const body = req.body;
    if (Array.isArray(body)) {
      const out: unknown[] = [];
      for (const m of body) {
        const r = await this.mcpProcess(profileId, m as JsonRpc);
        if (r) out.push(r);
      }
      if (out.length === 0) {
        res.status(202).end();
        return;
      }
      res.status(200).json(out);
      return;
    }
    const r = await this.mcpProcess(profileId, (body ?? {}) as JsonRpc);
    if (!r) {
      res.status(202).end();
      return;
    }
    res.status(200).json(r);
  }

  /** Pas de flux SSE serveur→client : le relais fonctionne en requêtes/réponses. */
  @Get('mcp')
  mcpGet(@Res() res: McpResponse) {
    res.setHeader('Allow', 'POST');
    res.status(405).end();
  }

  /** Outils exposés par le serveur MCP (visibles par Claude Code / Codex). */
  private mcpTools() {
    return [
      {
        name: 'dowze_send_update',
        description:
          "Envoie un message d'avancement, un résultat ou une question courte à l'utilisateur DANS son application Dowze (il le voit dans la messagerie de son compagnon-téléphone). Utilise-le pour le tenir informé pendant que tu travailles : ce que tu viens de faire, un résultat, un blocage, une question. Écris naturellement, en français, court (comme un SMS).",
        inputSchema: {
          type: 'object',
          properties: {
            text: { type: 'string', description: 'Le message à afficher dans Dowze.' },
          },
          required: ['text'],
        },
      },
      {
        name: 'dowze_get_messages',
        description:
          "Récupère les nouvelles instructions ou réponses que l'utilisateur t'a laissées dans Dowze depuis ton dernier appel. Appelle-le au début d'une tâche puis régulièrement pour voir si l'utilisateur t'a répondu. Renvoie les messages en attente (vide si aucun).",
        inputSchema: { type: 'object', properties: {} },
      },
    ];
  }

  /** Exécute un outil MCP. */
  private async mcpCall(
    profileId: string,
    name: string,
    args: Record<string, unknown>,
  ): Promise<McpToolResult> {
    if (name === 'dowze_send_update') {
      const text = typeof args.text === 'string' ? args.text : '';
      if (!text.trim())
        return {
          content: [{ type: 'text', text: 'Erreur : le champ "text" est requis.' }],
          isError: true,
        };
      await this.service.relayPush(profileId, text);
      return { content: [{ type: 'text', text: 'Envoyé à Dowze ✅' }] };
    }
    if (name === 'dowze_get_messages') {
      const msgs = await this.service.relayPull(profileId);
      const text = msgs.length
        ? msgs.map((m, i) => `${i + 1}. ${m}`).join('\n')
        : '(aucune nouvelle instruction)';
      return { content: [{ type: 'text', text }] };
    }
    return { content: [{ type: 'text', text: `Outil inconnu : ${name}` }], isError: true };
  }

  /** Traite un message JSON-RPC (renvoie la réponse, ou `null` pour une notification). */
  private async mcpProcess(
    profileId: string,
    msg: JsonRpc,
  ): Promise<Record<string, unknown> | null> {
    const id = msg?.id;
    const method = typeof msg?.method === 'string' ? msg.method : '';
    const params = (msg?.params && typeof msg.params === 'object' ? msg.params : {}) as Record<
      string,
      unknown
    >;
    const isNotification = id === undefined || id === null;
    const ok = (result: unknown): Record<string, unknown> => ({ jsonrpc: '2.0', id, result });
    const err = (code: number, message: string): Record<string, unknown> => ({
      jsonrpc: '2.0',
      id,
      error: { code, message },
    });
    try {
      switch (method) {
        case 'initialize': {
          const pv =
            typeof params.protocolVersion === 'string' ? params.protocolVersion : '2025-06-18';
          return ok({
            protocolVersion: pv,
            capabilities: { tools: {} },
            serverInfo: { name: 'dowze', version: '1.0.0' },
            instructions:
              "Relais Dowze. Utilise dowze_send_update pour tenir l'utilisateur informé de ton avancement, et dowze_get_messages pour lire ses instructions/réponses.",
          });
        }
        case 'ping':
          return ok({});
        case 'tools/list':
          return ok({ tools: this.mcpTools() });
        case 'tools/call': {
          const toolName = typeof params.name === 'string' ? params.name : '';
          const toolArgs = (
            params.arguments && typeof params.arguments === 'object' ? params.arguments : {}
          ) as Record<string, unknown>;
          return ok(await this.mcpCall(profileId, toolName, toolArgs));
        }
        case 'resources/list':
          return ok({ resources: [] });
        case 'prompts/list':
          return ok({ prompts: [] });
        default:
          // notifications/initialized, notifications/cancelled, etc. → pas de réponse
          return isNotification ? null : err(-32601, `Méthode inconnue : ${method}`);
      }
    } catch (e) {
      return isNotification ? null : err(-32603, e instanceof Error ? e.message : 'Erreur interne');
    }
  }

  /** Sert la planche d'un pet (public, image uniquement, cache long). */
  @Get('pet/:id')
  async serve(@Param('id') id: string, @Res() res: HttpResponse) {
    if (!UUID_RE.test(id)) throw new NotFoundException();
    const out = await this.service.serve(id);
    if (!out) throw new NotFoundException();
    res.setHeader('Content-Type', out.mime);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', "default-src 'none'");
    // L'app (academie.dowze.ch) affiche l'image servie par l'API (api.dowze.ch) = cross-origin.
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.send(out.bytes);
  }
}
