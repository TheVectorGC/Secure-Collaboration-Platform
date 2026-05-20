import { format, isToday, isYesterday, differenceInCalendarDays } from 'date-fns';
import { ru } from 'date-fns/locale';

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
    return 'вчера';
  }

  const dayDifference = differenceInCalendarDays(new Date(), date);

  if (dayDifference > 1 && dayDifference < 7) {
    return format(date, 'EEE', { locale: ru }).replace('.', '');
  }

  return format(date, 'd MMM', { locale: ru });
}

export function formatMessageDate(value: string): string {
  const date = new Date(value);

  if (isToday(date)) {
    return 'Сегодня';
  }

  if (isYesterday(date)) {
    return 'Вчера';
  }

  return format(date, 'd MMMM yyyy', { locale: ru });
}

export function formatLastSeen(value: string | null | undefined): string {
  if (!value) {
    return 'был(а) недавно';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'был(а) недавно';
  }

  if (isToday(date)) {
    return `был(а) сегодня в ${format(date, 'HH:mm')}`;
  }

  if (isYesterday(date)) {
    return `был(а) вчера в ${format(date, 'HH:mm')}`;
  }

  const dayDifference = differenceInCalendarDays(new Date(), date);

  if (dayDifference < 365) {
    return `был(а) ${format(date, 'd MMMM', { locale: ru })}`;
  }

  return `был(а) ${format(date, 'd MMMM yyyy', { locale: ru })}`;
}
