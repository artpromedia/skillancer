'use client';

/**
 * ConversationStarter Component
 *
 * Button/modal for starting a new conversation from freelancer profiles,
 * job postings, or proposal pages.
 */

import {
  Button,
  cn,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Textarea,
} from '@skillancer/ui';
import { Loader2, MessageSquarePlus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useState } from 'react';

import { useCreateConversation } from '@/hooks/api/use-conversations';

// ============================================================================
// Types
// ============================================================================

export type ConversationContext = 'freelancer' | 'job' | 'proposal' | 'general';

export interface ConversationStarterProps {
  /** ID of the user to start conversation with */
  readonly recipientId: string;
  /** Name of the recipient for display */
  readonly recipientName: string;
  /** Context where the conversation is being started */
  readonly context?: ConversationContext;
  /** Related entity ID (job, proposal, etc.) */
  readonly contextId?: string;
  /** Title suggestion based on context */
  readonly suggestedSubject?: string;
  /** Custom button text */
  readonly buttonText?: string;
  /** Custom button variant */
  readonly buttonVariant?: 'default' | 'outline' | 'secondary' | 'ghost';
  /** Custom button size */
  readonly buttonSize?: 'default' | 'sm' | 'lg' | 'icon';
  /** Hide the icon */
  readonly hideIcon?: boolean;
  /** Custom class name */
  readonly className?: string;
  /** Callback after conversation is created */
  readonly onConversationCreated?: (conversationId: string) => void;
}

export interface QuickMessageButtonProps {
  /** ID of the user to message */
  readonly recipientId: string;
  /** Name of the recipient (reserved for future use) */
  readonly _recipientName?: string;
  /** Pre-filled message */
  readonly message: string;
  /** Custom button text */
  readonly buttonText?: string;
  /** Custom class name */
  readonly className?: string;
}

// ============================================================================
// Constants
// ============================================================================

const CONTEXT_LABELS: Record<ConversationContext, string> = {
  freelancer: 'Contact Freelancer',
  job: 'Message about Job',
  proposal: 'Discuss Proposal',
  general: 'Start Conversation',
};

const CONTEXT_DESCRIPTIONS: Record<ConversationContext, string> = {
  freelancer: 'Send a message to introduce yourself and discuss potential work.',
  job: 'Ask questions or express interest about this job posting.',
  proposal: 'Discuss the details of this proposal.',
  general: 'Start a new conversation.',
};

const CONTEXT_PLACEHOLDERS: Record<ConversationContext, string> = {
  freelancer:
    "Hi! I came across your profile and I'm interested in discussing a potential project...",
  job: "Hi! I'm interested in this job posting and would like to learn more about...",
  proposal: "Thank you for your proposal. I'd like to discuss some details...",
  general: 'Type your message here...',
};

// ============================================================================
// Component
// ============================================================================

