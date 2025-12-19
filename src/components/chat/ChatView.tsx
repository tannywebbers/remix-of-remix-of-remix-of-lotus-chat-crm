import { useState, useRef, useEffect } from 'react';
import { Send, Paperclip, Smile, Mic, MoreVertical, Phone, Video, Info, ArrowLeft } from 'lucide-react';
import { useAppStore } from '@/store/appStore';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { ContactAvatar } from '@/components/shared/ContactAvatar';
import { MessageBubble } from '@/components/chat/MessageBubble';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatLastSeen } from '@/lib/utils/format';
import { Message } from '@/types';

interface ChatViewProps {
  onBack?: () => void;
  showBackButton?: boolean;
}

export function ChatView({ onBack, showBackButton = false }: ChatViewProps) {
  const { activeChat, messages, addMessage, setShowContactPanel } = useAppStore();
  const { user } = useAuth();
  const [inputValue, setInputValue] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
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

  const handleSend = async () => {
    if (!inputValue.trim() || !activeChat || !user) return;

    const content = inputValue.trim();
    setInputValue('');
    setSending(true);

    try {
      const { data, error } = await supabase
        .from('messages')
        .insert({
          user_id: user.id,
          contact_id: activeChat.id,
          content,
          type: 'text',
          status: 'sent',
          is_outgoing: true,
        })
        .select()
        .single();

      if (error) throw error;

      const newMessage: Message = {
        id: data.id,
        contactId: data.contact_id,
        content: data.content,
        type: 'text',
        status: 'sent',
        isOutgoing: true,
        timestamp: new Date(data.created_at),
      };

      addMessage(activeChat.id, newMessage);
      inputRef.current?.focus();
    } catch (error) {
      console.error('Error sending message:', error);
      setInputValue(content);
    } finally {
      setSending(false);
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
    <div className="flex-1 flex flex-col min-w-0 h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-2 sm:px-4 py-2 bg-panel-header border-b border-panel-border shrink-0">
        <div className="flex items-center gap-2">
          {showBackButton && (
            <Button variant="ghost" size="icon" onClick={onBack} className="h-9 w-9 shrink-0">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          )}
          <button 
            className="flex items-center gap-3 hover:bg-accent/50 rounded-lg p-1 transition-colors"
            onClick={() => setShowContactPanel(true)}
          >
            <ContactAvatar name={contact.name} avatar={contact.avatar} isOnline={contact.isOnline} size="md" />
            <div className="text-left">
              <h2 className="font-medium text-sm sm:text-base">{contact.name}</h2>
              <p className="text-xs text-muted-foreground">
                {contact.isOnline ? 'online' : contact.lastSeen ? formatLastSeen(contact.lastSeen) : 'offline'}
              </p>
            </div>
          </button>
        </div>

        <div className="flex items-center gap-0 sm:gap-1">
          <Button variant="ghost" size="icon" className="h-9 w-9 hidden sm:flex">
            <Video className="h-5 w-5 text-muted-foreground" />
          </Button>
          <Button variant="ghost" size="icon" className="h-9 w-9 hidden sm:flex">
            <Phone className="h-5 w-5 text-muted-foreground" />
          </Button>
          <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => setShowContactPanel(true)}>
            <Info className="h-5 w-5 text-muted-foreground" />
          </Button>
          <Button variant="ghost" size="icon" className="h-9 w-9">
            <MoreVertical className="h-5 w-5 text-muted-foreground" />
          </Button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto chat-background p-3 sm:p-4 custom-scrollbar">
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

      {/* Input */}
      <div className="px-2 sm:px-4 py-3 bg-panel-header border-t border-panel-border shrink-0">
        <div className="flex items-center gap-1 sm:gap-2 max-w-3xl mx-auto">
          <Button variant="ghost" size="icon" className="h-10 w-10 shrink-0 hidden sm:flex">
            <Smile className="h-6 w-6 text-muted-foreground" />
          </Button>
          <Button variant="ghost" size="icon" className="h-10 w-10 shrink-0">
            <Paperclip className="h-5 w-5 text-muted-foreground" />
          </Button>
          
          <Input
            ref={inputRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message"
            className="flex-1 bg-background border-0 focus-visible:ring-0 h-10"
            disabled={sending}
          />
          
          {inputValue.trim() ? (
            <Button size="icon" className="h-10 w-10 shrink-0 rounded-full" onClick={handleSend} disabled={sending}>
              <Send className="h-5 w-5" />
            </Button>
          ) : (
            <Button variant="ghost" size="icon" className="h-10 w-10 shrink-0">
              <Mic className="h-5 w-5 text-muted-foreground" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
