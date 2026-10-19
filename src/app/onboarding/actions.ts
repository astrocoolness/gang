'use server';

import { revalidatePath } from 'next/cache';
import { parseProfileInput, type FieldErrors, type ProfileInput } from '@/lib/clique/validate';
import { saveMyProfile } from '@/lib/clique/profiles';

export interface ProfileFormState {
  status: 'idle' | 'saved' | 'error';
  message?: string;
  errors?: FieldErrors;
  values?: ProfileInput;
}

export async function saveProfileAction(_prev: ProfileFormState, formData: FormData): Promise<ProfileFormState> {
  const { input, errors } = parseProfileInput(formData);
  if (Object.keys(errors).length) return { status: 'error', errors, values: input, message: 'Fix the highlighted fields.' };
  const res = await saveMyProfile(input);
  if (!res.ok) {
    return {
      status: 'error', values: input, message: res.error,
      errors: res.code === 'username_taken' ? { username: res.error } : undefined,
    };
  }
  revalidatePath('/onboarding');
  return { status: 'saved', values: input, message: 'Profile saved.' };
}