export function ConversationStarter({
  recipientId,
  recipientName,
  context = 'general',
  contextId,
  suggestedSubject,
  buttonText,
  buttonVariant = 'default',
  buttonSize = 'default',
  hideIcon = false,
  className,
  onConversationCreated,
}: ConversationStarterProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [title, setTitle] = useState(suggestedSubject || '');
  const [message, setMessage] = useState('');

  const createConversation = useCreateConversation();

  const handleSubmit = useCallback(async () => {
    if (!message.trim()) return;

    try {
      const conversation = await createConversation.mutateAsync({
        participantIds: [recipientId],
        initialMessage: message.trim(),
        title: title.trim() || undefined,
        contextType: contextId
          ? (context?.toUpperCase() as 'JOB' | 'CONTRACT' | 'PROPOSAL')
          : undefined,
        contextId: contextId || undefined,
      });

      setIsOpen(false);
      setTitle('');
      setMessage('');

      if (onConversationCreated) {
        onConversationCreated(conversation.id);
      } else {
        // Navigate to the new conversation
        router.push(`/messages/${conversation.id}`);
      }
    } catch (error) {
      // Error is handled by the mutation's error handling
      console.error('Failed to create conversation:', error);
    }
  }, [
    message,
    title,
    recipientId,
    context,
    contextId,
    createConversation,
    onConversationCreated,
    router,
  ]);

  const displayText = buttonText || CONTEXT_LABELS[context];

  return (
    <>
      <Button
        className={className}
        size={buttonSize}
        variant={buttonVariant}
        onClick={() => setIsOpen(true)}
      >
        {!hideIcon && <MessageSquarePlus className="mr-2 h-4 w-4" />}
        {displayText}
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Message {recipientName}</DialogTitle>
            <DialogDescription>{CONTEXT_DESCRIPTIONS[context]}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="title">Subject (optional)</Label>
              <Input
                id="title"
                placeholder="Enter a subject for this conversation..."
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="message">Message</Label>
              <Textarea
                className="min-h-[120px] resize-none"
                id="message"
                placeholder={CONTEXT_PLACEHOLDERS[context]}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              disabled={createConversation.isPending}
              variant="outline"
              onClick={() => setIsOpen(false)}
            >
              Cancel
            </Button>
            <Button
              disabled={!message.trim() || createConversation.isPending}
              onClick={() => void handleSubmit()}
            >
              {createConversation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Send Message
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ============================================================================
// Quick Message Button
// ============================================================================

/**
 * A simpler version that sends a pre-defined message immediately
 */
export function QuickMessageButton({
  recipientId,
  _recipientName,
  message,
  buttonText = 'Quick Message',
  className,
}: QuickMessageButtonProps) {
  const router = useRouter();
  const createConversation = useCreateConversation();

  const handleClick = useCallback(async () => {
    try {
      const conversation = await createConversation.mutateAsync({
        participantIds: [recipientId],
        initialMessage: message,
      });

      router.push(`/messages/${conversation.id}`);
    } catch (error) {
      console.error('Failed to create conversation:', error);
    }
  }, [recipientId, message, createConversation, router]);

  return (
    <Button
      className={className}
      disabled={createConversation.isPending}
      variant="outline"
      onClick={() => void handleClick()}
    >
      {createConversation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
      {buttonText}
    </Button>
  );
}

// ============================================================================
// New Conversation Modal
// ============================================================================

export interface NewConversationModalProps {
  /** Whether the modal is open */
  readonly isOpen: boolean;
  /** Callback to close the modal */
  readonly onClose: () => void;
  /** Available contacts to message */
  readonly contacts?: Array<{
    id: string;
    name: string;
    avatar?: string;
  }>;
  /** Custom class name */
  readonly className?: string;
}

export function NewConversationModal({
  isOpen,
  onClose,
  contacts = [],
  className,
}: NewConversationModalProps) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedContact, setSelectedContact] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  const createConversation = useCreateConversation();

  const filteredContacts = contacts.filter((contact) =>
    contact.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSubmit = useCallback(async () => {
    if (!selectedContact || !message.trim()) return;

    try {
      const conversation = await createConversation.mutateAsync({
        participantIds: [selectedContact],
        initialMessage: message.trim(),
      });

      onClose();
      setSearchQuery('');
      setSelectedContact(null);
      setMessage('');

      router.push(`/messages/${conversation.id}`);
    } catch (error) {
      console.error('Failed to create conversation:', error);
    }
  }, [selectedContact, message, createConversation, onClose, router]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className={cn('sm:max-w-[500px]', className)}>
        <DialogHeader>
          <DialogTitle>New Conversation</DialogTitle>
          <DialogDescription>Select a contact and write your message.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Contact search */}
          <div className="space-y-2">
            <Label htmlFor="contact-search">To</Label>
            <Input
              id="contact-search"
              placeholder="Search contacts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />

            {/* Contact list */}
            {searchQuery && filteredContacts.length > 0 && (
              <div className="max-h-[150px] space-y-1 overflow-y-auto rounded-md border p-1">
                {filteredContacts.map((contact) => (
                  <button
                    key={contact.id}
                    className={cn(
                      'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm',
                      'hover:bg-accent',
                      selectedContact === contact.id && 'bg-accent'
                    )}
                    type="button"
                    onClick={() => {
                      setSelectedContact(contact.id);
                      setSearchQuery(contact.name);
                    }}
                  >
                    <div className="bg-muted flex h-8 w-8 items-center justify-center rounded-full text-xs font-medium">
                      {contact.avatar ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          alt={contact.name}
                          className="h-full w-full rounded-full object-cover"
                          src={contact.avatar}
                        />
                      ) : (
                        contact.name
                          .split(' ')
                          .map((n) => n[0])
                          .join('')
                          .slice(0, 2)
                          .toUpperCase()
                      )}
                    </div>
                    <span>{contact.name}</span>
                  </button>
                ))}
              </div>
            )}

            {searchQuery && filteredContacts.length === 0 && (
              <p className="text-muted-foreground text-sm">No contacts found</p>
            )}
          </div>

          {/* Message input */}
          <div className="space-y-2">
            <Label htmlFor="new-message">Message</Label>
            <Textarea
              className="min-h-[100px] resize-none"
              id="new-message"
              placeholder="Type your message..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button disabled={createConversation.isPending} variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={!selectedContact || !message.trim() || createConversation.isPending}
            onClick={() => void handleSubmit()}
          >
            {createConversation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Send
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
