/**
 * Global voice recorder controller.
 */

type RecordingState = 'idle' | 'recording' | 'stopped';

interface RecordingController {
  state: RecordingState;
  startTime: number | null;
  duration: number;
  audioBlob: Blob | null;
  audioUrl: string | null;
}

class VoiceRecorderController {
  private mediaStream: MediaStream | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private timerInterval: ReturnType<typeof setInterval> | null = null;
  private startTimeMs: number | null = null;

  private controller: RecordingController = {
    state: 'idle',
    startTime: null,
    duration: 0,
    audioBlob: null,
    audioUrl: null,
  };

  private listeners = new Set<(controller: RecordingController) => void>();

  subscribe(listener: (controller: RecordingController) => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach((listener) => listener({ ...this.controller }));
  }

  getState(): RecordingController {
    return { ...this.controller };
  }

  private resolveMimeType(): string {
    const preferred = [
      'audio/mp4',
      'audio/aac',
      'audio/ogg;codecs=opus',
      'audio/ogg',
      'audio/mpeg',
    ];

    for (const type of preferred) {
      if (MediaRecorder.isTypeSupported(type)) return type;
    }

    return '';
  }

  async start(): Promise<{ success: boolean; error?: string }> {
    if (this.controller.state !== 'idle') {
      return { success: false, error: 'Already recording' };
    }

    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = this.resolveMimeType();

      this.mediaRecorder = mimeType
        ? new MediaRecorder(this.mediaStream, { mimeType })
        : new MediaRecorder(this.mediaStream);

      this.chunks = [];

      this.mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) this.chunks.push(e.data);
      };

      this.mediaRecorder.onstop = () => {
        const recorderMime = this.mediaRecorder?.mimeType || mimeType || 'audio/mp4';
        const normalizedMime = recorderMime.includes('mp4') || recorderMime.includes('aac')
          ? 'audio/mp4'
          : recorderMime.includes('ogg')
            ? 'audio/ogg'
            : recorderMime.includes('mpeg')
              ? 'audio/mpeg'
              : 'audio/mp4';
        const blob = new Blob(this.chunks, { type: normalizedMime });
        const url = URL.createObjectURL(blob);

        this.controller.audioBlob = blob;
        this.controller.audioUrl = url;
        this.controller.state = 'stopped';

        this.notify();
        this.cleanupMedia();
      };

      this.mediaRecorder.start(200);
      this.startTimeMs = Date.now();
      this.controller.state = 'recording';
      this.controller.startTime = this.startTimeMs;
      this.controller.duration = 0;

      this.timerInterval = setInterval(() => {
        if (!this.startTimeMs) return;
        this.controller.duration = Math.floor((Date.now() - this.startTimeMs) / 1000);
        this.notify();
      }, 1000);

      this.notify();
      return { success: true };
    } catch (error: unknown) {
      this.reset();
      const err = error as { name?: string };
      return {
        success: false,
        error:
          err.name === 'NotAllowedError'
            ? 'Microphone access denied. Please allow microphone permission in your browser settings.'
            : 'Failed to access microphone. Please check your device settings.',
      };
    }
  }

  stop() {
    if (this.controller.state !== 'recording') return;
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') this.mediaRecorder.stop();
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  cancel() {
    this.reset();
  }

  reset() {
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }

    this.cleanupMedia();

    if (this.controller.audioUrl) URL.revokeObjectURL(this.controller.audioUrl);

    this.controller = {
      state: 'idle',
      startTime: null,
      duration: 0,
      audioBlob: null,
      audioUrl: null,
    };

    this.notify();
  }

  private cleanupMedia() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }

    this.startTimeMs = null;
  }

  getAudioBlob(): Blob | null {
    return this.controller.audioBlob;
  }

  static isSupported(): boolean {
    return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder);
  }
}

export const globalVoiceRecorder = new VoiceRecorderController();
