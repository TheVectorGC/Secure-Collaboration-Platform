import { create } from 'zustand';
import type { ProfileResponseDto } from '../../../shared/types/api';

const DIRECTORY_STORAGE_KEY = 'vector.profileDirectory';

type DirectoryState = {
  profilesById: Record<string, ProfileResponseDto>;
  upsertProfiles: (profiles: ProfileResponseDto[]) => void;
  upsertProfile: (profile: ProfileResponseDto) => void;
};

function readProfiles(): Record<string, ProfileResponseDto> {
  const raw = localStorage.getItem(DIRECTORY_STORAGE_KEY);

  if (!raw) {
    return {};
  }

  try {
    return JSON.parse(raw) as Record<string, ProfileResponseDto>;
  }
  catch {
    return {};
  }
}

function persistProfiles(profilesById: Record<string, ProfileResponseDto>) {
  localStorage.setItem(DIRECTORY_STORAGE_KEY, JSON.stringify(profilesById));
}

export const useDirectoryStore = create<DirectoryState>((set) => ({
  profilesById: readProfiles(),

  upsertProfiles: (profiles) => set((state) => {
    const nextProfilesById = { ...state.profilesById };

    profiles.forEach((profile) => {
      nextProfilesById[profile.accountId] = profile;
    });

    persistProfiles(nextProfilesById);
    return { profilesById: nextProfilesById };
  }),

  upsertProfile: (profile) => set((state) => {
    const nextProfilesById = {
      ...state.profilesById,
      [profile.accountId]: profile,
    };

    persistProfiles(nextProfilesById);
    return { profilesById: nextProfilesById };
  }),
}));
