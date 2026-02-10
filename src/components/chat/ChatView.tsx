import { useState, useRef, useEffect } from 'react';
import { Send, MoreVertical, Phone, Video, Info, ArrowLeft, Trash2, Pin, BellOff, Archive, X, MessageCircle, AlertTriangle, Star } from 'lucide-react';
import { useAppStore } from '@/store/appStore';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { ContactAvatar } from '@/components/shared/ContactAvatar';
import { MessageBubble } from '@/components/chat/MessageBubble';
import { VoiceRecorder } from '@/components/chat/VoiceRecorder';
import { FileUploadButton } from '@/components/chat/FileUploadButton';
import { TemplateSelector } from '@/components/chat/TemplateSelector';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { formatLastSeen } from '@/lib/utils/format';
import { Message } from '@/types';
import { useToast } from '@/hooks/use-toast';

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
  const [isRecording, setIsRecording] = useState(false);
  const [uploading, setUploading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const chatMessages = activeChat ? messages[activeChat.id] || [] : [];
  const hasCustomerReply = chatMessages.some(m => !m.isOutgoing);
  const hasAnyMessages = chatMessages.length > 0;
  const showBusinessNotice = hasAnyMessages && !hasCustomerReply;
  const isFav = activeChat ? useAppStore.getState().favorites[activeChat.id] : false;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  // Sync draft when switching chats
  useEffect(() => {
    if (activeChat) {
      setInputValue(useAppStore.getState().drafts?.[activeChat.id] || '');
    }
  }, [activeChat?.id]);

  // Real-time listener
  useEffect(() => {
    if (!activeChat || !user) return;

    const insertChannel = supabase
      .channel(`messages-insert-${activeChat.id}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'messages',
        filter: `contact_id=eq.${activeChat.id}`,
      }, (payload) => {
        const m = payload.new as any;
        const newMessage: Message = {
          id: m.id, contactId: m.contact_id, content: m.content,
          type: m.type, status: m.status, isOutgoing: m.is_outgoing,
          timestamp: new Date(m.created_at), mediaUrl: m.media_url,
          whatsappMessageId: m.whatsapp_message_id,
        };
        const existing = useAppStore.getState().messages[activeChat.id] || [];
        if (!existing.find(msg => msg.id === newMessage.id)) {
          addMessage(activeChat.id, newMessage);
        }
      })
      .subscribe();

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

    return () => {
      supabase.removeChannel(insertChannel);
      supabase.removeChannel(updateChannel);
    };
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
      if (!data?.success) throw new Error(data?.error || 'Send failed');
      return data.messageId;
    } catch (err: any) {
      toast({ title: 'Send failed', description: err.message, variant: 'destructive' });
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
      inputRef.current?.focus();
    } catch (error: any) {
      setInputValue(content);
      toast({ title: 'Failed to send message', description: error.message, variant: 'destructive' });
    } finally { setSending(false); }
  };

  const handleFileUpload = async (file: File, type: 'image' | 'document') => {
    if (!activeChat || !user) return;
    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const filePath = `${user.id}/${activeChat.id}/${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from('chat-media').upload(filePath, file);
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from('chat-media').getPublicUrl(filePath);
      const mediaUrl = urlData.publicUrl;
      const whatsappMessageId = await sendMessageToWhatsApp(file.name, type, mediaUrl);
      const { data, error } = await supabase.from('messages').insert({
        user_id: user.id, contact_id: activeChat.id, content: file.name, type,
        status: whatsappMessageId ? 'sent' : 'failed', is_outgoing: true,
        media_url: mediaUrl, whatsapp_message_id: whatsappMessageId || null,
      }).select().single();
      if (error) throw error;
      addMessage(activeChat.id, {
        id: data.id, contactId: data.contact_id, content: data.content, type,
        status: whatsappMessageId ? 'sent' : 'failed', isOutgoing: true,
        timestamp: new Date(data.created_at), mediaUrl,
      });
    } catch (err: any) {
      toast({ title: 'Failed to upload file', description: err.message, variant: 'destructive' });
    } finally { setUploading(false); }
  };

  const handleVoiceRecording = async (blob: Blob) => {
    if (!activeChat || !user) return;
    setUploading(true);
    try {
      const filePath = `${user.id}/${activeChat.id}/${Date.now()}.webm`;
      const { error: uploadError } = await supabase.storage.from('chat-media').upload(filePath, blob, { contentType: 'audio/webm' });
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from('chat-media').getPublicUrl(filePath);
      const mediaUrl = urlData.publicUrl;
      const whatsappMessageId = await sendMessageToWhatsApp('Voice message', 'audio', mediaUrl);
      const { data, error } = await supabase.from('messages').insert({
        user_id: user.id, contact_id: activeChat.id, content: 'Voice message', type: 'audio',
        status: whatsappMessageId ? 'sent' : 'failed', is_outgoing: true,
        media_url: mediaUrl, whatsapp_message_id: whatsappMessageId || null,
      }).select().single();
      if (error) throw error;
      addMessage(activeChat.id, {
        id: data.id, contactId: data.contact_id, content: 'Voice message', type: 'audio',
        status: whatsappMessageId ? 'sent' : 'failed', isOutgoing: true,
        timestamp: new Date(data.created_at), mediaUrl,
      });
    } catch (err: any) {
      toast({ title: 'Failed to send voice message', description: err.message, variant: 'destructive' });
    } finally { setUploading(false); }
  };

  const handleTemplateSelect = async (template: any, params: Record<string, string>) => {
    if (!activeChat || !user) return;
    setSending(true);
    try {
      const { data: settings } = await supabase.from('whatsapp_settings').select('*').eq('user_id', user.id).single();
      if (!settings?.api_token) { toast({ title: 'WhatsApp not configured', variant: 'destructive' }); return; }
      const { data, error } = await supabase.functions.invoke('whatsapp-api', {
        body: {
          action: 'send_message', token: settings.api_token, phoneNumberId: settings.phone_number_id,
          to: activeChat.contact.phone, type: 'template', templateName: template.name, templateParams: params,
        },
      });
      if (error || !data?.success) throw new Error(data?.error || 'Failed to send template');
      const bodyComponent = template.components?.find((c: any) => c.type === 'BODY');
      let content = bodyComponent?.text || template.name;
      Object.entries(params).forEach(([key, value]) => { content = content.replace(key, value); });
      const { data: messageData, error: msgError } = await supabase.from('messages').insert({
        user_id: user.id, contact_id: activeChat.id, content, type: 'text', status: 'sent', is_outgoing: true,
        whatsapp_message_id: data.messageId || null,
      }).select().single();
      if (msgError) throw msgError;
      addMessage(activeChat.id, {
        id: messageData.id, contactId: messageData.contact_id, content: messageData.content,
        type: 'text', status: 'sent', isOutgoing: true, timestamp: new Date(messageData.created_at),
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

  if (!activeChat) {
    return (
      <div className="flex-1 flex items-center justify-center chat-background">
        <div className="text-center animate-fade-in">
          <div className="w-56 h-56 mx-auto mb-6 rounded-full bg-primary/10 flex items-center justify-center">
            <MessageCircle className="w-24 h-24 text-primary/60" />
          </div>
          <h2 className="text-[22px] font-light text-foreground/70 mb-2">Lotus CRM</h2>
          <p className="text-muted-foreground text-[15px] max-w-sm mx-auto">Select a chat to start messaging</p>
        </div>
      </div>
    );
  }

  const { contact } = activeChat;

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
            <ContactAvatar name={contact.name} avatar={contact.avatar} isOnline={contact.isOnline} size="sm" />
            <div className="text-left min-w-0">
              <h2 className="font-semibold text-[17px] truncate leading-tight">{contact.name}</h2>
              <p className="text-[12px] text-muted-foreground leading-tight">
                {contact.isOnline ? 'online' : contact.lastSeen ? formatLastSeen(contact.lastSeen) : 'tap here for contact info'}
              </p>
            </div>
          </button>
        </div>
        <div className="flex items-center shrink-0">
          <Button variant="ghost" size="icon" className="h-9 w-9 text-primary hidden sm:flex"><Video className="h-[22px] w-[22px]" /></Button>
          <Button variant="ghost" size="icon" className="h-9 w-9 text-primary"><Phone className="h-[20px] w-[20px]" /></Button>
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
      <div className="flex-1 overflow-y-auto chat-background px-3 py-2 custom-scrollbar min-h-0">
        <div className="max-w-3xl mx-auto space-y-1">
          {chatMessages.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <p className="text-[14px]">No messages yet. Start the conversation!</p>
            </div>
          )}
          {showBusinessNotice && (
            <div className="flex justify-center my-3">
              <div className="flex items-center gap-2 px-4 py-2 bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-700 dark:text-amber-400 text-[13px]">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>Business-initiated conversation. Customer has not replied yet.</span>
              </div>
            </div>
          )}
          {chatMessages.map((message) => (
            <MessageBubble key={message.id} message={message} />
          ))}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input Bar */}
      <div className="px-2 sm:px-3 py-2 bg-panel-header border-t border-panel-border shrink-0">
        <div className="flex items-center gap-1 max-w-3xl mx-auto">
          <FileUploadButton onFileSelect={handleFileUpload} uploading={uploading} />
          <TemplateSelector contact={contact as any} onSelectTemplate={handleTemplateSelect} />

          {isRecording ? (
            <VoiceRecorder isRecording={isRecording} setIsRecording={setIsRecording} onRecordingComplete={handleVoiceRecording} onCancel={() => setIsRecording(false)} />
          ) : (
            <>
              <div className="flex-1 flex items-center bg-background rounded-full px-3 border border-input">
                <Input
                  ref={inputRef} value={inputValue}
                  onChange={(e) => { setInputValue(e.target.value); if (activeChat) setDraft(activeChat.id, e.target.value); }}
                  onKeyDown={handleKeyDown}
                  placeholder="Message"
                  className="flex-1 border-0 focus-visible:ring-0 h-[38px] px-0 text-[16px] bg-transparent"
                  disabled={sending || uploading}
                />
              </div>
              {inputValue.trim() ? (
                <Button size="icon" className="h-[38px] w-[38px] shrink-0 rounded-full bg-primary" onClick={handleSend} disabled={sending || uploading}>
                  <Send className="h-[18px] w-[18px]" />
                </Button>
              ) : (
                <VoiceRecorder isRecording={isRecording} setIsRecording={setIsRecording} onRecordingComplete={handleVoiceRecording} onCancel={() => setIsRecording(false)} />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
