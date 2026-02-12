import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Phone, Video, Send } from 'lucide-react';
import { useAppStore } from '@/store/appStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MessageBubble } from '@/components/chat/MessageBubble';
import { ContactAvatar } from '@/components/shared/ContactAvatar';
import { ChatOptionsMenu } from '@/components/chat/ChatOptionsMenu';
import { FileUploadButton } from '@/components/chat/FileUploadButton';
import { VoiceRecorder } from '@/components/chat/VoiceRecorder';
import { TemplateSelector } from '@/components/chat/TemplateSelector';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Message } from '@/types';
import { cn } from '@/lib/utils';

interface ChatViewProps {
  onBack?: () => void;
  onCall?: () => void;
  onVideoCall?: () => void;
  onViewContact?: () => void;
}

export function ChatView({ onBack, onCall, onVideoCall, onViewContact }: ChatViewProps) {
  const { activeChat, messages, addMessage, setDraft, drafts, updateMessageStatus } = useAppStore();
  const { user } = useAuth();
  const { toast } = useToast();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);

  const chatMessages = activeChat ? messages[activeChat.id] || [] : [];

  useEffect(() => {
    if (activeChat) {
      setMessage(drafts[activeChat.id] || '');
      scrollToBottom();
      // FIXED: Mark messages as read when opening chat
      markMessagesAsRead();
    }
  }, [activeChat?.id]);

  useEffect(() => {
    scrollToBottom();
  }, [chatMessages.length]);

  // FIXED: New function to mark messages as read in the database
  const markMessagesAsRead = async () => {
    if (!activeChat || !user) return;

    try {
      // Update all unread incoming messages to 'read' status
      const { error } = await supabase
        .from('messages')
        .update({ status: 'read' })
        .eq('contact_id', activeChat.id)
        .eq('is_outgoing', false)
        .neq('status', 'read');

      if (error) {
        console.error('Error marking messages as read:', error);
      }
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  };

  const scrollToBottom = () => {
    setTimeout(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
    }, 100);
  };

  const handleSendMessage = async (content: string, type: Message['type'] = 'text', mediaUrl?: string) => {
    if (!activeChat || !user) return;

    const tempId = `temp-${Date.now()}`;
    const newMessage: Message = {
      id: tempId,
      contactId: activeChat.id,
      content,
      type,
      status: 'pending',
      isOutgoing: true,
      timestamp: new Date(),
      mediaUrl,
    };

    addMessage(activeChat.id, newMessage);
    setMessage('');
    setDraft(activeChat.id, '');

    try {
      const { data, error } = await supabase
        .from('messages')
        .insert({
          user_id: user.id,
          contact_id: activeChat.id,
          content,
          type,
          is_outgoing: true,
          status: 'sent',
          media_url: mediaUrl,
        })
        .select()
        .single();

      if (error) throw error;

      updateMessageStatus(activeChat.id, tempId, 'sent');
    } catch (error: any) {
      console.error('Error sending message:', error);
      updateMessageStatus(activeChat.id, tempId, 'failed');
      toast({
        title: 'Failed to send message',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleSend = async () => {
    if (!message.trim() || sending) return;
    setSending(true);
    await handleSendMessage(message.trim());
    setSending(false);
  };

  const handleFileSelect = async (file: File, type: 'image' | 'document' | 'audio') => {
    if (!activeChat || !user) return;

    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${activeChat.id}/${Date.now()}.${fileExt}`;
      const bucket = type === 'image' ? 'message-media' : type === 'audio' ? 'voice-notes' : 'documents';

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(fileName);

      const messageType = type === 'image' && file.type.startsWith('video/') ? 'video' : type;
      const content = type === 'image' ? '[Image]' : type === 'audio' ? '[Voice Message]' : file.name;

      await handleSendMessage(content, messageType, urlData.publicUrl);

      toast({ title: `${type === 'image' ? 'Media' : type === 'audio' ? 'Voice note' : 'Document'} sent` });
    } catch (error: any) {
      console.error('Error uploading file:', error);
      toast({
        title: 'Upload failed',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
    }
  };

  // FIXED: Complete voice recording upload function
  const handleSendAudio = async (blob: Blob) => {
    if (!activeChat || !user) return;

    setUploading(true);
    try {
      const fileName = `${user.id}/${activeChat.id}/${Date.now()}.webm`;
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('voice-notes')
        .upload(fileName, blob, {
          contentType: 'audio/webm',
          cacheControl: '3600',
        });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('voice-notes')
        .getPublicUrl(fileName);

      await handleSendMessage('[Voice Message]', 'audio', urlData.publicUrl);

      toast({ title: 'Voice message sent' });
    } catch (error: any) {
      console.error('Error uploading voice note:', error);
      toast({
        title: 'Failed to send voice message',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
      setIsRecording(false);
    }
  };

  const handleTemplateSelect = async (template: any, params: Record<string, string>) => {
    if (!activeChat || !user) return;

    setSending(true);
    try {
      const { data, error } = await supabase
        .from('messages')
        .insert({
          user_id: user.id,
          contact_id: activeChat.id,
          content: `Template: ${template.name}`,
          type: 'text',
          is_outgoing: true,
          status: 'sent',
          template_name: template.name,
          template_params: params,
        })
        .select()
        .single();

      if (error) throw error;

      const newMessage: Message = {
        id: data.id,
        contactId: activeChat.id,
        content: `Template: ${template.name}`,
        type: 'text',
        status: 'sent',
        isOutgoing: true,
        timestamp: new Date(data.created_at),
        templateName: template.name,
        templateParams: params,
      };

      addMessage(activeChat.id, newMessage);
      toast({ title: 'Template message sent' });
    } catch (error: any) {
      console.error('Error sending template:', error);
      toast({
        title: 'Failed to send template',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setSending(false);
    }
  };

  if (!activeChat) {
    return (
      <div className="flex-1 flex items-center justify-center bg-background">
        <div className="text-center text-muted-foreground">
          <p className="text-lg font-medium">Select a chat to start messaging</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-chat-bg">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-2.5 bg-panel border-b border-panel-border shrink-0">
        {onBack && (
          <Button variant="ghost" size="icon" className="h-9 w-9 lg:hidden" onClick={onBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
        )}

        <button onClick={onViewContact} className="flex items-center gap-3 flex-1 min-w-0">
          <ContactAvatar
            name={activeChat.contact.name}
            avatar={activeChat.contact.avatar}
            isOnline={activeChat.contact.isOnline}
            lastSeen={activeChat.contact.lastSeen}
            size="md"
          />
          <div className="flex-1 min-w-0 text-left">
            <h2 className="font-semibold text-[17px] truncate">{activeChat.contact.name}</h2>
            <p className="text-[13px] text-muted-foreground truncate">
              {activeChat.contact.isOnline ? 'Online' : activeChat.contact.lastSeen ? `Last seen ${activeChat.contact.lastSeen.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Offline'}
            </p>
          </div>
        </button>

        <div className="flex items-center gap-1">
          {onVideoCall && (
            <Button variant="ghost" size="icon" className="h-9 w-9" onClick={onVideoCall}>
              <Video className="h-5 w-5 text-muted-foreground" />
            </Button>
          )}
          {onCall && (
            <Button variant="ghost" size="icon" className="h-9 w-9" onClick={onCall}>
              <Phone className="h-5 w-5 text-muted-foreground" />
            </Button>
          )}
          <ChatOptionsMenu
            chatId={activeChat.id}
            contactName={activeChat.contact.name}
            isPinned={activeChat.isPinned}
            isMuted={activeChat.isMuted}
            isArchived={activeChat.isArchived}
            onViewContact={onViewContact}
          />
        </div>
      </div>

      {/* Messages */}
      <ScrollArea ref={scrollRef} className="flex-1 px-4 py-2">
        <div className="space-y-2">
          {chatMessages.length === 0 ? (
            <div className="flex items-center justify-center h-full text-muted-foreground py-12">
              <p className="text-sm">No messages yet. Start the conversation!</p>
            </div>
          ) : (
            chatMessages.map((msg) => <MessageBubble key={msg.id} message={msg} />)
          )}
        </div>
      </ScrollArea>

      {/* Input Area */}
      <div className="px-4 py-3 bg-panel border-t border-panel-border shrink-0">
        <div className="flex items-center gap-2">
          {!isRecording && (
            <>
              <FileUploadButton onFileSelect={handleFileSelect} uploading={uploading} />
              <TemplateSelector
                contact={{
                  loanId: activeChat.contact.loanId,
                  name: activeChat.contact.name,
                  phone: activeChat.contact.phone,
                  amount: activeChat.contact.amount,
                  appType: activeChat.contact.appType,
                  dayType: activeChat.contact.dayType,
                  accountDetails: activeChat.contact.accountDetails,
                }}
                onSelectTemplate={handleTemplateSelect}
              />
            </>
          )}

          {isRecording ? (
            <VoiceRecorder
              onRecordingComplete={handleSendAudio}
              onCancel={() => setIsRecording(false)}
              isRecording={isRecording}
              setIsRecording={setIsRecording}
            />
          ) : (
            <>
              <Input
                value={message}
                onChange={(e) => {
                  setMessage(e.target.value);
                  setDraft(activeChat.id, e.target.value);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder="Type a message..."
                className="flex-1 bg-background border-input"
                disabled={sending || uploading}
              />

              {message.trim() ? (
                <Button
                  size="icon"
                  className="h-10 w-10 rounded-full shrink-0"
                  onClick={handleSend}
                  disabled={sending || uploading}
                >
                  <Send className="h-5 w-5" />
                </Button>
              ) : (
                <VoiceRecorder
                  onRecordingComplete={handleSendAudio}
                  onCancel={() => setIsRecording(false)}
                  isRecording={isRecording}
                  setIsRecording={setIsRecording}
                />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
