import { useState, useRef, useCallback, useEffect } from 'react';
import { Mic, Square, Send, Trash2, Play, Pause } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

interface VoiceRecorderProps {
  onRecordingComplete: (blob: Blob) => void;
  onCancel: () => void;
  isRecording: boolean;
  setIsRecording: (recording: boolean) => void;
}

export function VoiceRecorder({ onRecordingComplete, onCancel, isRecording, setIsRecording }: VoiceRecorderProps) {
  const { toast } = useToast();
  const [recordingTime, setRecordingTime] = useState(0);
  const [recorded, setRecorded] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [audioProgress, setAudioProgress] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);

  // Persistent refs — survive re-renders
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, []);

  const startRecording = useCallback(async () => {
    try {
      console.log('MIC_PERMISSION_REQUESTING');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      console.log('MIC_PERMISSION_GRANTED');
      streamRef.current = stream;

      // Determine best mime type
      const mimeType = MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')
        ? 'audio/ogg;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/mp4')
          ? 'audio/mp4'
          : 'audio/mpeg';

      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
          console.log('AUDIO_CHUNK_RECEIVED', e.data.size);
        }
      };

      mediaRecorder.onstop = () => {
        console.log('MEDIARECORDER_STOPPED');
        const blob = new Blob(chunksRef.current, { type: mimeType });
        console.log('AUDIO_BLOB_SIZE', blob.size);

        // Stop microphone
        stream.getTracks().forEach(t => t.stop());
        streamRef.current = null;

        if (blob.size === 0) {
          toast({ title: 'Recording failed', description: 'No audio was captured. Please try again.', variant: 'destructive' });
          setIsRecording(false);
          return;
        }

        setRecorded(blob);
        const url = URL.createObjectURL(blob);
        setPreviewUrl(url);
      };

      // Start recording with timeslice for regular data chunks
      mediaRecorder.start(250);
      console.log('MEDIARECORDER_STARTED');

      setIsRecording(true);
      setRecordingTime(0);
      setRecorded(null);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
      setAudioProgress(0);

      // Start timer
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } catch (error: any) {
      console.error('Microphone error:', error);
      toast({
        title: 'Microphone access denied',
        description: 'Please allow microphone access in your browser settings.',
        variant: 'destructive',
      });
    }
  }, [setIsRecording, toast, previewUrl]);

  const stopRecording = useCallback(() => {
    console.log('STOP_RECORDING_CALLED', mediaRecorderRef.current?.state);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    // Keep isRecording true so preview stays visible
  }, []);

  const cancelAll = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setIsRecording(false);
    setRecorded(null);
    setPreviewUrl(null);
    setRecordingTime(0);
    setAudioProgress(0);
    chunksRef.current = [];
    onCancel();
  }, [setIsRecording, onCancel, previewUrl]);

  const sendRecording = useCallback(() => {
    if (recorded) {
      onRecordingComplete(recorded);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setRecorded(null);
      setPreviewUrl(null);
      setRecordingTime(0);
      setAudioProgress(0);
      setIsRecording(false);
    }
  }, [recorded, onRecordingComplete, setIsRecording, previewUrl]);

  const togglePreview = useCallback(() => {
    if (!audioRef.current || !previewUrl) return;
    if (playing) {
      audioRef.current.pause();
    } else {
      audioRef.current.play().catch(console.error);
    }
    setPlaying(!playing);
  }, [playing, previewUrl]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Preview state after recording
  if (recorded && previewUrl) {
    return (
      <div className="flex items-center gap-2 flex-1 bg-muted rounded-full px-3 py-1.5">
        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive shrink-0" onClick={cancelAll}>
          <Trash2 className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={togglePreview}>
          {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </Button>
        <div className="flex-1 flex items-center gap-2 min-w-0">
          <input
            type="range"
            min={0}
            max={100}
            value={audioProgress}
            onChange={(e) => {
              const pct = Number(e.target.value);
              setAudioProgress(pct);
              if (audioRef.current && audioDuration > 0) {
                audioRef.current.currentTime = (pct / 100) * audioDuration;
              }
            }}
            className="w-full h-1 accent-primary cursor-pointer"
          />
          <span className="text-xs text-muted-foreground whitespace-nowrap">{formatTime(recordingTime)}</span>
        </div>
        <audio
          ref={audioRef}
          src={previewUrl}
          preload="metadata"
          onLoadedMetadata={() => {
            if (audioRef.current && isFinite(audioRef.current.duration)) {
              setAudioDuration(audioRef.current.duration);
            }
          }}
          onTimeUpdate={() => {
            if (audioRef.current && audioDuration > 0) {
              setAudioProgress((audioRef.current.currentTime / audioDuration) * 100);
            }
          }}
          onEnded={() => { setPlaying(false); setAudioProgress(0); }}
          className="hidden"
        />
        <Button size="icon" className="h-9 w-9 rounded-full bg-primary shrink-0" onClick={sendRecording}>
          <Send className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  // Active recording state
  if (isRecording) {
    return (
      <div className="flex items-center gap-2 flex-1 bg-destructive/10 rounded-full px-4 py-2">
        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive shrink-0" onClick={cancelAll}>
          <Trash2 className="h-5 w-5" />
        </Button>
        <div className="flex items-center gap-2 flex-1">
          <div className="h-2.5 w-2.5 rounded-full bg-destructive animate-pulse" />
          <span className="text-sm font-medium text-destructive tabular-nums">{formatTime(recordingTime)}</span>
        </div>
        <Button size="icon" className="h-10 w-10 rounded-full" onClick={stopRecording}>
          <Square className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  // Idle state — mic button
  return (
    <Button variant="ghost" size="icon" className="h-10 w-10 shrink-0" onClick={startRecording}>
      <Mic className="h-5 w-5 text-muted-foreground" />
    </Button>
  );
}
