import { useState, useRef, useEffect } from 'react';
import { Send, Smile, MoreVertical, Phone, Video, Info, ArrowLeft, Search, Trash2, Pin, BellOff, Archive, X } from 'lucide-react';
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { formatLastSeen } from '@/lib/utils/format';
import { Message } from '@/types';
import { useToast } from '@/hooks/use-toast';

interface ChatViewProps {
  onBack?: () => void;
  showBackButton?: boolean;
}

export function ChatView({ onBack, showBackButton = false }: ChatViewProps) {
  const { activeChat, messages, addMessage, setMessages, setShowContactPanel, updateContact } = useAppStore();
  const { user } = useAuth();
  const { toast } = useToast();
  const [inputValue, setInputValue] = useState('');
  const [sending, setSending] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [uploading, setUploading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const chatMessages = activeChat ? messages[activeChat.id] || [] : [];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  // Subscribe to realtime messages
  useEffect(() => {
    if (!activeChat || !user) return;

    const channel = supabase
      .channel(`messages-${activeChat.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `contact_id=eq.${activeChat.id}`,
        },
        (payload) => {
          const m = payload.new as any;
          const newMessage: Message = {
            id: m.id,
            contactId: m.contact_id,
            content: m.content,
            type: m.type,
            status: m.status,
            isOutgoing: m.is_outgoing,
            timestamp: new Date(m.created_at),
            mediaUrl: m.media_url,
          };
          const existing = messages[activeChat.id] || [];
          if (!existing.find(msg => msg.id === newMessage.id)) {
            addMessage(activeChat.id, newMessage);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeChat, user]);

  const sendMessageToWhatsApp = async (content: string, type: 'text' | 'image' | 'document' | 'audio' = 'text', mediaUrl?: string) => {
    if (!activeChat || !user) return null;

    try {
      // Get user's WhatsApp settings
      const { data: settings } = await supabase
        .from('whatsapp_settings' as any)
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (!settings || !(settings as any).api_token || !(settings as any).phone_number_id) {
        console.log('WhatsApp not configured, saving locally only');
        return null;
      }

      // Send via WhatsApp API
      const { data, error } = await supabase.functions.invoke('whatsapp-api', {
        body: {
          action: 'send_message',
          token: (settings as any).api_token,
          phoneNumberId: (settings as any).phone_number_id,
          to: activeChat.contact.phone,
          type,
          content: mediaUrl || content,
        },
      });

      if (error || !data?.success) {
        console.error('Failed to send via WhatsApp:', error || data?.error);
        return null;
      }

      return data.messageId;
    } catch (error) {
      console.error('Error sending to WhatsApp:', error);
      return null;
    }
  };

  const handleSend = async () => {
    if (!inputValue.trim() || !activeChat || !user) return;

    const content = inputValue.trim();
    setInputValue('');
    setSending(true);

    try {
      // Send to WhatsApp
      const whatsappMessageId = await sendMessageToWhatsApp(content);

      // Save to database
      const { data, error } = await supabase
        .from('messages')
        .insert({
          user_id: user.id,
          contact_id: activeChat.id,
          content,
          type: 'text',
          status: whatsappMessageId ? 'sent' : 'failed',
          is_outgoing: true,
          whatsapp_message_id: whatsappMessageId,
        })
        .select()
        .single();

      if (error) throw error;

      const newMessage: Message = {
        id: data.id,
        contactId: data.contact_id,
        content: data.content,
        type: 'text',
        status: whatsappMessageId ? 'sent' : 'failed',
        isOutgoing: true,
        timestamp: new Date(data.created_at),
      };

      addMessage(activeChat.id, newMessage);
      inputRef.current?.focus();
    } catch (error) {
      console.error('Error sending message:', error);
      setInputValue(content);
      toast({ title: 'Failed to send message', variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  const handleFileUpload = async (file: File, type: 'image' | 'document') => {
    if (!activeChat || !user) return;
    setUploading(true);

    try {
      const fileExt = file.name.split('.').pop();
      const filePath = `${user.id}/${activeChat.id}/${Date.now()}.${fileExt}`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from('chat-media')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('chat-media')
        .getPublicUrl(filePath);

      const mediaUrl = urlData.publicUrl;

      // Send to WhatsApp
      const whatsappMessageId = await sendMessageToWhatsApp(file.name, type, mediaUrl);

      // Save to database
      const { data, error } = await supabase
        .from('messages')
        .insert({
          user_id: user.id,
          contact_id: activeChat.id,
          content: file.name,
          type,
          status: whatsappMessageId ? 'sent' : 'failed',
          is_outgoing: true,
          media_url: mediaUrl,
          whatsapp_message_id: whatsappMessageId,
        })
        .select()
        .single();

      if (error) throw error;

      const newMessage: Message = {
        id: data.id,
        contactId: data.contact_id,
        content: data.content,
        type,
        status: whatsappMessageId ? 'sent' : 'failed',
        isOutgoing: true,
        timestamp: new Date(data.created_at),
        mediaUrl,
      };

      addMessage(activeChat.id, newMessage);
      toast({ title: 'File sent successfully' });
    } catch (error) {
      console.error('Error uploading file:', error);
      toast({ title: 'Failed to upload file', variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  const handleVoiceRecording = async (blob: Blob) => {
    if (!activeChat || !user) return;
    setUploading(true);

    try {
      const filePath = `${user.id}/${activeChat.id}/${Date.now()}.webm`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from('chat-media')
        .upload(filePath, blob, { contentType: 'audio/webm' });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('chat-media')
        .getPublicUrl(filePath);

      const mediaUrl = urlData.publicUrl;

      // Send to WhatsApp
      const whatsappMessageId = await sendMessageToWhatsApp('Voice message', 'audio', mediaUrl);

      // Save to database
      const { data, error } = await supabase
        .from('messages')
        .insert({
          user_id: user.id,
          contact_id: activeChat.id,
          content: 'Voice message',
          type: 'audio',
          status: whatsappMessageId ? 'sent' : 'failed',
          is_outgoing: true,
          media_url: mediaUrl,
          whatsapp_message_id: whatsappMessageId,
        })
        .select()
        .single();

      if (error) throw error;

      const newMessage: Message = {
        id: data.id,
        contactId: data.contact_id,
        content: 'Voice message',
        type: 'audio' as any,
        status: whatsappMessageId ? 'sent' : 'failed',
        isOutgoing: true,
        timestamp: new Date(data.created_at),
        mediaUrl,
      };

      addMessage(activeChat.id, newMessage);
      toast({ title: 'Voice message sent' });
    } catch (error) {
      console.error('Error uploading voice message:', error);
      toast({ title: 'Failed to send voice message', variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  const handleTemplateSelect = async (template: any, params: Record<string, string>) => {
    if (!activeChat || !user) return;
    setSending(true);

    try {
      // Get WhatsApp settings
      const { data: settings } = await supabase
        .from('whatsapp_settings' as any)
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (!settings || !(settings as any).api_token) {
        toast({ title: 'WhatsApp not configured', variant: 'destructive' });
        return;
      }

      // Send template via WhatsApp
      const { data, error } = await supabase.functions.invoke('whatsapp-api', {
        body: {
          action: 'send_message',
          token: (settings as any).api_token,
          phoneNumberId: (settings as any).phone_number_id,
          to: activeChat.contact.phone,
          type: 'template',
          templateName: template.name,
          templateParams: params,
        },
      });

      if (error || !data?.success) throw new Error(data?.error || 'Failed to send template');

      // Get the template body text for display
      const bodyComponent = template.components?.find((c: any) => c.type === 'BODY');
      let content = bodyComponent?.text || template.name;
      Object.entries(params).forEach(([key, value]) => {
        content = content.replace(key, value);
      });

      // Save to database
      const { data: messageData, error: msgError } = await supabase
        .from('messages')
        .insert({
          user_id: user.id,
          contact_id: activeChat.id,
          content,
          type: 'text',
          status: 'sent',
          is_outgoing: true,
          whatsapp_message_id: data.messageId,
          template_name: template.name,
          template_params: params,
        })
        .select()
        .single();

      if (msgError) throw msgError;

      const newMessage: Message = {
        id: messageData.id,
        contactId: messageData.contact_id,
        content: messageData.content,
        type: 'text',
        status: 'sent',
        isOutgoing: true,
        timestamp: new Date(messageData.created_at),
      };

      addMessage(activeChat.id, newMessage);
      toast({ title: 'Template message sent' });
    } catch (error: any) {
      console.error('Error sending template:', error);
      toast({ title: error.message || 'Failed to send template', variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  // FIXED: Delete chat only removes messages, NOT the contact
  const handleChatAction = async (action: 'pin' | 'mute' | 'archive' | 'delete' | 'clear') => {
    if (!activeChat) return;

    try {
      if (action === 'delete' || action === 'clear') {
        // Delete only messages, preserve contact
        await supabase.from('messages').delete().eq('contact_id', activeChat.id);
        setMessages(activeChat.id, []);
        toast({ title: action === 'delete' ? 'Chat deleted' : 'Messages cleared', description: 'Contact preserved' });
        if (action === 'delete') {
          onBack?.();
        }
      } else {
        const field = action === 'pin' ? 'is_pinned' : action === 'mute' ? 'is_muted' : 'is_archived';
        const currentValue = action === 'pin' ? activeChat.isPinned : action === 'mute' ? activeChat.isMuted : false;
        
        await supabase.from('contacts').update({ [field]: !currentValue }).eq('id', activeChat.id);
        updateContact(activeChat.id, { 
          [action === 'pin' ? 'isPinned' : action === 'mute' ? 'isMuted' : 'isArchived']: !currentValue 
        } as any);
        
        toast({ title: `Chat ${action}${action === 'pin' ? 'ned' : action === 'mute' ? 'd' : 'd'}` });
      }
    } catch (error) {
      console.error(`Error ${action}ing chat:`, error);
      toast({ title: `Failed to ${action} chat`, variant: 'destructive' });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!activeChat) {
    return (
      <div className="flex-1 flex items-center justify-center chat-background">
        <div className="text-center animate-fade-in">
          <div className="w-64 h-64 mx-auto mb-6 rounded-full bg-primary/10 flex items-center justify-center">
            <svg viewBox="0 0 303 172" className="w-48 h-28 text-primary opacity-80" fill="currentColor">
              <path d="M229.565 160.229c-1.556.956-3.2 1.803-4.932 2.534-8.052 3.4-17.123 4.25-25.666 2.411-11.888-2.558-22.196-9.27-29.629-18.25-8.678-10.491-13.317-23.693-13.083-37.219a66.265 66.265 0 011.756-14.123c1.652-6.946 4.383-13.512 8.089-19.455 13.155-21.09 38.102-33.023 62.723-30.012 22.438 2.746 41.67 17.287 50.135 38.109 8.191 20.148 5.159 43.41-7.941 60.956-7.117 9.528-17.06 16.949-28.445 21.231a73.08 73.08 0 01-13.007 3.818zm-111.336 0c-1.556.956-3.2 1.803-4.932 2.534-8.052 3.4-17.123 4.25-25.666 2.411-11.888-2.558-22.196-9.27-29.629-18.25-8.678-10.491-13.317-23.693-13.083-37.219a66.265 66.265 0 011.756-14.123c1.652-6.946 4.383-13.512 8.089-19.455 13.155-21.09 38.102-33.023 62.723-30.012 22.438 2.746 41.67 17.287 50.135 38.109 8.191 20.148 5.159 43.41-7.941 60.956-7.117 9.528-17.06 16.949-28.445 21.231a73.08 73.08 0 01-13.007 3.818z" />
            </svg>
          </div>
          <h2 className="text-2xl font-light text-foreground/80 mb-2">Lotus CRM</h2>
          <p className="text-muted-foreground max-w-sm mx-auto">Select a chat to start messaging or add a new contact to begin</p>
        </div>
      </div>
    );
  }

  const { contact } = activeChat;

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header - Fixed */}
      <div className="flex items-center justify-between px-2 sm:px-4 py-2 bg-panel-header border-b border-panel-border shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          {showBackButton && (
            <Button variant="ghost" size="icon" onClick={onBack} className="h-9 w-9 shrink-0">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          )}
          <button 
            className="flex items-center gap-3 hover:bg-accent/50 rounded-lg p-1 transition-colors min-w-0"
            onClick={() => setShowContactPanel(true)}
          >
            <ContactAvatar name={contact.name} avatar={contact.avatar} isOnline={contact.isOnline} size="md" />
            <div className="text-left min-w-0">
              <h2 className="font-medium text-sm sm:text-base truncate">{contact.name}</h2>
              <p className="text-xs text-muted-foreground">
                {contact.isOnline ? 'online' : contact.lastSeen ? formatLastSeen(contact.lastSeen) : 'offline'}
              </p>
            </div>
          </button>
        </div>

        <div className="flex items-center gap-0 sm:gap-1 shrink-0">
          <Button variant="ghost" size="icon" className="h-9 w-9 hidden sm:flex">
            <Video className="h-5 w-5 text-muted-foreground" />
          </Button>
          <Button variant="ghost" size="icon" className="h-9 w-9 hidden sm:flex">
            <Phone className="h-5 w-5 text-muted-foreground" />
          </Button>
          <Button variant="ghost" size="icon" className="h-9 w-9 hidden sm:flex">
            <Search className="h-5 w-5 text-muted-foreground" />
          </Button>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9">
                <MoreVertical className="h-5 w-5 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={() => setShowContactPanel(true)}>
                <Info className="h-4 w-4 mr-2" />
                Contact info
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleChatAction('pin')}>
                <Pin className="h-4 w-4 mr-2" />
                {activeChat.isPinned ? 'Unpin chat' : 'Pin chat'}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleChatAction('mute')}>
                <BellOff className="h-4 w-4 mr-2" />
                {activeChat.isMuted ? 'Unmute' : 'Mute notifications'}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleChatAction('archive')}>
                <Archive className="h-4 w-4 mr-2" />
                Archive chat
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => handleChatAction('clear')} className="text-destructive">
                <X className="h-4 w-4 mr-2" />
                Clear messages
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleChatAction('delete')} className="text-destructive">
                <Trash2 className="h-4 w-4 mr-2" />
                Delete chat
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Messages - Scrollable */}
      <div 
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto chat-background p-3 sm:p-4 custom-scrollbar min-h-0"
      >
        <div className="max-w-3xl mx-auto space-y-2">
          {chatMessages.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <p>No messages yet. Start the conversation!</p>
            </div>
          )}
          {chatMessages.map((message) => (
            <MessageBubble key={message.id} message={message} />
          ))}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input - Fixed */}
      <div className="px-2 sm:px-4 py-3 bg-panel-header border-t border-panel-border shrink-0">
        <div className="flex items-center gap-1 sm:gap-2 max-w-3xl mx-auto">
          <Button variant="ghost" size="icon" className="h-10 w-10 shrink-0 hidden sm:flex">
            <Smile className="h-6 w-6 text-muted-foreground" />
          </Button>
          
          <FileUploadButton onFileSelect={handleFileUpload} />
          
          <TemplateSelector 
            contact={contact as any} 
            onSelectTemplate={handleTemplateSelect} 
          />
          
          {isRecording ? (
            <VoiceRecorder
              isRecording={isRecording}
              setIsRecording={setIsRecording}
              onRecordingComplete={handleVoiceRecording}
              onCancel={() => setIsRecording(false)}
            />
          ) : (
            <>
              <Input
                ref={inputRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type a message"
                className="flex-1 bg-background border-0 focus-visible:ring-0 h-10"
                disabled={sending || uploading}
              />
              
              {inputValue.trim() ? (
                <Button 
                  size="icon" 
                  className="h-10 w-10 shrink-0 rounded-full" 
                  onClick={handleSend} 
                  disabled={sending || uploading}
                >
                  <Send className="h-5 w-5" />
                </Button>
              ) : (
                <VoiceRecorder
                  isRecording={isRecording}
                  setIsRecording={setIsRecording}
                  onRecordingComplete={handleVoiceRecording}
                  onCancel={() => setIsRecording(false)}
                />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
