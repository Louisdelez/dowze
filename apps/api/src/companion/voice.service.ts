import {
  BadRequestException,
  Inject,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { ENV } from '../config/config.module';
import type { Env } from '../config/env';
import { DB, type Database } from '../db/drizzle.module';
import { accounts, companionVoiceSettings } from '../db/schema';
import { decryptSecret, encryptSecret } from '../copilote/crypto.util';

export type VoiceProvider = 'browser' | 'openai' | 'elevenlabs' | 'local';
export interface VoiceUpload {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
  size: number;
}

export interface VoiceSettingsUpdate {
  sttProvider?: VoiceProvider;
  sttModel?: string;
  ttsProvider?: VoiceProvider;
  ttsModel?: string;
  voiceId?: string;
  localSttModel?: string;
  localTtsModel?: string;
  localVoiceId?: string;
  openaiApiKey?: string | null;
  elevenlabsApiKey?: string | null;
}

@Injectable()
export class VoiceService {
  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(ENV) private readonly env: Env,
  ) {}

  private async accountId(authId: string): Promise<string> {
    const row = (
      await this.db
        .select({ id: accounts.id })
        .from(accounts)
        .where(eq(accounts.authUserId, authId))
        .limit(1)
    )[0];
    if (!row) throw new UnauthorizedException('Compte Dowze introuvable.');
    return row.id;
  }

  private async row(authId: string) {
    const accountId = await this.accountId(authId);
    const row = (
      await this.db
        .select()
        .from(companionVoiceSettings)
        .where(eq(companionVoiceSettings.accountId, accountId))
        .limit(1)
    )[0];
    return { accountId, row };
  }

  async getSettings(authId: string) {
    const { row } = await this.row(authId);
    return {
      sttProvider: (row?.sttProvider ?? 'browser') as VoiceProvider,
      sttModel: row?.sttModel ?? 'gpt-4o-mini-transcribe',
      ttsProvider: (row?.ttsProvider ?? 'browser') as VoiceProvider,
      ttsModel: row?.ttsModel ?? 'gpt-4o-mini-tts',
      voiceId: row?.voiceId ?? 'marin',
      localSttModel: row?.localSttModel ?? 'Systran/faster-whisper-small',
      localTtsModel: row?.localTtsModel ?? 'speaches-ai/Kokoro-82M-v1.0-ONNX',
      localVoiceId: row?.localVoiceId ?? 'ff_siwis',
      hasOpenaiKey: Boolean(row?.openaiKeyEnc || this.env.OPENAI_API_KEY),
      hasElevenlabsKey: Boolean(row?.elevenlabsKeyEnc || this.env.ELEVENLABS_API_KEY),
    };
  }

  async updateSettings(authId: string, input: VoiceSettingsUpdate) {
    const { accountId, row } = await this.row(authId);
    const secret = this.env.COPILOTE_SECRET_KEY;
    const encrypt = (value: string | null | undefined, current: string | null | undefined) => {
      if (value === undefined) return current ?? null;
      if (value === null || value === '') return null;
      if (!secret) throw new ServiceUnavailableException('Chiffrement des clés vocales indisponible.');
      return encryptSecret(value, secret);
    };
    await this.db
      .insert(companionVoiceSettings)
      .values({
        accountId,
        sttProvider: input.sttProvider ?? row?.sttProvider ?? 'browser',
        sttModel: input.sttModel ?? row?.sttModel ?? 'gpt-4o-mini-transcribe',
        ttsProvider: input.ttsProvider ?? row?.ttsProvider ?? 'browser',
        ttsModel: input.ttsModel ?? row?.ttsModel ?? 'gpt-4o-mini-tts',
        voiceId: input.voiceId ?? row?.voiceId ?? 'marin',
        localSttModel:
          input.localSttModel ?? row?.localSttModel ?? 'Systran/faster-whisper-small',
        localTtsModel:
          input.localTtsModel ?? row?.localTtsModel ?? 'speaches-ai/Kokoro-82M-v1.0-ONNX',
        localVoiceId: input.localVoiceId ?? row?.localVoiceId ?? 'ff_siwis',
        openaiKeyEnc: encrypt(input.openaiApiKey, row?.openaiKeyEnc),
        elevenlabsKeyEnc: encrypt(input.elevenlabsApiKey, row?.elevenlabsKeyEnc),
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: companionVoiceSettings.accountId,
        set: {
          sttProvider: input.sttProvider ?? row?.sttProvider ?? 'browser',
          sttModel: input.sttModel ?? row?.sttModel ?? 'gpt-4o-mini-transcribe',
          ttsProvider: input.ttsProvider ?? row?.ttsProvider ?? 'browser',
          ttsModel: input.ttsModel ?? row?.ttsModel ?? 'gpt-4o-mini-tts',
          voiceId: input.voiceId ?? row?.voiceId ?? 'marin',
          localSttModel:
            input.localSttModel ?? row?.localSttModel ?? 'Systran/faster-whisper-small',
          localTtsModel:
            input.localTtsModel ?? row?.localTtsModel ?? 'speaches-ai/Kokoro-82M-v1.0-ONNX',
          localVoiceId: input.localVoiceId ?? row?.localVoiceId ?? 'ff_siwis',
          openaiKeyEnc: encrypt(input.openaiApiKey, row?.openaiKeyEnc),
          elevenlabsKeyEnc: encrypt(input.elevenlabsApiKey, row?.elevenlabsKeyEnc),
          updatedAt: new Date(),
        },
      });
    return this.getSettings(authId);
  }

  private key(provider: 'openai' | 'elevenlabs', row: typeof companionVoiceSettings.$inferSelect) {
    const encrypted = provider === 'openai' ? row.openaiKeyEnc : row.elevenlabsKeyEnc;
    const platform = provider === 'openai' ? this.env.OPENAI_API_KEY : this.env.ELEVENLABS_API_KEY;
    if (encrypted) {
      if (!this.env.COPILOTE_SECRET_KEY)
        throw new ServiceUnavailableException('Clé vocale chiffrée illisible.');
      return decryptSecret(encrypted, this.env.COPILOTE_SECRET_KEY);
    }
    if (platform) return platform;
    throw new ServiceUnavailableException(`Configure une clé ${provider} pour la voix.`);
  }

  async transcribe(authId: string, file: VoiceUpload): Promise<{ text: string }> {
    if (!file?.buffer?.length) throw new BadRequestException('Enregistrement audio absent.');
    const { row } = await this.row(authId);
    if (!row || !['openai', 'elevenlabs'].includes(row.sttProvider))
      throw new BadRequestException('Le moteur STT sélectionné ne passe pas par le serveur.');
    const form = new FormData();
    form.append('file', new Blob([file.buffer], { type: file.mimetype }), file.originalname || 'voice.webm');
    if (row.sttProvider === 'openai') {
      form.append('model', row.sttModel);
      const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: { authorization: `Bearer ${this.key('openai', row)}` },
        body: form,
        signal: AbortSignal.timeout(120_000),
      });
      if (!response.ok) throw new ServiceUnavailableException(`OpenAI STT : ${response.status}`);
      const data = (await response.json()) as { text?: string };
      return { text: data.text?.trim() ?? '' };
    }
    form.append('model_id', row.sttModel);
    const response = await fetch('https://api.elevenlabs.io/v1/speech-to-text', {
      method: 'POST',
      headers: { 'xi-api-key': this.key('elevenlabs', row) },
      body: form,
      signal: AbortSignal.timeout(120_000),
    });
    if (!response.ok) throw new ServiceUnavailableException(`ElevenLabs STT : ${response.status}`);
    const data = (await response.json()) as { text?: string };
    return { text: data.text?.trim() ?? '' };
  }

  async synthesize(authId: string, text: string): Promise<{ audio: Buffer; mime: string }> {
    const { row } = await this.row(authId);
    if (!row || !['openai', 'elevenlabs'].includes(row.ttsProvider))
      throw new BadRequestException('Le moteur TTS sélectionné ne passe pas par le serveur.');
    const clean = text.replace(/```[\s\S]*?```/g, 'un extrait de code').replace(/[*_#`]/g, '').slice(0, 1200);
    let response: Response;
    if (row.ttsProvider === 'openai') {
      response = await fetch('https://api.openai.com/v1/audio/speech', {
        method: 'POST',
        headers: { authorization: `Bearer ${this.key('openai', row)}`, 'content-type': 'application/json' },
        body: JSON.stringify({
          model: row.ttsModel,
          voice: row.voiceId,
          input: clean,
          response_format: 'mp3',
          instructions: 'Voix française naturelle, chaleureuse et humaine. Conversation intime, rythme vivant, jamais voix de robot ni voix publicitaire.',
        }),
        signal: AbortSignal.timeout(120_000),
      });
    } else {
      response = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(row.voiceId)}?output_format=mp3_44100_128`,
        {
          method: 'POST',
          headers: { 'xi-api-key': this.key('elevenlabs', row), 'content-type': 'application/json' },
          body: JSON.stringify({
            text: clean,
            model_id: row.ttsModel,
            language_code: 'fr',
            voice_settings: { stability: 0.42, similarity_boost: 0.82, style: 0.32, use_speaker_boost: true, speed: 1 },
          }),
          signal: AbortSignal.timeout(120_000),
        },
      );
    }
    if (!response.ok)
      throw new ServiceUnavailableException(`${row.ttsProvider} TTS : ${response.status}`);
    return { audio: Buffer.from(await response.arrayBuffer()), mime: 'audio/mpeg' };
  }
}
