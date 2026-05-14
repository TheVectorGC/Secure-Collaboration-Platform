import { format, isToday, isYesterday } from 'date-fns';

export function formatMessageTime(value: string): string {
  return format(new Date(value), 'HH:mm');
}

export function formatChatTime(value: string | null): string {
  if (!value) {
    return '';
  }

  const date = new Date(value);

  if (isToday(date)) {
    return format(date, 'HH:mm');
  }

  if (isYesterday(date)) {
    return 'Yesterday';
  }

  return format(date, 'dd.MM.yy');
}
