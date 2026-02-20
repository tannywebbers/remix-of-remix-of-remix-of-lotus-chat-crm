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
import chatBg from '@/assets/chat-bg.png';
import { format, isSameDay, isToday, isYesterday } from 'date-fns';
import { getWhatsAppErrorExplanation } from '@/lib/whatsappErrors';

interface ChatViewProps { onBack?: () => void; showBackButton?: boolean }

export function ChatView({ onBack, showBackButton = false }: ChatViewProps) {
  const { activeChat, messages, addMessage, setMessages, setShowContactPanel, setDraft } = useAppStore();
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

  const formatDaySeparator = (date: Date) => {
    if (isToday(date)) return 'Today';
    if (isYesterday(date)) return 'Yesterday';
    return format(date, 'EEEE, dd MMM yyyy');
  };

  useEffect(() => {
    const unsub = globalVoiceRecorder.subscribe(setRecorderState);
    return () => { unsub(); };
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

    const normalizedPhone = activeChat.contact.phone.replace(/[^\d+]/g, '').replace(/^\+/, '');

    const { data, error } = await supabase.functions.invoke('whatsapp-api', {
      body: {
        action: 'send_message', token: settings.api_token, phoneNumberId: settings.phone_number_id,
        to: normalizedPhone, type, content: mediaUrl || content,
        mediaFileName: mediaMeta?.fileName, mediaMimeType: mediaMeta?.mimeType,
      },
    });

    if (error || !data?.success) {
      const details = getWhatsAppErrorExplanation(data?.error || error?.message || 'Failed to send message');
      toast({ title: details.title, description: details.description, variant: 'destructive' });
      return null;
    }
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
        user_id: user.id, contact_id: activeChat.id, content, type: 'text', is_outgoing: true,
        status: whatsappMessageId ? 'sent' : 'failed', whatsapp_message_id: whatsappMessageId || null,
      }).select().single();

      if (error) throw error;

      addMessage(activeChat.id, {
        id: data.id, contactId: data.contact_id, content: data.content, type: 'text',
        status: whatsappMessageId ? 'sent' : 'failed', isOutgoing: true, timestamp: new Date(data.created_at),
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

  const handleDeleteMessage = async (messageId: string) => {
    if (!activeChat) return;
    const currentMessages = messages[activeChat.id] || [];
    const updatedMessages = currentMessages.filter((m) => m.id !== messageId);

    setMessages(activeChat.id, updatedMessages);

    const lastMessage = updatedMessages.length > 0 ? updatedMessages[updatedMessages.length - 1] : undefined;
    useAppStore.setState((state) => ({
      chats: state.chats.map((chat) => chat.id === activeChat.id ? { ...chat, lastMessage } : chat),
    }));

    try {
      const { error } = await supabase.from('messages').delete().eq('id', messageId);
      if (error) throw error;
    } catch (error: any) {
      setMessages(activeChat.id, currentMessages);
      toast({ title: 'Failed to delete message', description: error.message, variant: 'destructive' });
    }
  };

  const normalizeAudioMime = (mimeType: string) => {
    const normalized = mimeType.toLowerCase();
    if (normalized.includes('mp4') || normalized.includes('m4a') || normalized.includes('aac')) return { mime: 'audio/mp4', ext: 'm4a' };
    if (normalized.includes('ogg') || normalized.includes('mpeg') || normalized.includes('mp3') || normalized.includes('webm')) return { mime: 'audio/mp4', ext: 'm4a' };
    return { mime: 'audio/mp4', ext: 'm4a' };
  };

  const handleFileUpload = async (file: File, type: 'image' | 'document' | 'audio') => {
    if (!activeChat || !user) return;
    setUploading(true);

    try {
      const normalizedAudio = type === 'audio' ? normalizeAudioMime(file.type) : null;
      const mimeType = normalizedAudio ? normalizedAudio.mime : (file.type || 'application/octet-stream');
      const ext = normalizedAudio ? normalizedAudio.ext : (file.name.split('.').pop() || 'bin');
      const safeName = type === 'audio' ? `voice-${Date.now()}.${ext}` : file.name;
      const uploadFile = type === 'audio' ? new File([file], safeName, { type: mimeType }) : file;

      const filePath = `${user.id}/${activeChat.id}/${Date.now()}-${safeName}`;
      const { error: uploadError } = await supabase.storage.from('chat-media').upload(filePath, uploadFile, { contentType: mimeType, upsert: false });
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from('chat-media').getPublicUrl(filePath);
      const mediaUrl = urlData.publicUrl;

      const msgType = type === 'audio' ? 'audio' : type;
      const whatsappMessageId = await sendMessageToWhatsApp(uploadFile.name, msgType, mediaUrl, { fileName: uploadFile.name, mimeType });

      const { data, error } = await supabase.from('messages').insert({
        user_id: user.id, contact_id: activeChat.id, content: uploadFile.name,
        type: msgType, status: whatsappMessageId ? 'sent' : 'failed', is_outgoing: true,
        media_url: mediaUrl, whatsapp_message_id: whatsappMessageId || null,
      }).select().single();
      if (error) throw error;

      addMessage(activeChat.id, {
        id: data.id, contactId: data.contact_id, content: data.content, type: msgType,
        status: whatsappMessageId ? 'sent' : 'failed', isOutgoing: true, timestamp: new Date(data.created_at), mediaUrl,
      });
    } catch (error: any) {
      toast({ title: 'Failed to upload file', description: error.message, variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  if (!activeChat) {
    return (
      <div className="flex-1 flex items-center justify-center chat-background" style={{ backgroundImage: `url(${chatBg})`, backgroundAttachment: 'fixed', backgroundSize: 'cover' }}>
        <div className="text-center p-8 rounded-2xl">
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
        {showBackButton && <Button variant="ghost" size="icon" onClick={onBack}><ArrowLeft className="h-5 w-5" /></Button>}
        <button className="flex items-center gap-2 flex-1 min-w-0" onClick={() => setShowContactPanel(true)}>
          <ContactAvatar name={contact.name} avatar={contact.avatar} isOnline={contact.isOnline} size="md" />
          <div className="min-w-0 text-left">
            <p className="font-semibold truncate">{contact.name}</p>
            <p className="text-xs text-muted-foreground truncate">{contact.phone}</p>
          </div>
        </button>
        <ChatOptionsMenu
          chatId={activeChat.id}
          contactName={contact.name}
          isPinned={activeChat.isPinned || contact.isPinned}
          isMuted={activeChat.isMuted || contact.isMuted}
          isArchived={activeChat.isArchived || contact.isArchived}
          onViewContact={() => setShowContactPanel(true)}
        />
      </div>

      <div ref={messagesContainerRef} className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
        {chatMessages.map((message, idx) => {
          const showDaySeparator = idx === 0 || !isSameDay(new Date(chatMessages[idx - 1].timestamp), new Date(message.timestamp));
          return (
            <div key={message.id}>
              {showDaySeparator && (
                <div className="conversation-day-separator">
                  <span>{formatDaySeparator(new Date(message.timestamp))}</span>
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
              <div><FileUploadButton onFileSelect={(file, type) => handleFileUpload(file, type)} uploading={uploading} /></div>
              <UnifiedTemplateSelector
                contact={contact}
                onSelectMetaTemplate={handleSendMetaTemplate}
                onInsertAppTemplate={(text) => {
                  setInputValue((prev) => prev + text);
                  setDraft(activeChat.id, inputValue + text);
                }}
              />
            </>
          )}

          {recorderState.state !== 'idle' ? (
            <VoiceRecorderButton
              onRecordingComplete={(blob) => {
                const mapped = normalizeAudioMime(blob.type || 'audio/ogg');
                const file = new File([blob], `voice-${Date.now()}.${mapped.ext}`, { type: mapped.mime });
                handleFileUpload(file, 'audio');
              }}
              disabled={sending || uploading}
            />
          ) : (
            <>
              <div className="flex-1 flex items-end bg-background rounded-[25px] px-3 py-1 border border-input shadow-sm">
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
                  className="flex-1 resize-none border-0 focus:outline-none min-h-[32px] max-h-[100px] py-[5px] text-[15px] bg-transparent leading-[1.3]"
                  disabled={sending || uploading}
                />
              </div>

              {inputValue.trim()
                ? <Button size="icon" className="h-[40px] w-[40px] shrink-0 rounded-full bg-primary hover:bg-primary/90 shadow-sm" onClick={handleSend} disabled={sending || uploading}><Send className="h-[18px] w-[18px]" /></Button>
                : (
                  <VoiceRecorderButton
                    onRecordingComplete={(blob) => {
                      const mapped = normalizeAudioMime(blob.type || 'audio/ogg');
                      const file = new File([blob], `voice-${Date.now()}.${mapped.ext}`, { type: mapped.mime });
                      handleFileUpload(file, 'audio');
                    }}
                    disabled={sending || uploading}
                  />
                )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
