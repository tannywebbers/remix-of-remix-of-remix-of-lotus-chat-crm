import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, MessageCircle, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAppStore } from '@/store/appStore';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { ContactAvatar } from '@/components/shared/ContactAvatar';
import { MessageBubble } from '@/components/chat/MessageBubble';
import { ChatOptionsMenu } from '@/components/chat/ChatOptionsMenu';
import { FileUploadButton } from '@/components/chat/FileUploadButton';
import { UnifiedTemplateSelector } from '@/components/chat/UnifiedTemplateSelector';
import { VoiceRecorderButton } from '@/components/chat/VoiceRecorderButton';
import { ImagePastePreview } from '@/components/chat/ImagePastePreview';
import { globalVoiceRecorder } from '@/lib/globalVoiceRecorder';
import { isContactOnline } from '@/lib/utils/presence';
import { formatLastSeen } from '@/lib/utils/format';
import chatBg from '@/assets/chat-bg.png';

interface ChatViewProps { onBack?: () => void; showBackButton?: boolean }

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function formatDateSeparator(date: Date): string {
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (isSameDay(date, today)) return 'Today';
  if (isSameDay(date, yesterday)) return 'Yesterday';
  return date.toLocaleDateString('en-NG', { weekday: 'long', day: '2-digit', month: 'short', year: 'numeric' });
}

