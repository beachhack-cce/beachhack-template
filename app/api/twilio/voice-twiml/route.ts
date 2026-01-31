function sanitizeForXml(input: string) {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

const DEFAULT_MESSAGE =
  'Alert from Paper Ai. Suspicious activity detected. Please check your dashboard.';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const raw = url.searchParams.get('message') ?? DEFAULT_MESSAGE;
  const message = sanitizeForXml(decodeURIComponent(raw));
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">${message}</Say>
</Response>`;
  return new Response(xml, {
    status: 200,
    headers: { 'Content-Type': 'text/xml' },
  });
}

export async function POST(req: Request) {
  // Twilio often posts application/x-www-form-urlencoded
  const contentType = req.headers.get('content-type') || '';
  let message = DEFAULT_MESSAGE;

  if (contentType.includes('application/x-www-form-urlencoded')) {
    const bodyText = await req.text();
    const params = new URLSearchParams(bodyText);
    const raw = params.get('message') ?? params.get('Message') ?? DEFAULT_MESSAGE;
    message = sanitizeForXml(decodeURIComponent(raw));
  } else {
    // fallback to query param or default
    const url = new URL(req.url);
    const raw = url.searchParams.get('message') ?? DEFAULT_MESSAGE;
    message = sanitizeForXml(decodeURIComponent(raw));
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">${message}</Say>
</Response>`;

  return new Response(xml, {
    status: 200,
    headers: { 'Content-Type': 'text/xml' },
  });
}
