export async function onRequest(context) {
  const { request, env } = context;

  // Only accept POST requests
  if (request.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  // Parse urlencoded body
  const contentType = request.headers.get('content-type') || '';
  if (!contentType.includes('application/x-www-form-urlencoded')) {
    return new Response('Unsupported Media Type', { status: 415 });
  }

  const formData = await request.text();
  const params = new URLSearchParams(formData);

  // if a value is filled, bail out quietly
  const honey = params.get('_honey');
  if (honey && honey.trim() !== '') {
    return new Response('OK', { status: 200 });
  }

  // Extract form fields
  const name = params.get('name') || '';
  const surname = params.get('surname') || '';
  const email = params.get('email') || '';
  const phone = params.get('phone-number') || '';
  const message = params.get('message') || '';
  const consent = params.get('consent') || 'Não especificado';

  // Build a mobile-friendly email body
  const emailBody = `
NOVO PEDIDO DE CONTACTO - Website
-----------------------------------------
NOME: ${name} ${surname}
E-MAIL: ${email}
TELEFONE: ${phone}
CONSENTIMENTO: ${consent}

MENSAGEM:
${message}
-----------------------------------------
Fim da mensagem.
  `;

  // Environment variables from Cloudflare
  const toEmail = env.TO_EMAIL;
  const fromEmail = env.FROM_EMAIL;
  const apiKey = env.RESEND_API_KEY;

  if (!apiKey || !toEmail || !fromEmail) {
    return new Response('Server misconfiguration', { status: 500 });
  }

  try {
    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from: fromEmail,
        to: toEmail,
        reply_to: email,
        subject: `Novo Contacto: ${name} ${surname}`,
        text: emailBody,
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      return new Response(`Failed to send email: ${errText}`, { status: 500 });
    }

    // Redirect to thanks page
    const redirectUrl = new URL('/thanks', request.url).toString();
    return Response.redirect(redirectUrl, 302);
    
  } catch (err) {
    return new Response(`Error sending email: ${err.message}`, { status: 500 });
  }
}