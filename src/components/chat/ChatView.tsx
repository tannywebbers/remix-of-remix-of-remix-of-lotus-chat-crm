import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, MoreVertical, Info, ArrowLeft, Trash2, Pin, BellOff, Archive, X, MessageCircle, AlertTriangle, Star } from 'lucide-react';
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
import { useToast } from '@/hooks/use-toast';
import { getWhatsAppErrorExplanation } from '@/lib/whatsappErrors';

interface ChatViewProps {
  onBack?: () => void;
  showBackButton?: boolean;
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

  // Scroll to bottom instantly when chat opens (no animation, no jump)
  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'auto') => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  }, []);

  // Subscribe to recorder state
  useEffect(() => {
    const unsub = globalVoiceRecorder.subscribe(setRecorderState);
    return () => { unsub(); };
  }, []);

  // Scroll to bottom on new messages
  useEffect(() => {
    scrollToBottom('auto');
  }, [chatMessages.length]);

  // Sync draft when switching chats + scroll to bottom instantly
  useEffect(() => {
    if (activeChat) {
      setInputValue(useAppStore.getState().drafts?.[activeChat.id] || '');
      markMessagesAsRead();
      // Use requestAnimationFrame for instant scroll after render
      requestAnimationFrame(() => scrollToBottom('auto'));
    }
  }, [activeChat?.id]);

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

  // Real-time listener for this chat's messages
  useEffect(() => {
    if (!activeChat || !user) return;
    const updateChannel = supabase
      .channel(`messages-update-${activeChat.id}`)
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'messages',
        filter: `contact_id=eq.${activeChat.id}`,
      }, (payload) => {
        const m = payload.new as any;
        updateMessageStatus(activeChat.id, m.id, m.status);
      })
      .subscribe();
    return () => { supabase.removeChannel(updateChannel); };
  }, [activeChat?.id, user]);

  // Clipboard paste handler for images — show preview before send
  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      if (!activeChat || !user) return;
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of Array.from(items)) {
        if (item.type.startsWith('image/')) {
          e.preventDefault();
          const file = item.getAsFile();
          if (file) {
            // Show preview modal instead of auto-sending
            setPastedImageFile(file);
          }
          break;
        }
      }
    };
    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [activeChat?.id, user]);

  const sendMessageToWhatsApp = async (content: string, type: 'text' | 'image' | 'document' | 'audio' = 'text', mediaUrl?: string) => {
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
          type, content: mediaUrl || content,
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
    } catch (err: any) {
      const explanation = getWhatsAppErrorExplanation(err.message);
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
      // Keep keyboard open and input focused after send
      requestAnimationFrame(() => inputRef.current?.focus());
    } catch (error: any) {
      setInputValue(content);
      toast({ title: 'Failed to send message', description: error.message, variant: 'destructive' });
    } finally { setSending(false); }
  };

  const handleFileUpload = async (file: File, type: 'image' | 'document' | 'audio') => {
    if (!activeChat || !user) return;
    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const filePath = `${user.id}/${activeChat.id}/${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from('chat-media').upload(filePath, file);
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from('chat-media').getPublicUrl(filePath);
      const mediaUrl = urlData.publicUrl;
      const msgType = type === 'audio' ? 'audio' : type;
      const whatsappMessageId = await sendMessageToWhatsApp(file.name, msgType as any, mediaUrl);
      const { data, error } = await supabase.from('messages').insert({
        user_id: user.id, contact_id: activeChat.id, content: file.name, type: msgType,
        status: whatsappMessageId ? 'sent' : 'failed', is_outgoing: true,
        media_url: mediaUrl, whatsapp_message_id: whatsappMessageId || null,
      }).select().single();
      if (error) throw error;
      addMessage(activeChat.id, {
        id: data.id, contactId: data.contact_id, content: data.content, type: msgType as any,
        status: whatsappMessageId ? 'sent' : 'failed', isOutgoing: true,
        timestamp: new Date(data.created_at), mediaUrl,
      });
      toast({ title: `${type === 'image' ? 'Media' : 'Document'} sent` });
    } catch (err: any) {
      toast({ title: 'Failed to upload file', description: err.message, variant: 'destructive' });
    } finally { setUploading(false); }
  };

  const handleTemplateSelect = async (template: any, params: Record<string, string>) => {
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
        const explanation = getWhatsAppErrorExplanation(errMsg);
        toast({ title: explanation.title, description: `${explanation.description}\n\n💡 ${explanation.action}`, variant: 'destructive' });
        return;
      }
      const bodyComponent = template.components?.find((c: any) => c.type === 'BODY');
      let displayContent = bodyComponent?.text || template.name;
      Object.entries(params).forEach(([key, value]) => { displayContent = displayContent.replace(key, value); });
      const { data: messageData, error: msgError } = await supabase.from('messages').insert({
        user_id: user.id, contact_id: activeChat.id, content: displayContent,
        type: 'text', status: 'sent', is_outgoing: true,
        whatsapp_message_id: data.messageId || null,
        template_name: template.name, template_params: params,
      }).select().single();
      if (msgError) throw msgError;
      addMessage(activeChat.id, {
        id: messageData.id, contactId: messageData.contact_id, content: displayContent,
        type: 'text', status: 'sent', isOutgoing: true,
        timestamp: new Date(messageData.created_at),
        templateName: template.name, templateParams: params,
      });
      toast({ title: 'Template message sent' });
    } catch (error: any) {
      toast({ title: error.message || 'Failed to send template', variant: 'destructive' });
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
        } as any);
        toast({ title: `Chat ${action === 'archive' ? (currentValue ? 'unarchived' : 'archived') : action + (action === 'pin' ? 'ned' : 'd')}` });
        if (action === 'archive' && !currentValue) onBack?.();
      }
    } catch { toast({ title: `Failed to ${action} chat`, variant: 'destructive' }); }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  // Auto-resize textarea
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputValue(e.target.value);
    if (activeChat) setDraft(activeChat.id, e.target.value);
    // Auto-resize
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
  };

  if (!activeChat) {
    return (
      <div className="flex-1 flex items-center justify-center chat-background">
        <div className="text-center animate-fade-in">
          <div className="w-56 h-56 mx-auto mb-6 rounded-full bg-primary/10 flex items-center justify-center">
            <MessageCircle className="w-24 h-24 text-primary/60" />
          </div>
          <h2 className="text-[22px] font-light text-foreground/70 mb-2">{localStorage.getItem('admin_app_name') || 'waba'}</h2>
          <p className="text-muted-foreground text-[15px] max-w-sm mx-auto">Select a chat to start messaging</p>
        </div>
      </div>
    );
  }

  const { contact } = activeChat;

  // Build messages with spacing classes
  const renderMessages = () => {
    return chatMessages.map((message, i) => {
      const prev = i > 0 ? chatMessages[i - 1] : null;
      let spacingClass = '';
      if (prev) {
        if (prev.isOutgoing !== message.isOutgoing) {
          spacingClass = 'mt-4'; // 16px direction change
        } else {
          // Same sender — check time gap
          const timeDiff = message.timestamp.getTime() - prev.timestamp.getTime();
          spacingClass = timeDiff > 60000 ? 'mt-3' : 'mt-[3px]'; // 12px group break, 3px same group
        }
      }
      return (
        <div key={message.id} className={spacingClass}>
          <MessageBubble message={message} />
        </div>
      );
    });
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="flex items-center justify-between px-1 sm:px-3 py-[6px] bg-panel-header border-b border-panel-border shrink-0">
        <div className="flex items-center gap-1 min-w-0">
          {showBackButton && (
            <Button variant="ghost" size="icon" onClick={onBack} className="h-9 w-9 shrink-0 text-primary">
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
          {/* Call buttons removed per requirement */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground"><MoreVertical className="h-5 w-5" /></Button>
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
        <div className="max-w-[720px] mx-auto">
          {chatMessages.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <p className="text-[14px]">No messages yet. Start the conversation!</p>
            </div>
          )}
          {showBusinessNotice && (
            <div className="flex justify-center my-3">
              <div className="flex items-center gap-2 px-4 py-2 bg-amber-500/10 border border-amber-500/20 rounded-lg text-foreground/70 dark:text-foreground/60 text-[13px]">
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
          // If caption provided, send as text after
          if (caption.trim()) {
            const content = caption.trim();
            const whatsappMessageId = await sendMessageToWhatsApp(content);
            const { data, error } = await supabase.from('messages').insert({
              user_id: user!.id, contact_id: activeChat!.id, content, type: 'text',
              status: whatsappMessageId ? 'sent' : 'failed', is_outgoing: true,
              whatsapp_message_id: whatsappMessageId || null,
            }).select().single();
            if (!error && data) {
              addMessage(activeChat!.id, {
                id: data.id, contactId: data.contact_id, content, type: 'text',
                status: whatsappMessageId ? 'sent' : 'failed', isOutgoing: true,
                timestamp: new Date(data.created_at),
              });
            }
          }
        }}
        onCancel={() => setPastedImageFile(null)}
      />

      {/* Input Bar — WhatsApp style */}
      <div className="px-2 sm:px-3 py-1.5 bg-panel-header border-t border-panel-border shrink-0">
        <div className="flex items-end gap-1.5 max-w-3xl mx-auto">
          {recorderState.state === 'idle' && (
            <>
              <FileUploadButton onFileSelect={(file, type) => handleFileUpload(file, type)} uploading={uploading} />
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
            /* Recording or preview replaces textarea */
            <VoiceRecorderButton
              onRecordingComplete={(blob) => {
                const file = new File([blob], `voice-${Date.now()}.ogg`, { type: blob.type || 'audio/ogg;codecs=opus' });
                handleFileUpload(file, 'audio');
              }}
              disabled={sending || uploading}
            />
          ) : (
            <>
              <div className="flex-1 flex items-end bg-background rounded-[20px] px-3 py-1 border border-input shadow-sm">
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
                    const file = new File([blob], `voice-${Date.now()}.ogg`, { type: blob.type || 'audio/ogg;codecs=opus' });
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
