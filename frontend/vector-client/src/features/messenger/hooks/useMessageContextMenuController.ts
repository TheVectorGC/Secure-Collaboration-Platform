import { MouseEvent, useCallback, useEffect, useRef, useState } from 'react';
import type { MessageResponseDto } from '../../../shared/types/api';
import type { MessageContextMenuState } from '../../../pages/MessengerPageSupport';

type UseMessageContextMenuControllerParams = {
  currentAccountId: string | undefined;
  getMessageById: (messageId: string) => MessageResponseDto | null;
  onContextMenuOpen?: () => void;
};

const VIEWPORT_PADDING_PX = 12;
const MENU_GAP_PX = 10;

type MeasuredMenuPosition = {
  x: number;
  y: number;
};

function clampValue(value: number, minimumValue: number, maximumValue: number): number {
  return Math.max(minimumValue, Math.min(value, maximumValue));
}

function calculateMenuPosition(anchorRect: DOMRect, placement: MessageContextMenuState['placement'], menuWidth: number, menuHeight: number): MeasuredMenuPosition {
  const preferredX = placement === 'left'
    ? anchorRect.left - menuWidth - MENU_GAP_PX
    : anchorRect.right + MENU_GAP_PX;
  const maximumX = window.innerWidth - menuWidth - VIEWPORT_PADDING_PX;
  const maximumY = window.innerHeight - menuHeight - VIEWPORT_PADDING_PX;
  const preferredY = anchorRect.top;

  return {
    x: clampValue(preferredX, VIEWPORT_PADDING_PX, Math.max(VIEWPORT_PADDING_PX, maximumX)),
    y: clampValue(preferredY, VIEWPORT_PADDING_PX, Math.max(VIEWPORT_PADDING_PX, maximumY)),
  };
}

function findMessageBubbleElement(eventTarget: EventTarget | null): HTMLElement | null {
  if (!(eventTarget instanceof HTMLElement)) {
    return null;
  }

  return eventTarget.closest('[data-message-bubble="true"]');
}

function createAnchorRectSnapshot(anchorRect: DOMRect): MessageContextMenuState['anchorRect'] {
  return {
    left: anchorRect.left,
    right: anchorRect.right,
    top: anchorRect.top,
    bottom: anchorRect.bottom,
    width: anchorRect.width,
    height: anchorRect.height,
  };
}

export function useMessageContextMenuController({
  currentAccountId,
  getMessageById,
  onContextMenuOpen,
}: UseMessageContextMenuControllerParams) {
  const [messageContextMenu, setMessageContextMenu] = useState<MessageContextMenuState | null>(null);
  const messageContextMenuRef = useRef<HTMLDivElement | null>(null);

  const closeMessageContextMenu = useCallback(() => {
    setMessageContextMenu(null);
  }, []);

  const updateMessageContextMenuPosition = useCallback(() => {
    setMessageContextMenu((currentContextMenu) => {
      if (!currentContextMenu || !messageContextMenuRef.current) {
        return currentContextMenu;
      }

      const menuElement = messageContextMenuRef.current;
      const nextPosition = calculateMenuPosition(
        currentContextMenu.anchorDomRect,
        currentContextMenu.placement,
        menuElement.offsetWidth,
        menuElement.offsetHeight,
      );

      if (nextPosition.x === currentContextMenu.x && nextPosition.y === currentContextMenu.y && currentContextMenu.isPositioned) {
        return currentContextMenu;
      }

      return {
        ...currentContextMenu,
        ...nextPosition,
        isPositioned: true,
      };
    });
  }, []);

  useEffect(() => {
    if (!messageContextMenu) {
      return;
    }

    const animationFrameId = window.requestAnimationFrame(updateMessageContextMenuPosition);

    return () => window.cancelAnimationFrame(animationFrameId);
  }, [messageContextMenu?.messageId, messageContextMenu?.anchorRect.left, messageContextMenu?.anchorRect.right, messageContextMenu?.anchorRect.top, messageContextMenu?.anchorRect.bottom, updateMessageContextMenuPosition]);

  useEffect(() => {
    if (!messageContextMenu) {
      return;
    }

    function closeContextMenuOnPointerDown(event: globalThis.MouseEvent) {
      const targetElement = event.target as HTMLElement | null;

      if (targetElement?.closest('[data-message-context-menu="true"]')) {
        return;
      }

      closeMessageContextMenu();
    }

    function closeContextMenuOnEscape(event: globalThis.KeyboardEvent) {
      if (event.key === 'Escape') {
        closeMessageContextMenu();
      }
    }

    document.addEventListener('mousedown', closeContextMenuOnPointerDown);
    document.addEventListener('keydown', closeContextMenuOnEscape);
    window.addEventListener('resize', closeMessageContextMenu);
    window.addEventListener('scroll', closeMessageContextMenu, true);

    return () => {
      document.removeEventListener('mousedown', closeContextMenuOnPointerDown);
      document.removeEventListener('keydown', closeContextMenuOnEscape);
      window.removeEventListener('resize', closeMessageContextMenu);
      window.removeEventListener('scroll', closeMessageContextMenu, true);
    };
  }, [closeMessageContextMenu, messageContextMenu]);

  function openMessageContextMenu(event: MouseEvent<HTMLElement>, messageId: string) {
    event.preventDefault();
    event.stopPropagation();

    const contextMessage = getMessageById(messageId);

    if (!contextMessage) {
      closeMessageContextMenu();
      return;
    }

    const messageBubbleElement = findMessageBubbleElement(event.currentTarget);

    if (!messageBubbleElement) {
      closeMessageContextMenu();
      return;
    }

    onContextMenuOpen?.();

    const anchorDomRect = messageBubbleElement.getBoundingClientRect();
    const placement: MessageContextMenuState['placement'] = contextMessage.senderAccountId === currentAccountId ? 'left' : 'right';
    const initialPosition = calculateMenuPosition(anchorDomRect, placement, 256, 232);

    setMessageContextMenu({
      messageId,
      placement,
      anchorRect: createAnchorRectSnapshot(anchorDomRect),
      anchorDomRect,
      x: initialPosition.x,
      y: initialPosition.y,
      isPositioned: false,
    });
  }

  return {
    messageContextMenu,
    messageContextMenuRef,
    openMessageContextMenu,
    closeMessageContextMenu,
    setMessageContextMenu,
  };
}
