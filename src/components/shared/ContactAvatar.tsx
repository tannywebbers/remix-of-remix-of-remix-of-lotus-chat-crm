import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { getInitials } from '@/lib/utils/format';
import { cn } from '@/lib/utils';

interface ContactAvatarProps {
  name: string;
  avatar?: string;
  isOnline?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeClasses = {
  sm: 'h-10 w-10 text-sm',
  md: 'h-12 w-12 text-base',
  lg: 'h-16 w-16 text-lg',
};

const statusSizeClasses = {
  sm: 'h-2.5 w-2.5 right-0 bottom-0',
  md: 'h-3 w-3 right-0.5 bottom-0.5',
  lg: 'h-4 w-4 right-0.5 bottom-0.5',
};

export function ContactAvatar({ name, avatar, isOnline, size = 'md', className }: ContactAvatarProps) {
  return (
    <div className="relative">
      <Avatar className={cn(sizeClasses[size], 'bg-primary/10', className)}>
        <AvatarImage src={avatar} alt={name} />
        <AvatarFallback className="bg-primary/10 text-primary font-medium">
          {getInitials(name)}
        </AvatarFallback>
      </Avatar>
      {isOnline !== undefined && (
        <span
          className={cn(
            'absolute rounded-full border-2 border-background',
            statusSizeClasses[size],
            isOnline ? 'bg-status-online' : 'bg-status-offline'
          )}
        />
      )}
    </div>
  );
}
