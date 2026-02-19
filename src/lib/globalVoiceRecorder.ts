/**
 * GLOBAL VOICE RECORDER CONTROLLER
 * Persistent recording state that survives component unmounts.
 */

type RecordingState = 'idle' | 'recording' | 'paused' | 'stopped';

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

  private listeners: Set<(controller: RecordingController) => void> = new Set();

  subscribe(listener: (controller: RecordingController) => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach(listener => listener({ ...this.controller }));
  }

  getState(): RecordingController {
    return { ...this.controller };
  }

  async start(): Promise<{ success: boolean; error?: string }> {
    if (this.controller.state !== 'idle') {
      return { success: false, error: 'Already recording' };
    }

    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Prefer OGG/OPUS for WhatsApp compatibility, fallback gracefully
      let mimeType = 'audio/ogg;codecs=opus';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
          mimeType = 'audio/webm;codecs=opus';
        } else if (MediaRecorder.isTypeSupported('audio/webm')) {
          mimeType = 'audio/webm';
        } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
          mimeType = 'audio/mp4';
        } else if (MediaRecorder.isTypeSupported('audio/mpeg')) {
          mimeType = 'audio/mpeg';
        } else {
          mimeType = '';
        }
      }

      this.mediaRecorder = mimeType
        ? new MediaRecorder(this.mediaStream, { mimeType })
        : new MediaRecorder(this.mediaStream);

      this.chunks = [];

      this.mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          this.chunks.push(e.data);
        }
      };

      this.mediaRecorder.onstop = () => {
        const usedMimeType = this.mediaRecorder?.mimeType || mimeType || 'audio/ogg';
        const blob = new Blob(this.chunks, { type: usedMimeType });
        const url = URL.createObjectURL(blob);

        this.controller.audioBlob = blob;
        this.controller.audioUrl = url;
        this.controller.state = 'stopped';

        this.notify();
        this.cleanup();
      };

      this.mediaRecorder.onerror = (e: Event) => {
        console.error('MediaRecorder error:', e);
        this.reset();
      };

      this.mediaRecorder.start(100);
      this.startTimeMs = Date.now();
      this.controller.state = 'recording';
      this.controller.startTime = this.startTimeMs;
      this.controller.duration = 0;

      this.timerInterval = setInterval(() => {
        if (this.startTimeMs) {
          this.controller.duration = Math.floor((Date.now() - this.startTimeMs) / 1000);
          this.notify();
        }
      }, 1000);

      this.notify();
      return { success: true };
    } catch (error: unknown) {
      console.error('Failed to start recording:', error);
      this.cleanup();
      const err = error as { name?: string };
      return {
        success: false,
        error: err.name === 'NotAllowedError'
          ? 'Microphone access denied. Please allow microphone permission in your browser settings.'
          : 'Failed to access microphone. Please check your device settings.',
      };
    }
  }

  stop() {
    if (this.controller.state !== 'recording') return;

    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }

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

    this.cleanup();

    if (this.controller.audioUrl) {
      URL.revokeObjectURL(this.controller.audioUrl);
    }

    this.controller = {
      state: 'idle',
      startTime: null,
      duration: 0,
      audioBlob: null,
      audioUrl: null,
    };

    this.notify();
  }

  private cleanup() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
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
