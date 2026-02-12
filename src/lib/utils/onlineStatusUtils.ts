import { supabase } from '@/integrations/supabase/client';

/**
 * Check if a contact is online based on their last_seen timestamp
 * Online = last_seen within last 5 minutes
 */
export function isContactOnline(lastSeen: Date | undefined | null): boolean {
  if (!lastSeen) return false;
  
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
  const lastSeenDate = lastSeen instanceof Date ? lastSeen : new Date(lastSeen);
  
  return lastSeenDate > fiveMinutesAgo;
}

/**
 * Background task to update online status for all contacts
 * Call this periodically (e.g., every minute) to keep online status accurate
 */
export async function updateContactsOnlineStatus(userId: string) {
  try {
    // Get all contacts with their last_seen time
    const { data: contacts, error } = await supabase
      .from('contacts')
      .select('id, last_seen, is_online')
      .eq('user_id', userId);

    if (error) {
      console.error('Error fetching contacts for status update:', error);
      return;
    }

    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const updates: { id: string; is_online: boolean }[] = [];

    contacts?.forEach(contact => {
      if (!contact.last_seen) {
        // No last_seen means never online
        if (contact.is_online) {
          updates.push({ id: contact.id, is_online: false });
        }
        return;
      }

      const lastSeenDate = new Date(contact.last_seen);
      const shouldBeOnline = lastSeenDate > fiveMinutesAgo;

      // Only update if status changed
      if (contact.is_online !== shouldBeOnline) {
        updates.push({ id: contact.id, is_online: shouldBeOnline });
      }
    });

    // Batch update all contacts with changed status
    if (updates.length > 0) {
      console.log(`Updating online status for ${updates.length} contacts`);
      
      for (const update of updates) {
        await supabase
          .from('contacts')
          .update({ is_online: update.is_online })
          .eq('id', update.id);
      }
    }
  } catch (error) {
    console.error('Error updating contacts online status:', error);
  }
}

/**
 * React hook to automatically update online status in the background
 * Add this to your main App component
 */
export function useOnlineStatusUpdater(userId: string | undefined) {
  useEffect(() => {
    if (!userId) return;

    // Update immediately on mount
    updateContactsOnlineStatus(userId);

    // Then update every 60 seconds
    const interval = setInterval(() => {
      updateContactsOnlineStatus(userId);
    }, 60 * 1000); // 60 seconds

    return () => clearInterval(interval);
  }, [userId]);
}

// For use in non-React contexts
import { useEffect } from 'react';
