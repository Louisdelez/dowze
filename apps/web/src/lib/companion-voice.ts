import {
  synthesizeCompanionVoice,
  transcribeCompanionVoice,
  type CompanionVoiceSettings,
} from '@/lib/api';
import { invoke, isDesktop } from '@/lib/desktop';

let playing: HTMLAudioElement | null = null;
let playingUrl: string | null = null;

function cleanSpeech(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, 'un extrait de code')
    .replace(/[*_#`]/g, '')
    .replace(/https?:\/\/\S+/g, 'le lien associé')
    .slice(0, 1200);
}

async function blobBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return btoa(binary);
}

function base64Blob(encoded: string, mime: string): Blob {
  const binary = atob(encoded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

export function stopCompanionVoice(): void {
  window.speechSynthesis?.cancel();
  if (playing) {
    playing.pause();
    playing.src = '';
    playing = null;
  }
  if (playingUrl) URL.revokeObjectURL(playingUrl);
  playingUrl = null;
}

export async function transcribeRecordedVoice(
  audio: Blob,
  settings: CompanionVoiceSettings,
): Promise<string> {
  if (settings.sttProvider === 'local') {
    if (isDesktop()) {
      const result = await invoke<{ text?: string }>('voice_request', {
        payload: {
          operation: 'transcribe',
          audioBase64: await blobBase64(audio),
          mime: audio.type || 'audio/webm',
          model: settings.localSttModel,
        },
      });
      return result.text?.trim() ?? '';
    }
    const form = new FormData();
    form.append('file', audio, 'voice.webm');
    form.append('model', settings.localSttModel);
    const response = await fetch('http://127.0.0.1:8000/v1/audio/transcriptions', {
      method: 'POST',
      body: form,
    });
    if (!response.ok) throw new Error(`Speaches STT local : ${response.status}`);
    return ((await response.json()) as { text?: string }).text?.trim() ?? '';
  }
  return transcribeCompanionVoice(audio);
}

export async function speakCompanionNaturally(
  text: string,
  settings: CompanionVoiceSettings,
  browserRate = 1,
  browserPitch = 1,
): Promise<void> {
  stopCompanionVoice();
  const clean = cleanSpeech(text);
  if (settings.ttsProvider === 'browser') {
    const utterance = new SpeechSynthesisUtterance(clean);
    utterance.lang = 'fr-FR';
    utterance.rate = browserRate;
    utterance.pitch = browserPitch;
    window.speechSynthesis.speak(utterance);
    return;
  }
  let blob: Blob;
  if (settings.ttsProvider === 'local') {
    if (isDesktop()) {
      const result = await invoke<{ audioBase64: string; mime?: string }>('voice_request', {
        payload: {
          operation: 'synthesize',
          text: clean,
          model: settings.localTtsModel,
          voice: settings.localVoiceId,
        },
      });
      blob = base64Blob(result.audioBase64, result.mime ?? 'audio/mpeg');
    } else {
      const response = await fetch('http://127.0.0.1:8000/v1/audio/speech', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          model: settings.localTtsModel,
          voice: settings.localVoiceId,
          input: clean,
          response_format: 'mp3',
          speed: 1,
        }),
      });
      if (!response.ok) throw new Error(`Speaches TTS local : ${response.status}`);
      blob = await response.blob();
    }
  } else {
    blob = await synthesizeCompanionVoice(clean);
  }
  playingUrl = URL.createObjectURL(blob);
  playing = new Audio(playingUrl);
  playing.onended = () => stopCompanionVoice();
  playing.onerror = () => stopCompanionVoice();
  await playing.play();
}
