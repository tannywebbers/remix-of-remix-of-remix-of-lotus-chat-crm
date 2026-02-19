import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, MoreVertical, Info, ArrowLeft, Trash2, Pin, BellOff, Archive, X, MessageCircle, AlertTriangle, Star, User } from 'lucide-react';
import { useAppStore } from '@/store/appStore';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { ContactAvatar } from '@/components/shared/ContactAvatar';
import { MessageBubble } from '@/components/chat/MessageBubble';
import { FileUploadButton } from '@/components/chat/FileUploadButton';
import { UnifiedTemplateSelector } from '@/components/chat/UnifiedTemplateSelector';
import { VoiceRecorderButton } from '@/components/chat/VoiceRecorderButton';
import { ImagePastePreview } from '@/components/chat/ImagePastePreview';
import { globalVoiceRecorder } from '@/lib/globalVoiceRecorder';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { formatLastSeen } from '@/lib/utils/format';
import { isContactOnline } from '@/lib/utils/presence';
import { Message } from '@/types';

interface MetaTemplate {
  id: string; template_id: string; name: string; language: string; category: string; status: string; components: unknown;
}
import { useToast } from '@/hooks/use-toast';
import { getWhatsAppErrorExplanation } from '@/lib/whatsappErrors';
import chatBg from '@/assets/chat-bg.png';

interface ChatViewProps {
  onBack?: () => void;
  showBackButton?: boolean;
}

// Date separator helpers
function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}

function formatDateSeparator(date: Date): string {
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (isSameDay(date, today)) return 'Today';
  if (isSameDay(date, yesterday)) return 'Yesterday';
  return date.toLocaleDateString('en-NG', { year: 'numeric', month: 'long', day: 'numeric' });
}

