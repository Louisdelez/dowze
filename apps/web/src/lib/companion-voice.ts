import {
  synthesizeCompanionVoice,
  transcribeCompanionVoice,
  type CompanionVoiceSettings,
} from '@/lib/api';
import { invoke, isDesktop } from '@/lib/desktop';

let playing: HTMLAudioElement | null = null;
let playingUrl: string | null = null;
let audioContext: AudioContext | null = null;
let playingSource: AudioBufferSourceNode | null = null;

/** À appeler pendant le clic/la touche utilisateur, avant que la génération distante ou locale ne
 * commence. Chrome conserve alors un contexte audio autorisé pour lire la réponse différée. */
export function unlockCompanionVoice(): void {
  if (typeof window === 'undefined') return;
  audioContext ??= new AudioContext();
  if (audioContext.state === 'suspended') void audioContext.resume();
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

export function stopCompanionVoice(): void {
  window.speechSynthesis?.cancel();
  if (playingSource) {
    try {
      playingSource.stop();
    } catch {
      // La source peut déjà être terminée ; elle est tout de même détachée ci-dessous.
    }
    playingSource = null;
  }
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
      const pocketForm = new FormData();
      pocketForm.append('text', clean);
      pocketForm.append('voice_url', settings.localVoiceId || 'estelle');
      const response = await fetch(
        pocket
          ? 'https://localhost:8443/pocket/tts'
          : 'https://localhost:8443/v1/audio/speech',
        pocket
          ? { method: 'POST', body: pocketForm }
          : {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({
                model: settings.localTtsModel,
                voice: settings.localVoiceId,
                input: clean,
                response_format: 'mp3',
                speed: 1,
              }),
            },
      );
      if (!response.ok) throw new Error(`Speaches TTS local : ${response.status}`);
      blob = await response.blob();
    }
  } else {
    blob = await synthesizeCompanionVoice(clean);
  }
  unlockCompanionVoice();
  if (audioContext) {
    if (audioContext.state === 'suspended') await audioContext.resume();
    const buffer = await audioContext.decodeAudioData(await blob.arrayBuffer());
    const source = audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(audioContext.destination);
    source.onended = () => {
      if (playingSource === source) playingSource = null;
    };
    playingSource = source;
    source.start();
    return;
  }
  playingUrl = URL.createObjectURL(blob);
  playing = new Audio(playingUrl);
  playing.onended = () => stopCompanionVoice();
  playing.onerror = () => stopCompanionVoice();
  await playing.play();
}
