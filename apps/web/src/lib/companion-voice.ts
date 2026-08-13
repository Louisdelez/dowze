import {
  synthesizeCompanionVoice,
  transcribeCompanionVoice,
  type CompanionVoiceSettings,
} from '@/lib/api';
import { invoke, isDesktop } from '@/lib/desktop';

let playing: HTMLAudioElement | null = null;
let playingUrl: string | null = null;
let voiceGeneration = 0;
let audioPrimed = false;

/** À appeler pendant le clic/la touche utilisateur, avant que la génération distante ou locale ne
 * commence. Chrome conserve alors un contexte audio autorisé pour lire la réponse différée. */
export function unlockCompanionVoice(): void {
  if (typeof window === 'undefined') return;
  playing ??= new Audio();
  playing.volume = 1;
  // WAV PCM mono de quelques millisecondes : associe ce lecteur au geste utilisateur sans bruit.
  if (!audioPrimed) {
    audioPrimed = true;
    playing.src =
      'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQAAAAA=';
    void playing.play().catch(() => {});
  }
}

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

function speechChunks(text: string): string[] {
  const clauses = text.match(/[^,.!?;:]+[,.!?;:]?/g)?.map((part) => part.trim()).filter(Boolean) ?? [text];
  const chunks: string[] = [];
  for (const clause of clauses) {
    const words = clause.split(/\s+/);
    while (words.length) chunks.push(words.splice(0, 7).join(' '));
  }
  return chunks;
}

async function playAudioBlob(blob: Blob, generation: number): Promise<void> {
  if (generation !== voiceGeneration) return;
  unlockCompanionVoice();
  await new Promise<void>((resolve, reject) => {
    if (playingUrl) URL.revokeObjectURL(playingUrl);
    playingUrl = URL.createObjectURL(blob);
    playing ??= new Audio();
    playing.src = playingUrl;
    playing.volume = 1;
    playing.onended = () => resolve();
    playing.onerror = () => reject(new Error('Lecture audio impossible'));
    void playing.play().catch(reject);
  });
}

async function fetchPocketSpeech(text: string, voice: string): Promise<Blob> {
  const form = new FormData();
  form.append('text', text);
  form.append('voice_url', voice || 'estelle');
  const response = await fetch('https://localhost:8443/pocket/tts', { method: 'POST', body: form });
  if (!response.ok) throw new Error(`Pocket TTS local : ${response.status}`);
  return response.blob();
}

export function stopCompanionVoice(): void {
  voiceGeneration += 1;
  window.speechSynthesis?.cancel();
  if (playing) {
    playing.pause();
    playing.removeAttribute('src');
    playing.load();
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
    const response = await fetch('https://localhost:8443/v1/audio/transcriptions', {
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
  const generation = voiceGeneration;
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
      const pocket = settings.localTtsModel.startsWith('pocket-tts');
      if (pocket) {
        const chunks = speechChunks(clean);
        let next = fetchPocketSpeech(chunks[0]!, settings.localVoiceId);
        for (let index = 0; index < chunks.length; index += 1) {
          const audio = await next;
          if (generation !== voiceGeneration) return;
          if (index + 1 < chunks.length) {
            next = fetchPocketSpeech(chunks[index + 1]!, settings.localVoiceId);
          }
          await playAudioBlob(audio, generation);
        }
        return;
      }
      const response = await fetch('https://localhost:8443/v1/audio/speech', {
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
  await playAudioBlob(blob, generation);
}
