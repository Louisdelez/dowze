'use client';

import { useEffect, useState } from 'react';
import {
  getCompanionVoiceSettings,
  updateCompanionVoiceSettings,
  type CompanionVoiceSettings,
  type VoiceProvider,
} from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardTitle } from '@/components/ui/card';
import { SelectField, TextField } from '@/components/ui/field';
import { Note } from '@/components/ui/note';

const DEFAULTS: CompanionVoiceSettings = {
  sttProvider: 'browser',
  sttModel: 'gpt-4o-mini-transcribe',
  ttsProvider: 'browser',
  ttsModel: 'gpt-4o-mini-tts',
  voiceId: 'marin',
  localSttModel: 'Systran/faster-whisper-small',
  localTtsModel: 'speaches-ai/Kokoro-82M-v1.0-ONNX',
  localVoiceId: 'ff_siwis',
  hasOpenaiKey: false,
  hasElevenlabsKey: false,
};

export function CompanionVoiceSettings() {
  const [value, setValue] = useState(DEFAULTS);
  const [openaiKey, setOpenaiKey] = useState('');
  const [elevenKey, setElevenKey] = useState('');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getCompanionVoiceSettings().then(setValue).catch(() => setMessage('Réglages vocaux indisponibles.'));
  }, []);
  const set = <K extends keyof CompanionVoiceSettings>(key: K, next: CompanionVoiceSettings[K]) =>
    setValue((current) => ({ ...current, [key]: next }));
  const chooseStt = (provider: VoiceProvider) =>
    setValue((current) => ({
      ...current,
      sttProvider: provider,
      sttModel:
        provider === 'elevenlabs'
          ? 'scribe_v2'
          : provider === 'openai'
            ? 'gpt-4o-mini-transcribe'
            : current.sttModel,
    }));
  const chooseTts = (provider: VoiceProvider) =>
    setValue((current) => ({
      ...current,
      ttsProvider: provider,
      ttsModel:
        provider === 'elevenlabs'
          ? 'eleven_v3'
          : provider === 'openai'
            ? 'gpt-4o-mini-tts'
            : current.ttsModel,
      voiceId:
        provider === 'elevenlabs'
          ? '21m00Tcm4TlvDq8ikWAM'
          : provider === 'openai'
            ? 'marin'
            : current.voiceId,
    }));

  async function save() {
    setSaving(true);
    setMessage('');
    try {
      const updated = await updateCompanionVoiceSettings({
        sttProvider: value.sttProvider,
        sttModel: value.sttModel,
        ttsProvider: value.ttsProvider,
        ttsModel: value.ttsModel,
        voiceId: value.voiceId,
        localSttModel: value.localSttModel,
        localTtsModel: value.localTtsModel,
        localVoiceId: value.localVoiceId,
        openaiApiKey: openaiKey.trim() || undefined,
        elevenlabsApiKey: elevenKey.trim() || undefined,
      });
      setValue(updated);
      setOpenaiKey('');
      setElevenKey('');
      setMessage('Voix du compagnon enregistrée.');
    } catch {
      setMessage('Échec de l’enregistrement des modèles vocaux.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="space-y-5">
      <div>
        <CardTitle>Voix naturelle du compagnon</CardTitle>
        <CardDescription>
          Choisis séparément le modèle qui comprend ta voix et celui qui fait parler ton compagnon.
          Les moteurs locaux restent exclusivement sur ton ordinateur.
        </CardDescription>
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="space-y-3">
          <SelectField
            label="Comprendre ma voix (STT)"
            value={value.sttProvider}
            onChange={(event) => chooseStt(event.target.value as VoiceProvider)}
          >
            <option value="openai">OpenAI — transcription naturelle</option>
            <option value="elevenlabs">ElevenLabs Scribe</option>
            <option value="local">Local — faster-whisper (cet ordinateur)</option>
            <option value="browser">Navigateur — secours gratuit</option>
          </SelectField>
          {value.sttProvider === 'openai' && (
            <TextField label="Modèle STT" value={value.sttModel} onChange={(e) => set('sttModel', e.target.value)} />
          )}
          {value.sttProvider === 'elevenlabs' && (
            <TextField label="Modèle STT" value={value.sttModel} onChange={(e) => set('sttModel', e.target.value)} placeholder="scribe_v2" />
          )}
          {value.sttProvider === 'local' && (
            <TextField label="Modèle faster-whisper" value={value.localSttModel} onChange={(e) => set('localSttModel', e.target.value)} />
          )}
        </div>
        <div className="space-y-3">
          <SelectField
            label="Voix du compagnon (TTS)"
            value={value.ttsProvider}
            onChange={(event) => chooseTts(event.target.value as VoiceProvider)}
          >
            <option value="elevenlabs">ElevenLabs — voix très humaine</option>
            <option value="openai">OpenAI — voix naturelle</option>
            <option value="local">Local — Kokoro (cet ordinateur)</option>
            <option value="browser">Navigateur — secours robotique</option>
          </SelectField>
          {value.ttsProvider === 'openai' && (
            <>
              <TextField label="Modèle TTS" value={value.ttsModel} onChange={(e) => set('ttsModel', e.target.value)} />
              <TextField label="Voix" value={value.voiceId} onChange={(e) => set('voiceId', e.target.value)} placeholder="marin" />
            </>
          )}
          {value.ttsProvider === 'elevenlabs' && (
            <>
              <TextField label="Modèle TTS" value={value.ttsModel} onChange={(e) => set('ttsModel', e.target.value)} placeholder="eleven_v3" />
              <TextField label="Identifiant de voix ElevenLabs" value={value.voiceId} onChange={(e) => set('voiceId', e.target.value)} />
            </>
          )}
          {value.ttsProvider === 'local' && (
            <>
              <TextField label="Modèle Kokoro" value={value.localTtsModel} onChange={(e) => set('localTtsModel', e.target.value)} />
              <TextField label="Voix locale" value={value.localVoiceId} onChange={(e) => set('localVoiceId', e.target.value)} />
            </>
          )}
        </div>
      </div>
      {(value.sttProvider === 'openai' || value.ttsProvider === 'openai') && (
        <TextField
          label={`Clé OpenAI${value.hasOpenaiKey ? ' — déjà enregistrée' : ''}`}
          type="password"
          value={openaiKey}
          onChange={(e) => setOpenaiKey(e.target.value)}
          placeholder={value.hasOpenaiKey ? 'Laisser vide pour conserver la clé' : 'sk-…'}
        />
      )}
      {(value.sttProvider === 'elevenlabs' || value.ttsProvider === 'elevenlabs') && (
        <TextField
          label={`Clé ElevenLabs${value.hasElevenlabsKey ? ' — déjà enregistrée' : ''}`}
          type="password"
          value={elevenKey}
          onChange={(e) => setElevenKey(e.target.value)}
          placeholder={value.hasElevenlabsKey ? 'Laisser vide pour conserver la clé' : 'Clé API ElevenLabs'}
        />
      )}
      {(value.sttProvider === 'local' || value.ttsProvider === 'local') && (
        <Note>
          Speaches tourne localement via <code>https://localhost:8443</code>. Chrome y accède directement depuis cette
          machine : l’audio ne traverse jamais le serveur Dowze. faster-whisper écoute, Kokoro parle.
        </Note>
      )}
      {(value.sttProvider === 'browser' || value.ttsProvider === 'browser') && (
        <Note tone="info">
          Le moteur du navigateur reste un secours. Pour une voix réellement humaine, sélectionne
          ElevenLabs, OpenAI ou Kokoro local.
        </Note>
      )}
      <div className="flex items-center gap-3">
        <Button onClick={() => void save()} disabled={saving}>
          {saving ? 'Enregistrement…' : 'Enregistrer la voix'}
        </Button>
        {message && <span className="text-sm text-muted-foreground">{message}</span>}
      </div>
    </Card>
  );
}
