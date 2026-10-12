export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
}

function layout(title: string, body: string, link: { url: string; label: string }): string {
  return `<!doctype html><html><body style="font-family:Inter,Arial,sans-serif;color:#0f172a;max-width:520px;margin:24px auto">
<h2 style="margin:0 0 16px">${title}</h2>
<p style="line-height:1.5">${body}</p>
<p><a href="${link.url}" style="display:inline-block;background:#2563eb;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none">${link.label}</a></p>
<p style="color:#64748b;font-size:13px">If the button doesn't work, open this link: ${link.url}</p>
</body></html>`;
}

export function passwordResetMail(to: string, appName: string, url: string): MailMessage {
  const body = `We received a request to reset your ${appName} password. The link works once and expires in 60 minutes. If you didn't ask for this, ignore this email.`;
  return {
    to,
    subject: `Reset your ${appName} password`,
    text: `${body}\n\n${url}`,
    html: layout('Reset your password', body, { url, label: 'Set new password' }),
  };
}

export function invitationMail(
  to: string,
  appName: string,
  companyName: string,
  url: string,
): MailMessage {
  const body = `${companyName} invited you to ${appName}. Set your password to get started. The link expires in 7 days.`;
  return {
    to,
    subject: `You're invited to ${appName}`,
    text: `${body}\n\n${url}`,
    html: layout(`Welcome to ${appName}`, body, { url, label: 'Set password' }),
  };
}
