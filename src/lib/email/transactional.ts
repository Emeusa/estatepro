import "server-only";

import { SITE_NAME, getSiteUrl } from "@/lib/seo";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export type EmailEventType =
  | "welcome"
  | "agent_registration_received"
  | "agent_verification_approved"
  | "agent_verification_rejected"
  | "listing_active"
  | "listing_rejected"
  | "subscription_activated"
  | "subscription_failed"
  | "subscription_cancelled"
  | "admin_alert";

export type TransactionalEmailInput = {
  type: EmailEventType;
  to: string;
  subject: string;
  heading: string;
  body: string[];
  userId?: string | null;
  eventKey?: string | null;
  cta?: {
    label: string;
    href: string;
  };
  metadata?: Record<string, unknown>;
};

type EmailConfig = {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password: string;
  fromEmail: string;
  fromName: string;
};

function readEmailConfig(): EmailConfig | null {
  const host = process.env.ZOHO_SMTP_HOST?.trim() || "smtppro.zoho.com";
  const port = Number(process.env.ZOHO_SMTP_PORT ?? "465");
  const secure = (process.env.ZOHO_SMTP_SECURE ?? "true").toLowerCase() !== "false";
  const user = process.env.ZOHO_SMTP_USER?.trim();
  const password = process.env.ZOHO_SMTP_PASSWORD;
  const fromEmail = process.env.APP_EMAIL_FROM?.trim() || user;
  const fromName = process.env.APP_EMAIL_FROM_NAME?.trim() || SITE_NAME;

  if (!host || !port || !user || !password || !fromEmail) {
    return null;
  }

  return { host, port, secure, user, password, fromEmail, fromName };
}

export function isTransactionalEmailConfigured() {
  return readEmailConfig() !== null;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function buildText(input: TransactionalEmailInput) {
  const parts = [input.heading, "", ...input.body];
  if (input.cta) {
    parts.push("", `${input.cta.label}: ${input.cta.href}`);
  }
  parts.push("", `${SITE_NAME}`, getSiteUrl().toString());
  return parts.join("\n");
}

function buildHtml(input: TransactionalEmailInput) {
  const body = input.body
    .map((paragraph) => `<p style="margin:0 0 16px;color:#334155;line-height:1.65">${escapeHtml(paragraph)}</p>`)
    .join("");
  const cta = input.cta
    ? `<a href="${escapeHtml(input.cta.href)}" style="display:inline-block;margin-top:8px;border-radius:14px;background:#0f172a;color:#fff;text-decoration:none;font-weight:800;padding:13px 18px">${escapeHtml(input.cta.label)}</a>`
    : "";

  return `<!doctype html>
<html>
  <body style="margin:0;background:#f1f5f9;font-family:Arial,sans-serif">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f1f5f9;padding:32px 12px">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;border-radius:24px;background:#fff;overflow:hidden;border:1px solid #e2e8f0">
            <tr>
              <td style="background:#0f766e;padding:24px 28px;color:#fff">
                <p style="margin:0;font-size:13px;font-weight:800;letter-spacing:.16em;text-transform:uppercase">${SITE_NAME}</p>
              </td>
            </tr>
            <tr>
              <td style="padding:28px">
                <h1 style="margin:0 0 16px;color:#0f172a;font-size:24px;line-height:1.25">${escapeHtml(input.heading)}</h1>
                ${body}
                ${cta}
              </td>
            </tr>
            <tr>
              <td style="padding:18px 28px;background:#f8fafc;color:#64748b;font-size:12px;line-height:1.6">
                You are receiving this email because you have an account or activity on ${SITE_NAME}.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function emailEventsMissing(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }
  const message = error.message.toLowerCase();
  return message.includes("email_events") && (message.includes("does not exist") || message.includes("schema cache"));
}

async function findExistingEmailEvent(eventKey?: string | null) {
  if (!eventKey) {
    return null;
  }

  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("email_events")
    .select("id, status")
    .eq("event_key", eventKey)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data as { id: string; status: string } | null;
}

async function createEmailEvent(input: TransactionalEmailInput) {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("email_events")
    .insert({
      user_id: input.userId ?? null,
      event_key: input.eventKey ?? null,
      email_type: input.type,
      recipient_email: input.to,
      subject: input.subject,
      provider: "zoho",
      status: "pending",
      metadata: input.metadata ?? {}
    })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Could not create email event.");
  }

  return data.id as string;
}

async function updateEmailEvent(
  eventId: string | null,
  status: "sent" | "failed" | "skipped",
  error?: string
) {
  if (!eventId) {
    return;
  }

  const supabase = createServerSupabaseClient();
  await supabase
    .from("email_events")
    .update({
      status,
      error: error ? error.slice(0, 500) : null,
      sent_at: status === "sent" ? new Date().toISOString() : null,
      updated_at: new Date().toISOString()
    })
    .eq("id", eventId);
}

async function sendViaZoho(input: TransactionalEmailInput, config: EmailConfig) {
  const nodemailer = await import("nodemailer");
  const transporter = nodemailer.default.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: {
      user: config.user,
      pass: config.password
    }
  });

  await transporter.sendMail({
    from: `"${config.fromName}" <${config.fromEmail}>`,
    to: input.to,
    subject: input.subject,
    text: buildText(input),
    html: buildHtml(input)
  });
}

export async function sendTransactionalEmail(input: TransactionalEmailInput) {
  let eventId: string | null = null;

  try {
    const existing = await findExistingEmailEvent(input.eventKey);
    if (existing?.status === "sent" || existing?.status === "skipped" || existing?.status === "pending") {
      return { status: "skipped" as const };
    }

    eventId = existing?.id ?? (await createEmailEvent(input));
  } catch (error) {
    if (emailEventsMissing(error)) {
      return { status: "skipped" as const };
    }
    console.error("Email event logging failed", error);
  }

  const config = readEmailConfig();
  if (!config) {
    await updateEmailEvent(eventId, "skipped", "Transactional email is not configured.");
    return { status: "skipped" as const };
  }

  try {
    await sendViaZoho(input, config);
    await updateEmailEvent(eventId, "sent");
    return { status: "sent" as const };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Email send failed.";
    await updateEmailEvent(eventId, "failed", message);
    console.error("Transactional email failed", {
      type: input.type,
      userId: input.userId,
      eventKey: input.eventKey,
      error: message
    });
    return { status: "failed" as const };
  }
}
