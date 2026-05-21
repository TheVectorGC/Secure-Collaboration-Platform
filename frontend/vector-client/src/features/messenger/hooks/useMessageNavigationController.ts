import { useState, type MutableRefObject } from 'react';

export function useMessageNavigationController(messageElementRefs: MutableRefObject<Record<string, HTMLDivElement | null>>) {
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);

  function scrollToMessage(messageId: string) {
    const messageElement = messageElementRefs.current[messageId];

    if (!messageElement) {
      return;
    }

    messageElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setHighlightedMessageId(messageId);

    window.setTimeout(() => {
      setHighlightedMessageId((currentValue) => currentValue === messageId ? null : currentValue);
    }, 1800);
  }

  return {
    highlightedMessageId,
    scrollToMessage,
  };
}
