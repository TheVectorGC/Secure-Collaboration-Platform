import { useEffect, useMemo, useState } from 'react';
import { Download, FileText, LoaderCircle, Plus, RefreshCw, Search, ShieldCheck, UserPlus, X } from 'lucide-react';
import { searchProfiles } from '../../directory/api/profilesApi';
import { formatFileSize } from '../../media/lib/fileCrypto';
import { formatMessageTime } from '../../../shared/lib/dateFormat';
import { getAccountDisplayName, getAccountUsernameLabel } from '../../../shared/lib/profile';
import type { DocumentResponseDto, ProfileResponseDto } from '../../../shared/types/api';
import { getAccountAvatarUrl, type DocumentCreationDraft, UserAvatar } from '../../messenger/lib/messengerCore';

function getDocumentStatusLabel(status: DocumentResponseDto['status']): string {
  if (status === 'FULLY_SIGNED') {
    return 'Подписан полностью';
  }

  if (status === 'PARTIALLY_SIGNED') {
    return 'Частично подписан';
  }

  if (status === 'REJECTED') {
    return 'Отклонён';
  }

  if (status === 'CANCELLED') {
    return 'Отменён';
  }

  return 'Ожидает подписей';
}

function getDocumentStatusClassName(status: DocumentResponseDto['status']): string {
  if (status === 'FULLY_SIGNED') {
    return 'bg-emerald-500/15 text-emerald-200';
  }

  if (status === 'PARTIALLY_SIGNED') {
    return 'bg-sky-500/15 text-sky-200';
  }

  if (status === 'REJECTED') {
    return 'bg-red-500/15 text-red-200';
  }

  if (status === 'CANCELLED') {
    return 'bg-zinc-500/15 text-zinc-300';
  }

  return 'bg-amber-500/15 text-amber-100';
}

function getSignerStatusLabel(status: string): string {
  if (status === 'SIGNED') {
    return 'подписал';
  }

  if (status === 'REJECTED') {
    return 'отклонил';
  }

  return 'ожидается';
}

type AccountPickerProps = {
  title: string;
  hint: string;
  selectedAccountIds: string[];
  disabledAccountIds?: string[];
  contactAccountIds: string[];
  profilesById: Record<string, ProfileResponseDto>;
  onToggle: (accountId: string) => void;
};

