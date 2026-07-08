export function getFriendlyAuthMessage(error: unknown, fallback: string) {
  if (!(error instanceof Error)) {
    return fallback;
  }

  const originalMessage = error.message.trim();
  const message = originalMessage.toLowerCase();

  if (originalMessage.startsWith("Agent account creation failed:")) {
    return originalMessage.replace(/^Agent account creation failed:\s*/i, "");
  }

  if (originalMessage.startsWith("Account creation failed:")) {
    return originalMessage.replace(/^Account creation failed:\s*/i, "");
  }

  if (
    message.includes("auth/invalid-credential") ||
    message.includes("auth/invalid-login-credentials") ||
    message.includes("invalid login credentials")
  ) {
    return "Incorrect email or password.";
  }

  if (message.includes("email not confirmed") || message.includes("email_not_confirmed") || message.includes("confirm your email")) {
    return "Please confirm your email before signing in.";
  }

  if (message.includes("auth/user-not-found") || message.includes("user not found")) {
    return "No account was found with that email.";
  }

  if (message.includes("auth/wrong-password")) {
    return "Incorrect email or password.";
  }

  if (
    message.includes("auth/email-already-in-use") ||
    message.includes("user already registered") ||
    message.includes("already exists")
  ) {
    return "An account with this email already exists. Please log in or reset your password.";
  }

  if (message.includes("auth/weak-password") || message.includes("password should be")) {
    return "Choose a stronger password with at least 6 characters.";
  }

  if (message.includes("auth/invalid-phone-number")) {
    return "Enter a valid phone number.";
  }

  if (message.includes("network")) {
    return "Network error. Check your connection and try again.";
  }

  if (message.includes("agents table is missing")) {
    return "Supabase setup is incomplete: agents table is missing or not initialized.";
  }

  if (message.includes("subscriptions table is missing")) {
    return "Supabase setup is incomplete: subscriptions table is missing or not initialized.";
  }

  if (message.includes("users table is missing")) {
    return "Supabase setup is incomplete: users table is missing or not initialized.";
  }

  if (message.includes("agent profile could not be created")) {
    return "Agent profile could not be created. Please try again.";
  }

  if (message.includes("subscription setup failed") || message.includes("subscription record could not be created")) {
    return "Agent subscription setup failed. Please try again.";
  }

  if (message.includes("violates foreign key constraint")) {
    return "Agent account setup is incomplete. Please try again.";
  }

  if (message.includes("missing") && message.includes("profile")) {
    return "Your account was found, but the profile is incomplete. Please contact support.";
  }

  return fallback;
}
