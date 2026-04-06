type EmailComposeParams = {
  to: string;
  subject: string;
  body?: string;
};

export function isMobileUserAgent(userAgent: string) {
  return /(android|iphone|ipad|ipod|mobile)/i.test(userAgent);
}

export function buildMailtoUrl({ to, subject, body }: EmailComposeParams) {
  const params = new URLSearchParams();
  params.set("subject", subject);
  if (body) {
    params.set("body", body);
  }

  const query = params.toString();
  return query ? `mailto:${to}?${query}` : `mailto:${to}`;
}

export function buildGmailWebComposeUrl({ to, subject, body }: EmailComposeParams) {
  const safeBody = body ?? "";
  return `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(to)}&su=${encodeURIComponent(
    subject
  )}&body=${encodeURIComponent(safeBody)}`;
}

export function pickEmailComposeHref(params: EmailComposeParams & { userAgent: string }) {
  if (isMobileUserAgent(params.userAgent)) {
    return buildMailtoUrl(params);
  }

  return buildGmailWebComposeUrl(params);
}