export function ChatView({ onBack, showBackButton = false }: ChatViewProps) {
  const { activeChat, messages, addMessage, setMessages, setShowContactPanel, setDraft, updateMessageStatus } = useAppStore();
  const { user } = useAuth();
  const { toast } = useToast();

  const [inputValue, setInputValue] = useState('');
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [recorderState, setRecorderState] = useState(globalVoiceRecorder.getState());
  const [pastedImageFile, setPastedImageFile] = useState<File | null>(null);

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const chatMessages = activeChat ? messages[activeChat.id] || [] : [];

  useEffect(() => {
    const unsub = globalVoiceRecorder.subscribe(setRecorderState);
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!activeChat) return;
    setInputValue(useAppStore.getState().drafts?.[activeChat.id] || '');
  }, [activeChat?.id]);

  const scrollToBottom = useCallback(() => {
    if (!messagesContainerRef.current) return;
    messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
  }, []);

  useEffect(() => { scrollToBottom(); }, [chatMessages.length, scrollToBottom]);

  useEffect(() => {
    if (!activeChat || !user) return;
    const updateChannel = supabase
      .channel(`messages-update-${activeChat.id}`)
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'messages', filter: `contact_id=eq.${activeChat.id}`,
      }, (payload) => {
        const m = payload.new as any;
        updateMessageStatus(activeChat.id, m.id as string, m.status as any);
      })
      .subscribe();

    return () => { supabase.removeChannel(updateChannel); };
  }, [activeChat?.id, user, updateMessageStatus]);

  const sendMessageToWhatsApp = async (
    content: string,
    type: 'text' | 'image' | 'document' | 'audio' = 'text',
    mediaUrl?: string,
    mediaMeta?: { fileName?: string; mimeType?: string },
  ) => {
    if (!activeChat || !user) return null;

    const { data: settings } = await supabase.from('whatsapp_settings').select('*').eq('user_id', user.id).single();
    if (!settings?.api_token || !settings?.phone_number_id) {
      toast({ title: 'WhatsApp not configured', variant: 'destructive' });
      return null;
    }

    const { data, error } = await supabase.functions.invoke('whatsapp-api', {
      body: {
        action: 'send_message', token: settings.api_token, phoneNumberId: settings.phone_number_id,
        to: activeChat.contact.phone, type, content: mediaUrl || content,
        mediaFileName: mediaMeta?.fileName, mediaMimeType: mediaMeta?.mimeType,
      },
    });

    if (error || !data?.success) return null;
    return data.messageId as string;
  };

  const handleSend = async () => {
    if (!inputValue.trim() || !activeChat || !user) return;
    const content = inputValue.trim();
    setInputValue('');
    setDraft(activeChat.id, '');
    setSending(true);

    try {
      const whatsappMessageId = await sendMessageToWhatsApp(content);
      const { data, error } = await supabase.from('messages').insert({
        user_id: user.id,
        contact_id: activeChat.id,
        content,
        type: 'text',
        is_outgoing: true,
        status: whatsappMessageId ? 'sent' : 'failed',
        whatsapp_message_id: whatsappMessageId || null,
      }).select().single();

      if (error) throw error;

      addMessage(activeChat.id, {
        id: data.id,
        contactId: data.contact_id,
        content: data.content,
        type: 'text',
        status: whatsappMessageId ? 'sent' : 'failed',
        isOutgoing: true,
        timestamp: new Date(data.created_at),
        whatsappMessageId: whatsappMessageId || undefined,
      });
      requestAnimationFrame(() => inputRef.current?.focus());
    } catch (error: any) {
      toast({ title: 'Failed to send', description: error.message, variant: 'destructive' });
      setInputValue(content);
    } finally {
      setSending(false);
    }
  };

  const normalizeAudioMime = (mimeType: string) => {
    const normalized = mimeType.toLowerCase();
    if (normalized.includes('ogg')) return { mime: 'audio/ogg', ext: 'ogg', whatsappType: 'audio' as const };
    if (normalized.includes('mpeg') || normalized.includes('mp3')) return { mime: 'audio/mpeg', ext: 'mp3', whatsappType: 'audio' as const };
    if (normalized.includes('webm')) return { mime: 'audio/webm', ext: 'webm', whatsappType: 'document' as const };
    return { mime: 'audio/ogg', ext: 'ogg', whatsappType: 'audio' as const };
  };

  const handleFileUpload = async (file: File, type: 'image' | 'document' | 'audio') => {
    if (!activeChat || !user) return;
    setUploading(true);

    try {
      const normalizedAudio = type === 'audio' ? normalizeAudioMime(file.type || 'audio/ogg') : null;
      const mimeType = normalizedAudio ? normalizedAudio.mime : (file.type || 'application/octet-stream');
      const ext = normalizedAudio ? normalizedAudio.ext : (file.name.split('.').pop() || 'bin');
      const safeName = type === 'audio' ? `voice-${Date.now()}.${ext}` : file.name;
      const uploadFile = type === 'audio' ? new File([file], safeName, { type: mimeType }) : file;

      const filePath = `${user.id}/${activeChat.id}/${Date.now()}-${safeName}`;
      const { error: uploadError } = await supabase.storage.from('chat-media').upload(filePath, uploadFile, { contentType: mimeType, upsert: false });
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from('chat-media').getPublicUrl(filePath);
      const mediaUrl = urlData.publicUrl;

      const msgType = type === 'audio' ? normalizedAudio!.whatsappType : type;
      const whatsappMessageId = await sendMessageToWhatsApp(uploadFile.name, msgType, mediaUrl, { fileName: uploadFile.name, mimeType });

      if (type === 'audio' && normalizedAudio?.whatsappType === 'document') {
        toast({ title: 'Voice sent as file', description: 'This browser produced WEBM audio. It was delivered as a file for reliable delivery.' });
      }

      const { data, error } = await supabase.from('messages').insert({
        user_id: user.id,
        contact_id: activeChat.id,
        content: uploadFile.name,
        type: msgType,
        status: whatsappMessageId ? 'sent' : 'failed',
        is_outgoing: true,
        media_url: mediaUrl,
        whatsapp_message_id: whatsappMessageId || null,
      }).select().single();
      if (error) throw error;

      addMessage(activeChat.id, {
        id: data.id,
        contactId: data.contact_id,
        content: data.content,
        type: msgType,
        status: whatsappMessageId ? 'sent' : 'failed',
        isOutgoing: true,
        timestamp: new Date(data.created_at),
        mediaUrl,
      });
    } catch (error: any) {
      toast({ title: 'Failed to upload file', description: error.message, variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    if (!activeChat) return;
    const { error } = await supabase.from('messages').delete().eq('id', messageId);
    if (error) {
      toast({ title: 'Failed to delete message', description: error.message, variant: 'destructive' });
      return;
    }

    const updated = chatMessages.filter((m) => m.id !== messageId);
    setMessages(activeChat.id, updated);
    toast({ title: 'Message deleted' });
  };

  if (!activeChat) {
    return (
      <div className="flex-1 flex items-center justify-center chat-background" style={{ backgroundImage: `url(${chatBg})`, backgroundAttachment: 'fixed', backgroundSize: 'cover' }}>
        <div className="text-center p-8">
          <MessageCircle className="w-14 h-14 text-primary/70 mx-auto mb-3" />
          <h2 className="text-[40px] text-foreground/80 mb-1">WABA</h2>
          <p className="text-muted-foreground">Click a chat to start messaging</p>
        </div>
      </div>
    );
  }

  const contact = activeChat.contact;

  return (
    <div className="flex-1 flex flex-col h-full min-h-0 chat-background" style={{ backgroundImage: `url(${chatBg})`, backgroundAttachment: 'fixed', backgroundSize: 'cover' }}>
      <div className="flex items-center gap-2 px-3 py-2 border-b border-panel-border bg-panel-header/95">
        {showBackButton && <Button variant="ghost" size="icon" onClick={onBack}><ArrowLeft className="h-5 w-5 text-black" /></Button>}
        <button className="flex items-center gap-2 flex-1 min-w-0" onClick={() => setShowContactPanel(true)}>
          <ContactAvatar name={contact.name} avatar={contact.avatar} isOnline={contact.isOnline} lastSeen={contact.lastSeen} size="md" />
          <div className="min-w-0 text-left">
            <p className="font-semibold truncate">{contact.name}</p>
            <p className="text-xs text-muted-foreground truncate">{isContactOnline(contact.lastSeen, contact.isOnline) ? 'Online' : (contact.lastSeen ? formatLastSeen(contact.lastSeen) : 'Offline')}</p>
          </div>
        </button>

        <ChatOptionsMenu
          chatId={activeChat.id}
          contactName={contact.name}
          isPinned={!!activeChat.isPinned}
          isMuted={!!activeChat.isMuted}
          isArchived={!!activeChat.isArchived}
          onViewContact={() => setShowContactPanel(true)}
        />
      </div>

      <div ref={messagesContainerRef} className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
        {chatMessages.map((message, idx) => {
          const prev = chatMessages[idx - 1];
          const showSeparator = !prev || !isSameDay(prev.timestamp, message.timestamp);
          return (
            <div key={message.id}>
              {showSeparator && (
                <div className="flex justify-center my-2">
                  <span className="px-2.5 py-1 rounded-full text-[12px] bg-muted/80 text-muted-foreground">{formatDateSeparator(message.timestamp)}</span>
                </div>
              )}
              <MessageBubble message={message} onDelete={() => handleDeleteMessage(message.id)} />
            </div>
          );
        })}
      </div>

      <ImagePastePreview
        file={pastedImageFile}
        onCancel={() => setPastedImageFile(null)}
        onConfirm={async (file) => { setPastedImageFile(null); await handleFileUpload(file, 'image'); }}
      />

      <div className="px-2 sm:px-3 py-1.5 bg-panel-header border-t border-panel-border">
        <div className="flex items-end gap-1.5 max-w-3xl mx-auto">
          {recorderState.state === 'idle' && (
            <>
              <div className="text-black"><FileUploadButton onFileSelect={(file, type) => handleFileUpload(file, type)} uploading={uploading} /></div>
              <UnifiedTemplateSelector contact={contact} onSelectMetaTemplate={async () => {}} onInsertAppTemplate={(text) => {
                setInputValue((prev) => prev + text);
                setDraft(activeChat.id, inputValue + text);
              }} />
            </>
          )}

          {recorderState.state !== 'idle' ? (
            <VoiceRecorderButton onRecordingComplete={(blob) => {
              const mapped = normalizeAudioMime(blob.type || 'audio/ogg');
              const file = new File([blob], `voice-${Date.now()}.${mapped.ext}`, { type: mapped.mime });
              handleFileUpload(file, 'audio');
            }} disabled={sending || uploading} />
          ) : (
            <>
              <div className="flex-1 flex items-end bg-background rounded-[40px] px-3 py-1 border border-input shadow-sm">
                <textarea
                  ref={inputRef}
                  value={inputValue}
                  onChange={(e) => {
                    setInputValue(e.target.value);
                    setDraft(activeChat.id, e.target.value);
                  }}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                  placeholder="Message"
                  rows={1}
                  className="flex-1 resize-none border-0 focus:outline-none min-h-[36px] max-h-[120px] py-[7px] text-[16px] bg-transparent leading-[1.3]"
                  disabled={sending || uploading}
                />
              </div>

              {inputValue.trim()
                ? <Button size="icon" className="h-[40px] w-[40px] shrink-0 rounded-full bg-primary hover:bg-primary/90 shadow-sm" onClick={handleSend} disabled={sending || uploading}><Send className="h-[18px] w-[18px]" /></Button>
                : <VoiceRecorderButton onRecordingComplete={(blob) => {
                  const mapped = normalizeAudioMime(blob.type || 'audio/ogg');
                  const file = new File([blob], `voice-${Date.now()}.${mapped.ext}`, { type: mapped.mime });
                  handleFileUpload(file, 'audio');
                }} disabled={sending || uploading} />}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
