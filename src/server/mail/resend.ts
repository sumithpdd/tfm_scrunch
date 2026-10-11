import "server-only";
import { Resend } from "resend";
import { SITE } from "@/lib/site-config";

export type BoothEmailAttachment = {
  filename: string;
  content: Buffer;
  contentType: string;
};

export function emailFromAddress(): string | null {
  const raw = process.env.EMAIL_FROM?.trim();
  if (!raw) return null;
  if (raw.includes("<") && raw.includes(">")) return raw;
  return `${SITE.companyName} + ${SITE.productName} <${raw}>`;
}

export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY?.trim() && process.env.EMAIL_FROM?.trim());
}

function resendErrorMessage(error: { message?: string; name?: string } | null): string {
  const message = error?.message?.trim() || "Resend could not send the email.";
  if (/not verified|domain is not|invalid from/i.test(message)) {
    return `${message} EMAIL_FROM must be a verified Resend sender.`;
  }
  return message;
}

export async function sendBoothEmail(input: {
  to: string;
  cc?: string[];
  replyTo?: string;
  subject: string;
  html: string;
  attachments: BoothEmailAttachment[];
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = emailFromAddress();
  if (!apiKey || !from) {
    throw new Error("Email sending is not configured yet (RESEND_API_KEY and EMAIL_FROM).");
  }

  const cc = [...new Set((input.cc ?? []).map((v) => v.trim().toLowerCase()).filter(Boolean))].filter(
    (addr) => addr !== input.to,
  );
  const replyTo = input.replyTo?.trim() || SITE.presenterEmail || undefined;

  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({
    from,
    to: input.to,
    ...(cc.length ? { cc } : {}),
    ...(replyTo ? { replyTo } : {}),
    subject: input.subject,
    html: input.html,
    attachments: input.attachments.map((file) => ({
      filename: file.filename,
      content: file.content,
      contentType: file.contentType,
    })),
  });

  if (error) throw new Error(resendErrorMessage(error));
}
