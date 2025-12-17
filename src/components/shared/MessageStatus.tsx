import { Check, CheckCheck, Clock, AlertCircle } from 'lucide-react';
import { Message } from '@/types';

interface MessageStatusProps {
  status: Message['status'];
  className?: string;
}

export function MessageStatus({ status, className }: MessageStatusProps) {
  const iconClass = `h-4 w-4 ${className || ''}`;
  
  switch (status) {
    case 'sending':
      return <Clock className={`${iconClass} text-muted-foreground`} />;
    case 'sent':
      return <Check className={`${iconClass} text-muted-foreground`} />;
    case 'delivered':
      return <CheckCheck className={`${iconClass} text-muted-foreground`} />;
    case 'read':
      return <CheckCheck className={`${iconClass} text-lotus-blue`} />;
    case 'failed':
      return <AlertCircle className={`${iconClass} text-destructive`} />;
    default:
      return null;
  }
}