export function ChatView({ onBack, showBackButton = false }: ChatViewProps) {
  const { activeChat, messages, addMessage, setMessages, setShowContactPanel, updateContact, setDraft, updateMessageStatus, favorites, toggleFavorite } = useAppStore();
  const { user } = useAuth();
  const { toast } = useToast();
  const draft = activeChat ? useAppStore.getState().drafts?.[activeChat.id] || '' : '';
  const [inputValue, setInputValue] = useState(draft);
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [recorderState, setRecorderState] = useState(globalVoiceRecorder.getState());
  const [pastedImageFile, setPastedImageFile] = useState<File | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const chatMessages = activeChat ? messages[activeChat.id] || [] : [];
  const hasCustomerReply = chatMessages.some(m => !m.isOutgoing);
  const hasAnyMessages = chatMessages.length > 0;
  const showBusinessNotice = hasAnyMessages && !hasCustomerReply;
  const isFav = activeChat ? useAppStore.getState().favorites[activeChat.id] : false;

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'auto') => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  }, []);

  useEffect(() => {
    const unsub = globalVoiceRecorder.subscribe(setRecorderState);
    return () => { unsub(); };
  }, []);

  useEffect(() => {
    scrollToBottom('auto');
  }, [chatMessages.length]);

  useEffect(() => {
    if (activeChat) {
      setInputValue(useAppStore.getState().drafts?.[activeChat.id] || '');
      markMessagesAsRead();
      requestAnimationFrame(() => scrollToBottom('auto'));
    }
  }, [activeChat?.id]);

  // Mobile keyboard — keep input visible using visual viewport
  useEffect(() => {
    const onViewportResize = () => {
      if (!inputRef.current) return;
      // Scroll the input into view when keyboard appears
      setTimeout(() => {
        inputRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        scrollToBottom('auto');
      }, 100);
    };

    if ('visualViewport' in window && window.visualViewport) {
      window.visualViewport.addEventListener('resize', onViewportResize);
      return () => window.visualViewport!.removeEventListener('resize', onViewportResize);
    }
  }, [scrollToBottom]);

  const markMessagesAsRead = async () => {
    if (!activeChat || !user) return;
    try {
      await supabase
        .from('messages')
        .update({ status: 'read' })
        .eq('contact_id', activeChat.id)
        .eq('is_outgoing', false)
        .neq('status', 'read');
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  };

  useEffect(() => {
    if (!activeChat || !user) return;
    const updateChannel = supabase
      .channel(`messages-update-${activeChat.id}`)
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'messages',
        filter: `contact_id=eq.${activeChat.id}`,
      }, (payload) => {
        const m = payload.new as Record<string, unknown>;
        updateMessageStatus(activeChat.id, m.id as string, m.status as Message['status']);
      })
      .subscribe();
    return () => { supabase.removeChannel(updateChannel); };
  }, [activeChat?.id, user]);

  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      if (!activeChat || !user) return;
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of Array.from(items)) {
        if (item.type.startsWith('image/')) {
          e.preventDefault();
          const file = item.getAsFile();
          if (file) setPastedImageFile(file);
          break;
        }
      }
    };
    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [activeChat?.id, user]);

  const sendMessageToWhatsApp = async (
    content: string,
    type: 'text' | 'image' | 'document' | 'audio' = 'text',
    mediaUrl?: string,
    mediaMeta?: { fileName?: string; mimeType?: string }
  ) => {
    if (!activeChat || !user) return null;
    try {
      const { data: settings } = await supabase
        .from('whatsapp_settings').select('*').eq('user_id', user.id).single();
      if (!settings?.api_token || !settings?.phone_number_id) {
        toast({ title: 'WhatsApp not configured', description: 'Go to Settings > WhatsApp API to connect.', variant: 'destructive' });
        return null;
      }
      const { data, error } = await supabase.functions.invoke('whatsapp-api', {
        body: {
          action: 'send_message', token: settings.api_token,
          phoneNumberId: settings.phone_number_id, to: activeChat.contact.phone,
          type, content: mediaUrl || content, mediaFileName: mediaMeta?.fileName, mediaMimeType: mediaMeta?.mimeType,
        },
      });
      if (error) throw new Error(error.message);
      if (!data?.success) {
        const errMsg = data?.error || 'Send failed';
        const explanation = getWhatsAppErrorExplanation(errMsg);
        toast({ title: explanation.title, description: `${explanation.description}\n\n💡 ${explanation.action}`, variant: 'destructive' });
        return null;
      }
      return data.messageId;
    } catch (err: unknown) {
      const explanation = getWhatsAppErrorExplanation((err as Error).message);
      toast({ title: explanation.title, description: `${explanation.description}\n\n💡 ${explanation.action}`, variant: 'destructive' });
      return null;
    }
  };

  const handleSend = async () => {
    if (!inputValue.trim() || !activeChat || !user) return;
    const content = inputValue.trim();
    setInputValue('');
    if (activeChat) setDraft(activeChat.id, '');
    setSending(true);
    try {
      const whatsappMessageId = await sendMessageToWhatsApp(content);
      const { data, error } = await supabase.from('messages').insert({
        user_id: user.id, contact_id: activeChat.id, content, type: 'text',
        status: whatsappMessageId ? 'sent' : 'failed', is_outgoing: true,
        whatsapp_message_id: whatsappMessageId || null,
      }).select().single();
      if (error) throw error;
      addMessage(activeChat.id, {
        id: data.id, contactId: data.contact_id, content: data.content,
        type: 'text', status: whatsappMessageId ? 'sent' : 'failed',
        isOutgoing: true, timestamp: new Date(data.created_at),
        whatsappMessageId: whatsappMessageId || undefined,
      });
      requestAnimationFrame(() => inputRef.current?.focus());
    } catch (error: unknown) {
      setInputValue(content);
      toast({ title: 'Failed to send message', description: (error as Error).message, variant: 'destructive' });
    } finally { setSending(false); }
  };


  const getExtensionFromMime = (mimeType: string) => {
    if (mimeType.includes('ogg')) return 'ogg';
    if (mimeType.includes('mpeg')) return 'mp3';
    if (mimeType.includes('mp4')) return 'm4a';
    if (mimeType.includes('wav')) return 'wav';
    if (mimeType.includes('webm')) return 'mp3';
    if (mimeType.includes('webm')) return 'webm';
    return 'bin';
  };

  const getAudioDeliveryType = (mimeType: string): 'audio' | 'document' => {
    const normalized = mimeType.toLowerCase();
    // WhatsApp Cloud API accepts OGG(OPUS), MP3, AAC(M4A), AMR for audio messages.
    if (normalized.includes('ogg') || normalized.includes('mpeg') || normalized.includes('mp4') || normalized.includes('amr')) {
      return 'audio';
    }
    // Unsupported audio mime (e.g. webm) fallback to document to ensure delivery.
    if (normalized.includes('ogg') || normalized.includes('mpeg') || normalized.includes('mp4') || normalized.includes('amr')) {
      return 'audio';
    }
    return 'document';
  };

  const handleFileUpload = async (file: File, type: 'image' | 'document' | 'audio') => {
    if (!activeChat || !user) return;
    setUploading(true);
    try {
      const mimeType = file.type || 'application/octet-stream';
      const extFromMime = getExtensionFromMime(mimeType);
      const fileExt = (file.name.split('.').pop() || extFromMime).toLowerCase();
      const filePath = `${user.id}/${activeChat.id}/${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from('chat-media').upload(filePath, file, {
        contentType: mimeType,
        upsert: false,
        contentType: mimeType, upsert: false,
      });
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from('chat-media').getPublicUrl(filePath);
      const mediaUrl = urlData.publicUrl;

      const msgType = type === 'audio' ? getAudioDeliveryType(mimeType) : type;
      const whatsappMessageId = await sendMessageToWhatsApp(file.name, msgType as any, mediaUrl, {
        fileName: file.name,
        mimeType,
      });

      if (type === 'audio' && msgType === 'document') {
        toast({ title: 'Voice sent as file', description: 'This browser produced an unsupported WhatsApp audio codec, so it was delivered as a document.' });
      const whatsappMessageId = await sendMessageToWhatsApp(file.name, msgType as 'audio' | 'document' | 'image', mediaUrl, {
        fileName: file.name, mimeType,
      });

      if (type === 'audio' && msgType === 'document') {
        toast({ title: 'Voice sent as file', description: 'Delivered as document due to codec.' });
      }

      const { data, error } = await supabase.from('messages').insert({
        user_id: user.id, contact_id: activeChat.id, content: file.name, type: msgType,
        status: whatsappMessageId ? 'sent' : 'failed', is_outgoing: true,
        media_url: mediaUrl, whatsapp_message_id: whatsappMessageId || null,
      }).select().single();
      if (error) throw error;
      addMessage(activeChat.id, {
        id: data.id, contactId: data.contact_id, content: data.content, type: msgType as Message['type'],
        status: whatsappMessageId ? 'sent' : 'failed', isOutgoing: true,
        timestamp: new Date(data.created_at), mediaUrl,
      });
      toast({ title: `${type === 'image' ? 'Media' : type === 'audio' ? 'Voice note' : 'Document'} sent` });
    } catch (err: unknown) {
      toast({ title: 'Failed to upload file', description: (err as Error).message, variant: 'destructive' });
    } finally { setUploading(false); }
  };

  const handleTemplateSelect = async (template: Record<string, unknown>, params: Record<string, string>) => {
    if (!activeChat || !user) return;
    setSending(true);
    try {
      const { data: settings } = await supabase.from('whatsapp_settings').select('*').eq('user_id', user.id).single();
      if (!settings?.api_token) {
        toast({ title: 'WhatsApp not configured', variant: 'destructive' });
        return;
      }
      const { data, error } = await supabase.functions.invoke('whatsapp-api', {
        body: {
          action: 'send_message', token: settings.api_token,
          phoneNumberId: settings.phone_number_id, to: activeChat.contact.phone,
          type: 'template', templateName: template.name, templateParams: params,
        },
      });
      if (error || !data?.success) {
        const errMsg = data?.error || error?.message || 'Failed to send template';
        const explanation = getWhatsAppErrorExplanation(errMsg as string);
        toast({ title: explanation.title, description: `${explanation.description}\n\n💡 ${explanation.action}`, variant: 'destructive' });
        return;
      }
      const components = template.components as Array<Record<string, unknown>> | undefined;
      const bodyComponent = components?.find((c) => c.type === 'BODY');
      let displayContent = (bodyComponent?.text as string) || (template.name as string);
      Object.entries(params).forEach(([key, value]) => { displayContent = displayContent.replace(key, value); });
      const { data: messageData, error: msgError } = await supabase.from('messages').insert({
        user_id: user.id, contact_id: activeChat.id, content: displayContent,
        type: 'text', status: 'sent', is_outgoing: true,
        whatsapp_message_id: data.messageId || null,
        template_name: template.name as string, template_params: params,
      }).select().single();
      if (msgError) throw msgError;
      addMessage(activeChat.id, {
        id: messageData.id, contactId: messageData.contact_id, content: displayContent,
        type: 'text', status: 'sent', isOutgoing: true,
        timestamp: new Date(messageData.created_at),
        templateName: template.name as string, templateParams: params,
      });
      toast({ title: 'Template message sent' });
    } catch (error: unknown) {
      toast({ title: (error as Error).message || 'Failed to send template', variant: 'destructive' });
    } finally { setSending(false); }
  };

  const handleChatAction = async (action: 'pin' | 'mute' | 'archive' | 'delete' | 'clear') => {
    if (!activeChat) return;
    try {
      if (action === 'delete' || action === 'clear') {
        await supabase.from('messages').delete().eq('contact_id', activeChat.id);
        setMessages(activeChat.id, []);
        toast({ title: action === 'delete' ? 'Chat deleted' : 'Messages cleared' });
        if (action === 'delete') onBack?.();
      } else {
        const field = action === 'pin' ? 'is_pinned' : action === 'mute' ? 'is_muted' : 'is_archived';
        const currentValue = action === 'pin' ? activeChat.isPinned : action === 'mute' ? activeChat.isMuted : activeChat.isArchived;
        await supabase.from('contacts').update({ [field]: !currentValue }).eq('id', activeChat.id);
        updateContact(activeChat.id, {
          [action === 'pin' ? 'isPinned' : action === 'mute' ? 'isMuted' : 'isArchived']: !currentValue,
        } as Partial<typeof activeChat.contact>);
        toast({ title: `Chat ${action === 'archive' ? (currentValue ? 'unarchived' : 'archived') : action + (action === 'pin' ? 'ned' : 'd')}` });
        if (action === 'archive' && !currentValue) onBack?.();
      }
    } catch { toast({ title: `Failed to ${action} chat`, variant: 'destructive' }); }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputValue(e.target.value);
    if (activeChat) setDraft(activeChat.id, e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
  };

  if (!activeChat) {
    return (
      <div className="flex-1 flex items-center justify-center chat-background">
        <div className="text-center animate-fade-in">
          <MessageCircle className="w-14 h-14 text-primary/70 mx-auto mb-3" />
          <h2 className="text-[22px] font-medium text-foreground/80 mb-1">{localStorage.getItem('admin_app_name') || 'waba'}</h2>
      <div className="flex-1 flex items-center justify-center" style={{ backgroundImage: `url(${chatBg})`, backgroundSize: 'cover', backgroundPosition: 'center' }}>
        <div className="text-center animate-fade-in bg-white/80 dark:bg-black/60 p-8 rounded-2xl backdrop-blur-sm">
          <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
            <MessageCircle className="w-10 h-10 text-primary/60" />
          </div>
          <h2 className="text-[22px] font-light text-foreground/70 mb-2">{localStorage.getItem('admin_app_name') || 'waba'}</h2>
          <p className="text-muted-foreground text-[15px] max-w-sm mx-auto">Select a chat to start messaging</p>
        </div>
      </div>
    );
  }

  const { contact } = activeChat;

  // Render messages with date separators
  const renderMessages = () => {
    const elements: React.ReactNode[] = [];
    let lastDate: Date | null = null;
    let lastOutgoing: boolean | null = null;

    chatMessages.forEach((message, i) => {
      const msgDate = message.timestamp;

      // Date separator
      if (!lastDate || !isSameDay(lastDate, msgDate)) {
        elements.push(
          <div key={`date-${message.id}`} className="flex justify-center my-3">
            <span className="px-3 py-1 rounded-full text-[12px] font-medium bg-white/80 dark:bg-black/40 text-muted-foreground shadow-sm">
              {formatDateSeparator(msgDate)}
            </span>
          </div>
        );
        lastDate = msgDate;
      }

      // Spacing between messages
      let spacingClass = '';
      if (i > 0) {
        const prev = chatMessages[i - 1];
        const prevDate = prev.timestamp;
        const sameDateGroup = isSameDay(prevDate, msgDate);
        if (sameDateGroup) {
          if (prev.isOutgoing !== message.isOutgoing) {
            spacingClass = 'mt-4';
          } else {
            const timeDiff = msgDate.getTime() - prevDate.getTime();
            spacingClass = timeDiff > 60000 ? 'mt-3' : 'mt-[3px]';
          }
        }
      }

      lastOutgoing = message.isOutgoing;

      elements.push(
        <div key={message.id} className={spacingClass}>
          <MessageBubble message={message} />
        </div>
      );
    });

    return elements;
  };

  return (
    <div className="flex flex-col h-full min-h-0 font-medium">
      {/* Header */}
      <div className="flex items-center justify-between px-1 sm:px-3 py-[6px] bg-panel-header border-b border-panel-border shrink-0">
      {/* Header — always fixed/sticky */}
      <div className="flex items-center justify-between px-1 sm:px-3 py-[6px] bg-panel-header border-b border-panel-border shrink-0 z-10">
        <div className="flex items-center gap-1 min-w-0">
          {showBackButton && (
            <Button variant="ghost" size="icon" onClick={onBack} className="h-9 w-9 shrink-0 text-black">
              <ArrowLeft className="h-6 w-6" />
            </Button>
          )}
          <button
            className="flex items-center gap-2.5 hover:bg-accent/50 rounded-lg p-1 transition-colors min-w-0"
            onClick={() => setShowContactPanel(true)}
          >
            <ContactAvatar name={contact.name} avatar={contact.avatar} isOnline={contact.isOnline} lastSeen={contact.lastSeen} size="sm" />
            <div className="text-left min-w-0">
              <h2 className="font-semibold text-[17px] truncate leading-tight">{contact.name}</h2>
              <p className="text-[12px] text-muted-foreground leading-tight">
                {isContactOnline(contact.lastSeen) ? 'online' : contact.lastSeen ? formatLastSeen(contact.lastSeen) : 'tap here for contact info'}
              </p>
            </div>
          </button>
        </div>
        <div className="flex items-center shrink-0">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9 text-black"><MoreVertical className="h-5 w-5 stroke-[2.6px]" /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuItem onClick={() => setShowContactPanel(true)}><Info className="h-4 w-4 mr-3" /> Contact info</DropdownMenuItem>
              <DropdownMenuItem onClick={() => toggleFavorite(activeChat.id)}>
                <Star className={`h-4 w-4 mr-3 ${isFav ? 'fill-amber-500 text-amber-500' : ''}`} />
                {isFav ? 'Remove favorite' : 'Add to favorites'}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleChatAction('pin')}><Pin className="h-4 w-4 mr-3" /> {activeChat.isPinned ? 'Unpin' : 'Pin'} chat</DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleChatAction('mute')}><BellOff className="h-4 w-4 mr-3" /> {activeChat.isMuted ? 'Unmute' : 'Mute'}</DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleChatAction('archive')}><Archive className="h-4 w-4 mr-3" /> {activeChat.isArchived ? 'Unarchive' : 'Archive'}</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => handleChatAction('clear')} className="text-destructive"><X className="h-4 w-4 mr-3" /> Clear messages</DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleChatAction('delete')} className="text-destructive"><Trash2 className="h-4 w-4 mr-3" /> Delete chat</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Messages */}
      <div ref={messagesContainerRef} className="flex-1 overflow-y-auto chat-background px-3 py-2 custom-scrollbar min-h-0">
      <div
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto px-3 py-2 custom-scrollbar min-h-0"
        style={{
          backgroundImage: `url(${chatBg})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundAttachment: 'local',
        }}
      >
        <div className="w-full max-w-none mx-auto">
          {chatMessages.length === 0 && (
            <div className="text-center py-8">
              <span className="px-4 py-2 rounded-full text-[13px] bg-white/80 dark:bg-black/40 text-muted-foreground">
                No messages yet. Start the conversation!
              </span>
            </div>
          )}
          {showBusinessNotice && (
            <div className="flex justify-center my-3">
              <div className="flex items-center gap-2 px-4 py-2 bg-amber-500/10 border border-amber-500/20 rounded-lg text-foreground/70 text-[13px]">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>Business-initiated conversation. Customer has not replied yet.</span>
              </div>
            </div>
          )}
          {renderMessages()}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Image Paste Preview Modal */}
      <ImagePastePreview
        file={pastedImageFile}
        onConfirm={async (file, caption) => {
          setPastedImageFile(null);
          await handleFileUpload(file, 'image');
          if (caption.trim() && activeChat && user) {
            const content = caption.trim();
            const whatsappMessageId = await sendMessageToWhatsApp(content);
            const { data, error } = await supabase.from('messages').insert({
              user_id: user.id, contact_id: activeChat.id, content, type: 'text',
              status: whatsappMessageId ? 'sent' : 'failed', is_outgoing: true,
              whatsapp_message_id: whatsappMessageId || null,
            }).select().single();
            if (!error && data) {
              addMessage(activeChat.id, {
                id: data.id, contactId: data.contact_id, content, type: 'text',
                status: whatsappMessageId ? 'sent' : 'failed', isOutgoing: true,
                timestamp: new Date(data.created_at),
              });
            }
          }
        }}
        onCancel={() => setPastedImageFile(null)}
      />

      {/* Input Bar — WhatsApp style, stays above keyboard on mobile */}
      <div
        className="px-2 sm:px-3 py-1.5 bg-panel-header border-t border-panel-border shrink-0"
        style={{ paddingBottom: 'max(6px, env(safe-area-inset-bottom))' }}
      >
        <div className="flex items-end gap-1.5 max-w-3xl mx-auto">
          {recorderState.state === 'idle' && (
            <>
              <div className="text-black"><FileUploadButton onFileSelect={(file, type) => handleFileUpload(file, type)} uploading={uploading} /></div>
              <UnifiedTemplateSelector
                contact={contact}
                onSelectMetaTemplate={handleTemplateSelect}
                onInsertAppTemplate={(text) => {
                  setInputValue(prev => prev + text);
                  if (activeChat) setDraft(activeChat.id, inputValue + text);
                  requestAnimationFrame(() => inputRef.current?.focus());
                }}
              />
            </>
          )}

          {recorderState.state !== 'idle' ? (
            <VoiceRecorderButton
              onRecordingComplete={(blob) => {
                const mimeType = blob.type || 'audio/ogg;codecs=opus';
                const ext = mimeType.includes('ogg') ? 'ogg' : mimeType.includes('mpeg') ? 'mp3' : mimeType.includes('mp4') ? 'm4a' : mimeType.includes('amr') ? 'amr' : 'mp3';
                const ext = mimeType.includes('ogg') ? 'ogg' : mimeType.includes('mpeg') ? 'mp3' : mimeType.includes('mp4') ? 'm4a' : mimeType.includes('webm') ? 'webm' : 'ogg';
                const file = new File([blob], `voice-${Date.now()}.${ext}`, { type: mimeType });
                handleFileUpload(file, 'audio');
              }}
              disabled={sending || uploading}
            />
          ) : (
            <>
              <div className="flex-1 flex items-end bg-background rounded-[30px] px-3 py-1 border border-input shadow-sm">
                <textarea
                  ref={inputRef}
                  value={inputValue}
                  onChange={handleInputChange}
                  onKeyDown={handleKeyDown}
                  placeholder="Message"
                  rows={1}
                  className="flex-1 resize-none border-0 focus:outline-none min-h-[36px] max-h-[120px] py-[7px] text-[16px] bg-transparent leading-[1.3]"
                  disabled={sending || uploading}
                  style={{ height: 'auto' }}
                  onFocus={() => {
                    setTimeout(() => scrollToBottom('smooth'), 300);
                  }}
                />
              </div>

              {inputValue.trim() ? (
                <Button
                  size="icon"
                  className="h-[40px] w-[40px] shrink-0 rounded-full bg-primary hover:bg-primary/90 shadow-sm"
                  onClick={handleSend}
                  disabled={sending || uploading}
                >
                  <Send className="h-[18px] w-[18px]" />
                </Button>
              ) : (
                <VoiceRecorderButton
                  onRecordingComplete={(blob) => {
                    const mimeType = blob.type || 'audio/ogg;codecs=opus';
                const ext = mimeType.includes('ogg') ? 'ogg' : mimeType.includes('mpeg') ? 'mp3' : mimeType.includes('mp4') ? 'm4a' : mimeType.includes('amr') ? 'amr' : 'mp3';
                const file = new File([blob], `voice-${Date.now()}.${ext}`, { type: mimeType });
                    const ext = mimeType.includes('ogg') ? 'ogg' : mimeType.includes('mpeg') ? 'mp3' : mimeType.includes('mp4') ? 'm4a' : mimeType.includes('webm') ? 'webm' : 'ogg';
                    const file = new File([blob], `voice-${Date.now()}.${ext}`, { type: mimeType });
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
