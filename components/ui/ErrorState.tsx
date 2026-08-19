import React from 'react';
import { EmptyState } from './EmptyState';

interface Props {
  /** What went wrong and what to do next, in plain sentence case. */
  message?: string;
  onRetry: () => void;
}

const DEFAULT_MESSAGE = "Couldn't load this. Check your connection and try again.";

/**
 * Shared error state for failed queries — an icon, honest copy, and a
 * "Try Again" button wired to the caller's refetch. Use this instead of a
 * bespoke error block wherever a query can fail.
 */
export function ErrorState({ message = DEFAULT_MESSAGE, onRetry }: Props) {
  return (
    <EmptyState
      icon="cloud-offline-outline"
      title="Something went wrong"
      description={message}
      actionLabel="Try Again"
      onAction={onRetry}
    />
  );
}
