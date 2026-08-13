import {
  synthesizeCompanionVoice,
  transcribeCompanionVoice,
  type CompanionVoiceSettings,
} from '@/lib/api';
import { invoke, isDesktop } from '@/lib/desktop';
import { decode, encode } from '@msgpack/msgpack';

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

type KyutaiMessage =
  | { type: 'Audio'; pcm: number[] | Float32Array }
  | { type: 'Error'; message: string }
  | { type: 'Ready' | 'Text' };

async function speakWithKyutai(
  text: string,
  voice: string,
  onStart?: () => void,
): Promise<void> {
  unlockCompanionVoice();
  if (!audioContext) throw new Error('Contexte audio indisponible');
  if (audioContext.state === 'suspended') await audioContext.resume();
  const context = audioContext;
  const endpoint = 'wss://localhost:8443/kyutai/api/tts_streaming';
  const url = `${endpoint}?format=PcmMessagePack&auth_id=public_token&cfg_alpha=1.5&voice=${encodeURIComponent(voice)}`;
  await new Promise<void>((resolve, reject) => {
    const socket = new WebSocket(url);
    socket.binaryType = 'arraybuffer';
    let nextStart = context.currentTime;
    let started = false;
    let completed = false;
    const finish = () => {
      if (completed) return;
      completed = true;
      const remaining = Math.max(0, nextStart - context.currentTime);
      window.setTimeout(resolve, remaining * 1000);
    };
    const timeout = window.setTimeout(() => {
      socket.close();
      reject(new Error('Kyutai Unmute local ne répond pas'));
    }, 15_000);
    socket.onopen = () => {
      window.clearTimeout(timeout);
      socket.send(encode({ type: 'Text', text }));
      socket.send(encode({ type: 'Eos' }));
    };
    socket.onmessage = (event) => {
      const message = decode(new Uint8Array(event.data as ArrayBuffer)) as KyutaiMessage;
      if (message.type === 'Error') {
        socket.close();
        reject(new Error(message.message));
        return;
      }
      if (message.type !== 'Audio' || !message.pcm.length) return;
      const pcm = message.pcm instanceof Float32Array ? message.pcm : new Float32Array(message.pcm);
      const buffer = context.createBuffer(1, pcm.length, 24_000);
      buffer.getChannelData(0).set(pcm);
      const source = context.createBufferSource();
      source.buffer = buffer;
      source.connect(context.destination);
      if (!started) {
        started = true;
        onStart?.();
        nextStart = context.currentTime + 0.04;
      }
      source.start(nextStart);
      nextStart += buffer.duration;
    };
    socket.onerror = () => reject(new Error('Connexion Kyutai Unmute impossible'));
    socket.onclose = finish;
  });
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
  onStart?: () => void,
): Promise<void> {
  stopCompanionVoice();
  const clean = cleanSpeech(text);
  if (settings.ttsProvider === 'browser') {
    const utterance = new SpeechSynthesisUtterance(clean);
    utterance.lang = 'fr-FR';
    utterance.rate = browserRate;
    utterance.pitch = browserPitch;
    await new Promise<void>((resolve, reject) => {
      utterance.onend = () => resolve();
      utterance.onerror = () => reject(new Error('Synthèse vocale du navigateur impossible'));
      utterance.onstart = () => onStart?.();
      window.speechSynthesis.speak(utterance);
    });
    return;
  }
  let blob: Blob;
  if (settings.ttsProvider === 'local') {
    if (settings.localTtsModel === 'kyutai/tts-1.6b-en_fr') {
      try {
        await speakWithKyutai(clean, settings.localVoiceId, onStart);
        return;
      } catch {
        await speakCompanionNaturally(
          clean,
          { ...settings, localTtsModel: 'pocket-tts-french-24l', localVoiceId: 'estelle' },
          browserRate,
          browserPitch,
          onStart,
        );
        return;
      }
    }
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
    await new Promise<void>((resolve) => {
      source.onended = () => {
        if (playingSource === source) playingSource = null;
        resolve();
      };
      playingSource = source;
      onStart?.();
      source.start();
    });
    return;
  }
  playingUrl = URL.createObjectURL(blob);
  playing = new Audio(playingUrl);
  await new Promise<void>((resolve, reject) => {
    playing!.onended = () => {
      stopCompanionVoice();
      resolve();
    };
    playing!.onerror = () => {
      stopCompanionVoice();
      reject(new Error('Lecture audio impossible'));
    };
    void playing!
      .play()
      .then(() => onStart?.())
      .catch(reject);
  });
}
