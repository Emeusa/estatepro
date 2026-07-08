export const CONFIRMATION_EMAIL_STORAGE_KEY = "c59_pending_confirmation_email";
export const CONFIRMATION_ACCOUNT_TYPE_STORAGE_KEY = "c59_pending_confirmation_type";
export const LOGIN_CONFIRMED_MESSAGE = "Email confirmed. You can now sign in.";

export type ConfirmationAccountType = "client" | "agent";

export function buildCheckEmailUrl(email: string, accountType: ConfirmationAccountType) {
  const params = new URLSearchParams({
    email: email.trim().toLowerCase(),
    type: accountType
  });
  return `/auth/check-email?${params.toString()}`;
}

export function getLoginConfirmationMessage(value: string | string[] | null | undefined) {
  const confirmedValue = Array.isArray(value) ? value[0] : value;
  return confirmedValue === "1" ? LOGIN_CONFIRMED_MESSAGE : null;
}
