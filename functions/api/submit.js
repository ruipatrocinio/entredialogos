export async function onRequest(context) {
  const { request, env } = context;

  // Only accept POST requests
  if (request.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 500 });
  }

  // parse urlencoded body
  const contentType = request.headers.get('content-type') || '';
  if (!contentType.includes('application/x-www-form-urlencoded')) {
    return new Response('Unsupported Media Type', { status: 500 });
  }

  const formData = await request.text();
  const params = new URLSearchParams(formData);

  const form_name = params.get('name') || '';
  const form_lastname = params.get('surname') || '';
  const form_email = params.get('email') || '';
  const form_phone = params.get('phone-number') || '';
  const form_message = params.get('message') || '';
  const form_check_input = params.get('consent') || '';

  // Build email payload
  const toEmail = env.TO_EMAIL;
  const fromEmail = env.FROM_EMAIL;
  const apiKey = env.RESEND_API_KEY;

  if (!apiKey || !toEmail || !fromEmail) {
    return new Response('Server misconfiguration', { status: 500 });
  }

  const emailBody = `Novo pedido de consulta:\n
Name: ${form_name} ${form_lastname}\nEmail: ${form_email}\nPhone: ${form_phone}\nChecked: ${form_check_input}\nMessage:\n${form_message}`;

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
        subject: 'PEDIDO DE CONTACTO',
        text: emailBody,
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      return new Response(`Failed to send email: ${errText}`, { status: 500 });
    }

    // redirect to thanks page
    const redirectUrl = new URL('/thanks', request.url).toString();
    return Response.redirect(redirectUrl, 302);
  } catch (err) {
    return new Response(`Error sending email: ${err.message}`, { status: 500 });
  }
}
