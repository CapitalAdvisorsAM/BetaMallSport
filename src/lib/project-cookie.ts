import { cookies } from "next/headers";

const COOKIE_NAME = "selectedProjectId";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

export function getSelectedProjectCookie(): string | undefined {
  const value = cookies().get(COOKIE_NAME)?.value?.trim();
  return value || undefined;
}

export function setSelectedProjectCookie(id: string): void {
  cookies().set(COOKIE_NAME, id, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_SECONDS
  });
}

export function clearSelectedProjectCookie(): void {
  cookies().delete(COOKIE_NAME);
}

export const SELECTED_PROJECT_COOKIE_NAME = COOKIE_NAME;
export const SELECTED_PROJECT_COOKIE_MAX_AGE = MAX_AGE_SECONDS;
