import { useEffect, useMemo, useState } from 'react';
import { Download, FileText, LoaderCircle, RefreshCw, Search, User, X } from 'lucide-react';
import { searchProfiles } from '../../directory/api/profilesApi';
import { formatFileSize } from '../../media/lib/fileCrypto';
import { formatMessageTime } from '../../../shared/lib/dateFormat';
import { getAccountDisplayName, getAccountUsernameLabel } from '../../../shared/lib/profile';
import type { ChatResponseDto, DocumentResponseDto, ProfileResponseDto } from '../../../shared/types/api';
import { Avatar, getAccountAvatarUrl, getActiveGroupParticipantAccountIds, type DocumentCreationDraft, UserAvatar } from '../../messenger/lib/messengerCore';

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

export function DocumentCreationModal({
  file,
  selectedChat,
  currentAccountId,
  profilesById,
  onClose,
  onConfirm,
}: {
  file: File | null;
  selectedChat: ChatResponseDto | null;
  currentAccountId: string | undefined;
  profilesById: Record<string, ProfileResponseDto>;
  onClose: () => void;
  onConfirm: (draft: DocumentCreationDraft) => Promise<void>;
}) {
  const chatSignerOptions = useMemo(() => getActiveGroupParticipantAccountIds(selectedChat), [selectedChat]);
  const [title, setTitle] = useState(file?.name ?? '');
  const [description, setDescription] = useState('');
  const [selectedSignerAccountIds, setSelectedSignerAccountIds] = useState<string[]>([]);
  const [signerSearchQuery, setSignerSearchQuery] = useState('');
  const [searchedProfiles, setSearchedProfiles] = useState<ProfileResponseDto[]>([]);
  const [isSearchingSigners, setIsSearchingSigners] = useState(false);

  useEffect(() => {
    setTitle(file?.name ?? '');
    setDescription('');
    setSelectedSignerAccountIds(currentAccountId ? [currentAccountId] : []);
    setSignerSearchQuery('');
    setSearchedProfiles([]);
  }, [currentAccountId, file]);

  useEffect(() => {
    const trimmedQuery = signerSearchQuery.trim();
    let isCancelled = false;

    if (trimmedQuery.length < 2) {
      setSearchedProfiles([]);
      setIsSearchingSigners(false);
      return;
    }

    async function loadSignerSearchResults() {
      setIsSearchingSigners(true);

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
          setIsSearchingSigners(false);
        }
      }
    }

    const timeoutId = window.setTimeout(loadSignerSearchResults, 250);

    return () => {
      isCancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [signerSearchQuery]);

  const signerOptions = useMemo(() => {
    const accountIds = new Set<string>();

    chatSignerOptions.forEach((accountId) => accountIds.add(accountId));
    selectedSignerAccountIds.forEach((accountId) => accountIds.add(accountId));
    searchedProfiles.forEach((profile) => accountIds.add(profile.accountId));

    return Array.from(accountIds);
  }, [chatSignerOptions, searchedProfiles, selectedSignerAccountIds]);

  const mergedProfilesById = useMemo(() => {
    const nextProfilesById = { ...profilesById };

    searchedProfiles.forEach((profile) => {
      nextProfilesById[profile.accountId] = profile;
    });

    return nextProfilesById;
  }, [profilesById, searchedProfiles]);

  if (!file || !selectedChat) {
    return null;
  }

  function toggleSigner(accountId: string) {
    setSelectedSignerAccountIds((previousSignerAccountIds) => previousSignerAccountIds.includes(accountId)
      ? previousSignerAccountIds.filter((previousSignerAccountId) => previousSignerAccountId !== accountId)
      : [...previousSignerAccountIds, accountId]);
  }

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/55 p-4 backdrop-blur-md">
      <div className="flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-[2rem] border border-white/10 bg-[#151721] shadow-2xl shadow-black/60">
        <div className="border-b border-white/10 p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-xl font-semibold text-zinc-50">Создание документа</div>
              <div className="mt-1 text-sm text-zinc-500">Добавьте файл, описание и сотрудников, от которых нужна подпись.</div>
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
                placeholder="Краткий контекст для подписантов"
              />
            </label>
          </div>

          <div className="mt-5 rounded-[1.5rem] border border-white/10 bg-white/[0.035] p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-zinc-100">Кто должен подписать</div>
                <div className="mt-1 text-xs text-zinc-500">Можно выбрать себя, участников чата или найти сотрудника поиском.</div>
              </div>
              <div className="rounded-full bg-white/[0.06] px-3 py-1 text-xs text-zinc-400">{selectedSignerAccountIds.length}</div>
            </div>

            <div className="mt-4 flex items-center gap-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
              <Search size={17} className="text-zinc-500" />
              <input
                value={signerSearchQuery}
                onChange={(event) => setSignerSearchQuery(event.target.value)}
                className="w-full bg-transparent text-sm text-zinc-100 outline-none placeholder:text-zinc-600"
                placeholder="Найти сотрудника по имени, логину или email"
              />
              {isSearchingSigners && <LoaderCircle size={16} className="animate-spin text-zinc-500" />}
            </div>

            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {signerOptions.map((accountId) => {
                const profile = mergedProfilesById[accountId];
                const isSelected = selectedSignerAccountIds.includes(accountId);

                return (
                  <button
                    key={accountId}
                    type="button"
                    onClick={() => toggleSigner(accountId)}
                    className={`flex items-center gap-3 rounded-2xl border px-3 py-3 text-left transition ${isSelected ? 'border-violet-300/35 bg-violet-500/15' : 'border-white/10 bg-white/[0.025] hover:bg-white/[0.055]'}`}
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
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-white/10 p-5">
          <button onClick={onClose} className="rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-2.5 text-sm text-zinc-300 transition hover:text-white">
            Отмена
          </button>
          <button
            onClick={() => void onConfirm({ file, title, description, requiredSignerAccountIds: selectedSignerAccountIds, observerAccountIds: [] })}
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
  onClose,
  onRefresh,
  onDownload,
  onSign,
  onReject,
  onCancel,
  onHide,
  onVerifyFile,
}: {
  isOpen: boolean;
  documents: DocumentResponseDto[];
  isLoading: boolean;
  activeAccountId: string | undefined;
  profilesById: Record<string, ProfileResponseDto>;
  onClose: () => void;
  onRefresh: () => Promise<void>;
  onDownload: (document: DocumentResponseDto) => Promise<void>;
  onSign: (document: DocumentResponseDto) => Promise<void>;
  onReject: (document: DocumentResponseDto, reason: string | null) => Promise<void>;
  onCancel: (document: DocumentResponseDto, reason: string | null) => Promise<void>;
  onHide?: (document: DocumentResponseDto) => Promise<void>;
  onVerifyFile?: (file: File) => Promise<DocumentResponseDto | null>;
}) {
  const [rejectingDocument, setRejectingDocument] = useState<DocumentResponseDto | null>(null);
  const [cancellingDocument, setCancellingDocument] = useState<DocumentResponseDto | null>(null);
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

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm">
      <div className="flex max-h-[86vh] w-full max-w-5xl flex-col rounded-[2rem] border border-white/10 bg-[#18191d] shadow-2xl shadow-black/50">
        <div className="flex items-center justify-between gap-4 border-b border-white/10 p-6">
          <div>
            <div className="text-xl font-semibold text-zinc-50">Документооборот</div>
            <div className="mt-1 text-sm text-zinc-500">Документы чата, обязательные подписанты, статусы согласования и проверяемые цифровые подписи.</div>
          </div>
          <div className="flex items-center gap-2">
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
              В этом чате пока нет документов. Создайте документ через скрепку и выберите подписантов.
            </div>
          ) : (
            <div className="space-y-4">
              {documents.map((documentItem) => {
                const signers = documentItem.signers ?? [];
                const signatures = documentItem.signatures ?? [];
                const signedCount = signers.filter((signer) => signer.status === 'SIGNED').length || signatures.length;
                const totalSignerCount = Math.max(signers.length, signatures.length);
                const currentSigner = signers.find((signer) => signer.signerAccountId === activeAccountId);
                const canSign = Boolean(currentSigner && currentSigner.status === 'PENDING' && !['REJECTED', 'CANCELLED', 'FULLY_SIGNED'].includes(documentItem.status));
                const canReject = canSign;
                const canCancel = Boolean(activeAccountId && activeAccountId === documentItem.ownerAccountId && !['FULLY_SIGNED', 'REJECTED', 'CANCELLED'].includes(documentItem.status));

                return (
                  <div key={documentItem.documentId} className="rounded-[1.7rem] border border-white/10 bg-white/[0.035] p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="truncate text-base font-semibold text-zinc-100">{documentItem.title || documentItem.fileName}</div>
                        <div className="mt-1 text-xs text-zinc-500">
                          Файл: {documentItem.fileName} • {formatFileSize(documentItem.sizeBytes)} • {documentItem.mimeType}
                        </div>
                        {documentItem.description && <div className="mt-3 text-sm leading-6 text-zinc-400">{documentItem.description}</div>}
                        <div className="mt-3 text-xs text-zinc-600">SHA-256: {documentItem.plaintextSha256Base64.slice(0, 24)}…</div>
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

                    {(documentItem.rejectionReason || documentItem.cancellationReason) && (
                      <div className="mt-4 rounded-2xl border border-red-300/15 bg-red-500/10 px-4 py-3 text-sm text-red-100">
                        {documentItem.rejectionReason || documentItem.cancellationReason}
                      </div>
                    )}

                    <div className="mt-4 flex flex-wrap gap-2">
                      <button onClick={() => void onDownload(documentItem)} className="rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-2 text-xs text-zinc-200 transition hover:bg-white/[0.08]">
                        Скачать
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
    </div>
  );
}