function AccountPicker({
  title,
  hint,
  selectedAccountIds,
  disabledAccountIds = [],
  contactAccountIds,
  profilesById,
  onToggle,
}: AccountPickerProps) {
  const [query, setQuery] = useState('');
  const [searchedProfiles, setSearchedProfiles] = useState<ProfileResponseDto[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const disabledAccountIdSet = useMemo(() => new Set(disabledAccountIds), [disabledAccountIds]);

  useEffect(() => {
    const trimmedQuery = query.trim();
    let isCancelled = false;

    if (trimmedQuery.length < 2) {
      setSearchedProfiles([]);
      setIsSearching(false);
      return;
    }

    async function loadProfiles() {
      setIsSearching(true);

      try {
        const profiles = await searchProfiles(trimmedQuery);

        if (!isCancelled) {
          setSearchedProfiles(profiles);
        }
      }
      catch (error) {
        console.warn(error);

        if (!isCancelled) {
          setSearchedProfiles([]);
        }
      }
      finally {
        if (!isCancelled) {
          setIsSearching(false);
        }
      }
    }

    const timeoutId = window.setTimeout(loadProfiles, 250);

    return () => {
      isCancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [query]);

  const mergedProfilesById = useMemo(() => {
    const nextProfilesById = { ...profilesById };

    searchedProfiles.forEach((profile) => {
      nextProfilesById[profile.accountId] = profile;
    });

    return nextProfilesById;
  }, [profilesById, searchedProfiles]);

  const accountIds = useMemo(() => {
    const nextAccountIds = new Set<string>();

    contactAccountIds.forEach((accountId) => nextAccountIds.add(accountId));
    selectedAccountIds.forEach((accountId) => nextAccountIds.add(accountId));
    searchedProfiles.forEach((profile) => nextAccountIds.add(profile.accountId));

    return Array.from(nextAccountIds);
  }, [contactAccountIds, searchedProfiles, selectedAccountIds]);

  return (
    <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.035] p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-zinc-100">{title}</div>
          <div className="mt-1 text-xs text-zinc-500">{hint}</div>
        </div>
        <div className="rounded-full bg-white/[0.06] px-3 py-1 text-xs text-zinc-400">{selectedAccountIds.length}</div>
      </div>

      <div className="mt-4 flex items-center gap-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
        <Search size={17} className="text-zinc-500" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="w-full bg-transparent text-sm text-zinc-100 outline-none placeholder:text-zinc-600"
          placeholder="Найти сотрудника по имени, логину или email"
        />
        {isSearching && <LoaderCircle size={16} className="animate-spin text-zinc-500" />}
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {accountIds.map((accountId) => {
          const profile = mergedProfilesById[accountId];
          const isSelected = selectedAccountIds.includes(accountId);
          const isDisabled = disabledAccountIdSet.has(accountId);

          return (
            <button
              key={accountId}
              type="button"
              onClick={() => !isDisabled && onToggle(accountId)}
              disabled={isDisabled}
              className={`flex items-center gap-3 rounded-2xl border px-3 py-3 text-left transition ${isSelected ? 'border-violet-300/35 bg-violet-500/15' : 'border-white/10 bg-white/[0.025] hover:bg-white/[0.055]'} disabled:cursor-not-allowed disabled:opacity-45`}
            >
              <UserAvatar label={getAccountDisplayName(accountId, mergedProfilesById)} imageUrl={getAccountAvatarUrl(profile)} size="sm" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-zinc-100">{getAccountDisplayName(accountId, mergedProfilesById)}</span>
                <span className="block truncate text-xs text-zinc-500">{getAccountUsernameLabel(accountId, mergedProfilesById)}</span>
              </span>
              <span className={`h-4 w-4 rounded-full border ${isSelected ? 'border-violet-200 bg-violet-300' : 'border-white/20'}`} />
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function DocumentCreationModal({
  file,
  currentAccountId,
  profilesById,
  contactAccountIds,
  onClose,
  onConfirm,
}: {
  file: File | null;
  currentAccountId: string | undefined;
  profilesById: Record<string, ProfileResponseDto>;
  contactAccountIds: string[];
  onClose: () => void;
  onConfirm: (draft: DocumentCreationDraft) => Promise<void>;
}) {
  const [title, setTitle] = useState(file?.name ?? '');
  const [description, setDescription] = useState('');
  const [selectedSignerAccountIds, setSelectedSignerAccountIds] = useState<string[]>([]);
  const [selectedObserverAccountIds, setSelectedObserverAccountIds] = useState<string[]>([]);

  useEffect(() => {
    setTitle(file?.name ?? '');
    setDescription('');
    setSelectedSignerAccountIds(currentAccountId ? [currentAccountId] : []);
    setSelectedObserverAccountIds([]);
  }, [currentAccountId, file]);

  if (!file) {
    return null;
  }

  function toggleSigner(accountId: string) {
    setSelectedSignerAccountIds((previousAccountIds) => previousAccountIds.includes(accountId)
      ? previousAccountIds.filter((previousAccountId) => previousAccountId !== accountId)
      : [...previousAccountIds, accountId]);
    setSelectedObserverAccountIds((previousAccountIds) => previousAccountIds.filter((previousAccountId) => previousAccountId !== accountId));
  }

  function toggleObserver(accountId: string) {
    setSelectedObserverAccountIds((previousAccountIds) => previousAccountIds.includes(accountId)
      ? previousAccountIds.filter((previousAccountId) => previousAccountId !== accountId)
      : [...previousAccountIds, accountId]);
  }

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/55 p-4 backdrop-blur-md">
      <div className="flex max-h-[88vh] w-full max-w-4xl flex-col overflow-hidden rounded-[2rem] border border-white/10 bg-[#151721] shadow-2xl shadow-black/60">
        <div className="border-b border-white/10 p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-xl font-semibold text-zinc-50">Создание документа</div>
              <div className="mt-1 text-sm text-zinc-500">Документ создаётся в общем workspace и доступен автору, подписантам и наблюдателям.</div>
            </div>
            <button onClick={onClose} className="rounded-2xl border border-white/10 bg-white/[0.04] p-2 text-zinc-400 transition hover:text-zinc-100">
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-6">
          <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.035] p-4">
            <div className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500">Файл</div>
            <div className="mt-3 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-500/15 text-violet-200">
                <FileText size={21} />
              </div>
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-zinc-100">{file.name}</div>
                <div className="mt-1 text-xs text-zinc-500">{formatFileSize(file.size)} • {file.type || 'application/octet-stream'}</div>
              </div>
            </div>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500">Название</span>
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                className="mt-2 w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-violet-300/40"
                placeholder="Например: Договор поставки"
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500">Описание</span>
              <input
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                className="mt-2 w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-violet-300/40"
                placeholder="Краткий контекст для участников процесса"
              />
            </label>
          </div>

          <div className="mt-5 grid gap-4 xl:grid-cols-2">
            <AccountPicker
              title="Подписанты"
              hint="Сначала показаны ваши direct-контакты, поиск нужен для сотрудников вне чатов."
              selectedAccountIds={selectedSignerAccountIds}
              contactAccountIds={contactAccountIds}
              profilesById={profilesById}
              onToggle={toggleSigner}
            />
            <AccountPicker
              title="Наблюдатели"
              hint="Видят документ и статусы, но не могут подписывать или отклонять."
              selectedAccountIds={selectedObserverAccountIds}
              disabledAccountIds={selectedSignerAccountIds}
              contactAccountIds={contactAccountIds}
              profilesById={profilesById}
              onToggle={toggleObserver}
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-white/10 p-5">
          <button onClick={onClose} className="rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-2.5 text-sm text-zinc-300 transition hover:text-white">
            Отмена
          </button>
          <button
            onClick={() => void onConfirm({ file, title, description, requiredSignerAccountIds: selectedSignerAccountIds, observerAccountIds: selectedObserverAccountIds })}
            disabled={!title.trim() || selectedSignerAccountIds.length === 0}
            className="rounded-2xl bg-violet-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-950/30 transition hover:bg-violet-400 disabled:cursor-not-allowed disabled:opacity-45"
          >
            Создать документ
          </button>
        </div>
      </div>
    </div>
  );
}

export function DocumentsPanel({
  isOpen,
  documents,
  isLoading,
  activeAccountId,
  profilesById,
  contactAccountIds,
  onClose,
  onRefresh,
  onCreateDocument,
  onDownload,
  onSign,
  onReject,
  onCancel,
  onHide,
  onVerifyFile,
  onAddObservers,
}: {
  isOpen: boolean;
  documents: DocumentResponseDto[];
  isLoading: boolean;
  activeAccountId: string | undefined;
  profilesById: Record<string, ProfileResponseDto>;
  contactAccountIds: string[];
  onClose: () => void;
  onRefresh: () => Promise<void>;
  onCreateDocument: (file: File | null | undefined) => void;
  onDownload: (document: DocumentResponseDto) => Promise<void>;
  onSign: (document: DocumentResponseDto) => Promise<void>;
  onReject: (document: DocumentResponseDto, reason: string | null) => Promise<void>;
  onCancel: (document: DocumentResponseDto, reason: string | null) => Promise<void>;
  onHide?: (document: DocumentResponseDto) => Promise<void>;
  onVerifyFile?: (file: File) => Promise<DocumentResponseDto | null>;
  onAddObservers?: (document: DocumentResponseDto, observerAccountIds: string[]) => Promise<void>;
}) {
  const [rejectingDocument, setRejectingDocument] = useState<DocumentResponseDto | null>(null);
  const [cancellingDocument, setCancellingDocument] = useState<DocumentResponseDto | null>(null);
  const [observerTargetDocument, setObserverTargetDocument] = useState<DocumentResponseDto | null>(null);
  const [selectedObserverAccountIds, setSelectedObserverAccountIds] = useState<string[]>([]);
  const [workflowReason, setWorkflowReason] = useState('');

  if (!isOpen) {
    return null;
  }

  async function submitReject() {
    if (!rejectingDocument) {
      return;
    }

    await onReject(rejectingDocument, workflowReason.trim() || null);
    setRejectingDocument(null);
    setWorkflowReason('');
  }

  async function submitCancel() {
    if (!cancellingDocument) {
      return;
    }

    await onCancel(cancellingDocument, workflowReason.trim() || null);
    setCancellingDocument(null);
    setWorkflowReason('');
  }

  async function submitObservers() {
    if (!observerTargetDocument || !onAddObservers || selectedObserverAccountIds.length === 0) {
      return;
    }

    await onAddObservers(observerTargetDocument, selectedObserverAccountIds);
    setObserverTargetDocument(null);
    setSelectedObserverAccountIds([]);
  }

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm">
      <div className="flex max-h-[86vh] w-full max-w-6xl flex-col rounded-[2rem] border border-white/10 bg-[#18191d] shadow-2xl shadow-black/50">
        <div className="flex items-center justify-between gap-4 border-b border-white/10 p-6">
          <div>
            <div className="text-xl font-semibold text-zinc-50">Документооборот</div>
            <div className="mt-1 text-sm text-zinc-500">Единый workspace документов, подписей, наблюдателей и проверки оригинальности файла.</div>
          </div>
          <div className="flex items-center gap-2">
            <label className="rounded-2xl bg-violet-500 px-4 py-2 text-xs font-semibold text-white transition hover:bg-violet-400">
              Создать документ
              <input type="file" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ''; if (file) { onCreateDocument(file); } }} />
            </label>
            {onVerifyFile && (
              <label className="rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-zinc-300 transition hover:text-zinc-100">
                Проверить файл
                <input type="file" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ''; if (file) { void onVerifyFile(file); } }} />
              </label>
            )}
            <button onClick={() => void onRefresh()} className="rounded-2xl border border-white/10 bg-white/[0.04] p-2 text-zinc-400 transition hover:text-zinc-100" title="Обновить">
              <RefreshCw size={18} />
            </button>
            <button onClick={onClose} className="rounded-2xl border border-white/10 bg-white/[0.04] p-2 text-zinc-400 transition hover:text-zinc-100" title="Закрыть">
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {isLoading ? (
            <div className="flex items-center justify-center gap-3 rounded-[1.7rem] border border-white/10 bg-white/[0.03] p-8 text-sm text-zinc-400">
              <LoaderCircle size={18} className="animate-spin" />
              Загружаем документы…
            </div>
          ) : documents.length === 0 ? (
            <div className="rounded-[1.7rem] border border-dashed border-white/10 bg-white/[0.02] p-8 text-center text-sm text-zinc-500">
              В workspace пока нет документов. Создайте первый документ и назначьте подписантов.
            </div>
          ) : (
            <div className="space-y-4">
              {documents.map((documentItem) => {
                const signers = documentItem.signers ?? [];
                const observers = documentItem.observers ?? [];
                const signatures = documentItem.signatures ?? [];
                const signedCount = signers.filter((signer) => signer.status === 'SIGNED').length || signatures.length;
                const totalSignerCount = Math.max(signers.length, signatures.length);
                const currentSigner = signers.find((signer) => signer.signerAccountId === activeAccountId);
                const canSign = Boolean(currentSigner && currentSigner.status === 'PENDING' && !['REJECTED', 'CANCELLED', 'FULLY_SIGNED'].includes(documentItem.status));
                const canReject = canSign;
                const canCancel = Boolean(activeAccountId && activeAccountId === documentItem.ownerAccountId && !['FULLY_SIGNED', 'REJECTED', 'CANCELLED'].includes(documentItem.status));
                const canAddObservers = Boolean(activeAccountId && activeAccountId === documentItem.ownerAccountId && !['CANCELLED'].includes(documentItem.status));

                return (
                  <div key={documentItem.documentId} className="rounded-[1.7rem] border border-white/10 bg-white/[0.035] p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="truncate text-base font-semibold text-zinc-100">{documentItem.title || documentItem.fileName}</div>
                        <div className="mt-1 text-xs text-zinc-500">
                          Файл: {documentItem.fileName} • {formatFileSize(documentItem.sizeBytes)} • {documentItem.mimeType}
                        </div>
                        {documentItem.description && <div className="mt-3 text-sm leading-6 text-zinc-400">{documentItem.description}</div>}
                        <div className="mt-3 flex items-center gap-2 text-xs text-zinc-600"><ShieldCheck size={14} /> SHA-256: {documentItem.plaintextSha256Base64.slice(0, 24)}…</div>
                      </div>
                      <div className={`shrink-0 rounded-full px-3 py-1 text-xs ${getDocumentStatusClassName(documentItem.status)}`}>
                        {getDocumentStatusLabel(documentItem.status)} · {signedCount}/{totalSignerCount || '—'}
                      </div>
                    </div>

                    <div className="mt-4 grid gap-2 md:grid-cols-2">
                      {signers.map((signer) => {
                        const profile = profilesById[signer.signerAccountId];

                        return (
                          <div key={signer.signerId} className="rounded-2xl border border-white/10 bg-black/12 p-3">
                            <div className="flex items-center gap-3">
                              <UserAvatar label={getAccountDisplayName(signer.signerAccountId, profilesById)} imageUrl={getAccountAvatarUrl(profile)} size="sm" />
                              <div className="min-w-0 flex-1">
                                <div className="truncate text-sm font-medium text-zinc-100">{getAccountDisplayName(signer.signerAccountId, profilesById)}</div>
                                <div className="truncate text-xs text-zinc-500">{getSignerStatusLabel(signer.status)}{signer.signedAt ? ` · ${formatMessageTime(signer.signedAt)}` : ''}</div>
                              </div>
                              <div className={`rounded-full px-2 py-1 text-[11px] ${signer.status === 'SIGNED' ? 'bg-emerald-500/15 text-emerald-200' : signer.status === 'REJECTED' ? 'bg-red-500/15 text-red-200' : 'bg-amber-500/15 text-amber-100'}`}>
                                {signer.status === 'SIGNED' ? 'Подписан' : signer.status === 'REJECTED' ? 'Отказ' : 'Ждём'}
                              </div>
                            </div>
                            {signer.rejectionReason && <div className="mt-2 rounded-xl bg-red-500/10 px-3 py-2 text-xs text-red-100">{signer.rejectionReason}</div>}
                          </div>
                        );
                      })}
                    </div>

                    {observers.length > 0 && (
                      <div className="mt-4 rounded-2xl border border-white/10 bg-black/10 p-3">
                        <div className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">Наблюдатели</div>
                        <div className="flex flex-wrap gap-2">
                          {observers.map((observer) => {
                            const profile = profilesById[observer.observerAccountId];
                            return (
                              <div key={observer.observerId} className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] py-1 pl-1 pr-3 text-xs text-zinc-300">
                                <UserAvatar label={getAccountDisplayName(observer.observerAccountId, profilesById)} imageUrl={getAccountAvatarUrl(profile)} size="sm" />
                                {getAccountDisplayName(observer.observerAccountId, profilesById)}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {(documentItem.rejectionReason || documentItem.cancellationReason) && (
                      <div className="mt-4 rounded-2xl border border-red-300/15 bg-red-500/10 px-4 py-3 text-sm text-red-100">
                        {documentItem.rejectionReason || documentItem.cancellationReason}
                      </div>
                    )}

                    <div className="mt-4 flex flex-wrap gap-2">
                      <button onClick={() => void onDownload(documentItem)} className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-2 text-xs text-zinc-200 transition hover:bg-white/[0.08]">
                        <Download size={14} /> Скачать
                      </button>
                      <button onClick={() => void onSign(documentItem)} disabled={!canSign} className="rounded-2xl border border-emerald-300/20 bg-emerald-500/10 px-4 py-2 text-xs text-emerald-100 transition hover:bg-emerald-500/15 disabled:cursor-not-allowed disabled:opacity-45">
                        {currentSigner?.status === 'SIGNED' ? 'Подписано' : 'Подписать'}
                      </button>
                      <button onClick={() => { setRejectingDocument(documentItem); setWorkflowReason(''); }} disabled={!canReject} className="rounded-2xl border border-red-300/20 bg-red-500/10 px-4 py-2 text-xs text-red-100 transition hover:bg-red-500/15 disabled:cursor-not-allowed disabled:opacity-45">
                        Отклонить
                      </button>
                      <button onClick={() => { setCancellingDocument(documentItem); setWorkflowReason(''); }} disabled={!canCancel} className="rounded-2xl border border-zinc-300/15 bg-white/[0.04] px-4 py-2 text-xs text-zinc-300 transition hover:bg-white/[0.07] disabled:cursor-not-allowed disabled:opacity-45">
                        Отменить процесс
                      </button>
                      {onAddObservers && (
                        <button onClick={() => { setObserverTargetDocument(documentItem); setSelectedObserverAccountIds([]); }} disabled={!canAddObservers} className="inline-flex items-center gap-2 rounded-2xl border border-sky-300/15 bg-sky-500/10 px-4 py-2 text-xs text-sky-100 transition hover:bg-sky-500/15 disabled:cursor-not-allowed disabled:opacity-45">
                          <UserPlus size={14} /> Добавить наблюдателей
                        </button>
                      )}
                      {onHide && (
                        <button onClick={() => void onHide(documentItem)} disabled={canSign} className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-2 text-xs text-zinc-300 transition hover:bg-white/[0.07] disabled:cursor-not-allowed disabled:opacity-45">
                          Скрыть
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {(rejectingDocument || cancellingDocument) && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-[1.7rem] border border-white/10 bg-[#171923] p-5 shadow-2xl shadow-black/50">
            <div className="text-lg font-semibold text-zinc-50">{rejectingDocument ? 'Отклонить документ' : 'Отменить процесс'}</div>
            <div className="mt-2 text-sm leading-6 text-zinc-500">Укажите причину. Она будет видна участникам документооборота.</div>
            <textarea
              value={workflowReason}
              onChange={(event) => setWorkflowReason(event.target.value)}
              className="mt-4 min-h-28 w-full resize-none rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-violet-300/40"
              placeholder="Например: неверная версия документа"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => { setRejectingDocument(null); setCancellingDocument(null); setWorkflowReason(''); }} className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-zinc-300 transition hover:text-white">
                Назад
              </button>
              <button onClick={() => rejectingDocument ? void submitReject() : void submitCancel()} className="rounded-2xl bg-red-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-400">
                Подтвердить
              </button>
            </div>
          </div>
        </div>
      )}

      {observerTargetDocument && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="flex max-h-[80vh] w-full max-w-3xl flex-col overflow-hidden rounded-[1.7rem] border border-white/10 bg-[#171923] p-5 shadow-2xl shadow-black/50">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-lg font-semibold text-zinc-50">Добавить наблюдателей</div>
                <div className="mt-2 text-sm leading-6 text-zinc-500">Наблюдателей можно добавлять в любой момент. Они увидят документ, статусы и смогут скачать файл.</div>
              </div>
              <button onClick={() => setObserverTargetDocument(null)} className="rounded-2xl border border-white/10 bg-white/[0.04] p-2 text-zinc-400 transition hover:text-zinc-100"><X size={16} /></button>
            </div>
            <div className="mt-4 min-h-0 overflow-y-auto">
              <AccountPicker
                title="Новые наблюдатели"
                hint="Подписанты и уже добавленные наблюдатели исключены."
                selectedAccountIds={selectedObserverAccountIds}
                disabledAccountIds={[...(observerTargetDocument.signers ?? []).map((signer) => signer.signerAccountId), ...(observerTargetDocument.observers ?? []).map((observer) => observer.observerAccountId), observerTargetDocument.ownerAccountId]}
                contactAccountIds={contactAccountIds}
                profilesById={profilesById}
                onToggle={(accountId) => setSelectedObserverAccountIds((previousAccountIds) => previousAccountIds.includes(accountId) ? previousAccountIds.filter((previousAccountId) => previousAccountId !== accountId) : [...previousAccountIds, accountId])}
              />
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setObserverTargetDocument(null)} className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-zinc-300 transition hover:text-white">Назад</button>
              <button onClick={() => void submitObservers()} disabled={selectedObserverAccountIds.length === 0} className="inline-flex items-center gap-2 rounded-2xl bg-violet-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-violet-400 disabled:cursor-not-allowed disabled:opacity-45"><Plus size={16} /> Добавить</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
