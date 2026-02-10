import { useState, useRef, useCallback } from 'react';
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
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : 'audio/webm';
      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        stream.getTracks().forEach(t => t.stop());
        setRecorded(blob);
        setPreviewUrl(URL.createObjectURL(blob));
      };

      mediaRecorder.start(100);
      setIsRecording(true);
      setRecordingTime(0);
      setRecorded(null);
      setPreviewUrl(null);

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
  }, [setIsRecording, toast]);

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (timerRef.current) clearInterval(timerRef.current);
    setIsRecording(false);
  };

  const cancelAll = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    streamRef.current?.getTracks().forEach(t => t.stop());
    if (timerRef.current) clearInterval(timerRef.current);
    setIsRecording(false);
    setRecorded(null);
    setPreviewUrl(null);
    chunksRef.current = [];
    onCancel();
  };

  const sendRecording = () => {
    if (recorded) {
      onRecordingComplete(recorded);
      setRecorded(null);
      setPreviewUrl(null);
    }
  };

  const togglePreview = () => {
    if (!audioRef.current || !previewUrl) return;
    if (playing) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setPlaying(!playing);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Preview state after recording
  if (recorded && previewUrl) {
    return (
      <div className="flex items-center gap-2 flex-1 bg-muted rounded-full px-3 py-1.5">
        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={cancelAll}>
          <Trash2 className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={togglePreview}>
          {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </Button>
        <span className="text-sm text-muted-foreground flex-1">{formatTime(recordingTime)}</span>
        <audio ref={audioRef} src={previewUrl} onEnded={() => setPlaying(false)} className="hidden" />
        <Button size="icon" className="h-9 w-9 rounded-full bg-primary" onClick={sendRecording}>
          <Send className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  // Active recording state
  if (isRecording) {
    return (
      <div className="flex items-center gap-2 flex-1 bg-destructive/10 rounded-full px-4 py-2">
        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={cancelAll}>
          <Trash2 className="h-5 w-5" />
        </Button>
        <div className="flex items-center gap-2 flex-1">
          <div className="h-2 w-2 rounded-full bg-destructive animate-pulse" />
          <span className="text-sm font-medium text-destructive">{formatTime(recordingTime)}</span>
        </div>
        <Button size="icon" className="h-10 w-10 rounded-full" onClick={stopRecording}>
          <Square className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  // Idle state
  return (
    <Button variant="ghost" size="icon" className="h-10 w-10 shrink-0" onClick={startRecording}>
      <Mic className="h-5 w-5 text-muted-foreground" />
    </Button>
  );
}
