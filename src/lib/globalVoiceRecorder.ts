/**
 * GLOBAL VOICE RECORDER CONTROLLER
 * 
 * Persistent recording state that survives component unmounts.
 * Ensures MediaRecorder stream is properly managed across the app lifecycle.
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

  // Subscribe to state changes
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

  // Start recording
  async start(): Promise<{ success: boolean; error?: string }> {
    if (this.controller.state !== 'idle') {
      return { success: false, error: 'Already recording' };
    }

    try {
      // Request microphone permission
      this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Determine best supported mime type
      let mimeType = 'audio/ogg;codecs=opus';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        if (MediaRecorder.isTypeSupported('audio/mp4')) {
          mimeType = 'audio/mp4';
        } else if (MediaRecorder.isTypeSupported('audio/mpeg')) {
          mimeType = 'audio/mpeg';
        } else if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
          mimeType = 'audio/webm;codecs=opus';
        } else if (MediaRecorder.isTypeSupported('audio/webm')) {
          mimeType = 'audio/webm';
        }
      }

      this.mediaRecorder = new MediaRecorder(this.mediaStream, { mimeType });
      this.chunks = [];

      // Handle data chunks
      this.mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          this.chunks.push(e.data);
        }
      };

      // Handle stop event
      this.mediaRecorder.onstop = () => {
        const blob = new Blob(this.chunks, { type: mimeType });
        const url = URL.createObjectURL(blob);

        this.controller.audioBlob = blob;
        this.controller.audioUrl = url;
        this.controller.state = 'stopped';
        
        this.notify();
        this.cleanup();
      };

      // Handle errors
      this.mediaRecorder.onerror = (e: any) => {
        console.error('MediaRecorder error:', e);
        this.reset();
      };

      // Start recording
      this.mediaRecorder.start(100); // Collect data every 100ms
      this.startTimeMs = Date.now();
      this.controller.state = 'recording';
      this.controller.startTime = this.startTimeMs;
      this.controller.duration = 0;

      // Start timer
      this.timerInterval = setInterval(() => {
        if (this.startTimeMs) {
          this.controller.duration = Math.floor((Date.now() - this.startTimeMs) / 1000);
          this.notify();
        }
      }, 1000);

      this.notify();
      return { success: true };

    } catch (error: any) {
      console.error('Failed to start recording:', error);
      this.cleanup();
      return { 
        success: false, 
        error: error.name === 'NotAllowedError' 
          ? 'Microphone access denied. Please allow microphone permission in your browser settings.'
          : 'Failed to access microphone. Please check your device settings.'
      };
    }
  }

  // Stop recording
  stop() {
    if (this.controller.state !== 'recording') {
      return;
    }

    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }

    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }

    // State update happens in onstop handler
  }

  // Cancel recording and discard
  cancel() {
    this.reset();
  }

  // Reset to idle state
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

  // Get audio blob for upload
  getAudioBlob(): Blob | null {
    return this.controller.audioBlob;
  }

  // Check if recording is supported
  static isSupported(): boolean {
    return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder);
  }
}

// Global singleton instance
export const globalVoiceRecorder = new VoiceRecorderController();
