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

  // Spam detection function
  function isSpam(name, surname, email, phone, message) {
    const combined = `${name} ${surname} ${email} ${phone} ${message}`.toLowerCase();
    
    // Check for URLs (common in spam)
    if (/https?:\/\/|www\.|\.com\/|\.yt\/|t\.me|telegram|bit\.ly|short\.link/i.test(message)) {
      return true;
    }
    
    // Check for excessive links
    const linkCount = (message.match(/https?:\/\//g) || []).length;
    if (linkCount > 1) {
      return true;
    }
    
    // Check for common spam keywords (gambling, money, pills, etc.)
    const spamKeywords = [
      'jackpot', 'casino', 'bitcoin', 'crypto', 'forex',
      'viagra', 'cialis', 'pharma', 'prescription',
      'lottery', 'prize', 'winner', 'congratulations',
      'guaranteed', 'make money', 'earn cash', 'passive income',
      'click here', 'urgent action', 'act now', 'limited time',
      'dear sir', 'dear madam', 'dear friend',
      'nigerian prince', 'inheritance', 'refund'
    ];
    
    if (spamKeywords.some(keyword => combined.includes(keyword))) {
      return true;
    }
    
    // Check for suspicious name patterns (repeated words, numbers, too short)
    if (name.length < 2 || surname.length < 2) {
      return true;
    }
    
    const nameWords = name.toLowerCase().split(/\s+/);
    const surnameWords = surname.toLowerCase().split(/\s+/);
    
    // Same word repeated in name/surname
    if (nameWords.some(word => surnameWords.includes(word))) {
      return true;
    }
    
    // Repeated patterns (e.g., "RussellnogRussellnogNX")
    if (/(.{3,})\1/.test(name + surname)) {
      return true;
    }
    
    // Excessive numbers in name
    if ((name.match(/\d/g) || []).length > 2) {
      return true;
    }
    
    // Check for excessive capitalization (more than 60% CAPS)
    const messageLength = message.replace(/\s/g, '').length;
    const capsCount = (message.match(/[A-Z]/g) || []).length;
    if (messageLength > 20 && capsCount / messageLength > 0.6) {
      return true;
    }
    
    // Check for too-short or too-long message
    if (message.trim().length < 10 || message.trim().length > 5000) {
      return true;
    }
    
    // Check phone number validity (basic - should have some digits)
    if (!/\d/.test(phone) || phone.replace(/\D/g, '').length < 9) {
      return true;
    }
    
    // Email domain check - reject suspicious domains
    const suspiciousDomains = ['tempmail', 'throwaway', 'guerrillamail', '10minutemail', 'mailinator'];
    if (suspiciousDomains.some(domain => email.toLowerCase().includes(domain))) {
      return true;
    }
    
    return false;
  }

  // Check for spam and silently reject (don't reveal spam detection)
  if (isSpam(name, surname, email, phone, message)) {
    return new Response('OK', { status: 200 });
  }

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
    return new Response(null, { 
      status: 302,
      headers: {
        'Location': redirectUrl,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      }
    });
    
  } catch (err) {
    return new Response(`Error sending email: ${err.message}`, { status: 500 });
  }
}