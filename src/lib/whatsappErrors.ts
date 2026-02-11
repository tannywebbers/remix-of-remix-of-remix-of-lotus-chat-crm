// Map WhatsApp Cloud API error codes/messages to user-friendly explanations
export function getWhatsAppErrorExplanation(errorMessage: string): { title: string; description: string; action: string } {
  const lower = errorMessage.toLowerCase();

  if (lower.includes('insufficient') || lower.includes('balance') || lower.includes('payment')) {
    return {
      title: 'Insufficient Balance',
      description: 'Your Meta/WhatsApp Business account does not have enough balance to send this template message.',
      action: 'Top up your Meta Business account balance in the Meta Business Suite.',
    };
  }
  if (lower.includes('template') && (lower.includes('require') || lower.includes('24') || lower.includes('window'))) {
    return {
      title: 'Template Required',
      description: 'This is a business-initiated conversation. You must use a pre-approved template message to start the conversation.',
      action: 'Send a template message first, then you can send free-form messages after the customer replies.',
    };
  }
  if (lower.includes('block') || lower.includes('spam')) {
    return {
      title: 'Contact Blocked',
      description: 'This contact has blocked your business number or reported it as spam.',
      action: 'You cannot send messages to this contact. They must unblock your number.',
    };
  }
  if (lower.includes('invalid') && (lower.includes('phone') || lower.includes('number') || lower.includes('recipient'))) {
    return {
      title: 'Invalid Phone Number',
      description: 'The phone number format is invalid or the number is not registered on WhatsApp.',
      action: 'Verify the phone number is correct and includes the country code (e.g., +234...).',
    };
  }
  if (lower.includes('not registered') || lower.includes('not a whatsapp') || lower.includes('not on whatsapp')) {
    return {
      title: 'Not on WhatsApp',
      description: 'This contact is not registered on WhatsApp.',
      action: 'Verify the phone number or contact them through another channel.',
    };
  }
  if (lower.includes('template') && (lower.includes('reject') || lower.includes('paused') || lower.includes('disabled'))) {
    return {
      title: 'Template Rejected',
      description: 'This message template has been rejected or paused by Meta.',
      action: 'Check your template status in Meta Business Suite and submit a new template if needed.',
    };
  }
  if (lower.includes('auth') || lower.includes('token') || lower.includes('unauthorized') || lower.includes('403') || lower.includes('401')) {
    return {
      title: 'Authentication Failed',
      description: 'Your WhatsApp API access token is invalid or expired.',
      action: 'Go to Settings > WhatsApp API and update your access token.',
    };
  }
  if (lower.includes('rate') || lower.includes('limit') || lower.includes('throttl')) {
    return {
      title: 'Rate Limited',
      description: 'Too many messages sent in a short period. WhatsApp has temporarily limited your account.',
      action: 'Wait a few minutes before sending more messages.',
    };
  }

  // Fallback
  return {
    title: 'Message Failed',
    description: errorMessage,
    action: 'Check your WhatsApp API settings and try again.',
  };
}
