export default {
  async fetch(request, env, ctx) {
    return handleRequest(request, env);
  }
}

async function getTurnstileConfig(env) {
  const result = await env.DB_PRIMARY.prepare(
    "SELECT DB_SETTING_NAME, SETTING_VALUE FROM Settings WHERE DB_SETTING_NAME IN (?, ?)"
  ).bind(
    'cf_turnstile_site_key',
    'cf_turnstile_secret_version'
  ).all();

  const settings = Object.fromEntries(
    result.results.map(row => [row.DB_SETTING_NAME, row.SETTING_VALUE])
  );

  const siteKey = settings['cf_turnstile_site_key'] || '';
  const secretName = settings['cf_turnstile_secret_version'] || '';
  const secret = secretName ? env[secretName] : '';

  return { siteKey, secret };
}

async function validateTurnstile(token, secret) {
  if (!token || !secret) {
    return false;
  }

  const formData = new FormData();
  formData.append('secret', secret);
  formData.append('response', token);

  const response = await fetch(
    'https://challenges.cloudflare.com/turnstile/v0/siteverify',
    {
      method: 'POST',
      body: formData
    }
  );

  if (!response.ok) {
    return false;
  }

  const result = await response.json();
  return result.success === true;
}

function getCookieValue(request, name) {
  const cookieHeader = request.headers.get('Cookie');
  if (!cookieHeader) return null;
  const cookies = cookieHeader.split(';').map(c => c.trim());
  for (const cookie of cookies) {
    const [key, value] = cookie.split('=');
    if (key === name) return value;
  }
  return null;
}

const imageHost = 'https://makenoskohappy-images.smithbits.io'

const images = {
  heroEraser: `${imageHost}/eraser.png`,
  noskoThumbsUp: `${imageHost}/nosko-thumbs-up.png`,
  makeNoskoHappy: `${imageHost}/make-nosko-happy.png`,
  noskoDisapoint: `${imageHost}/nosko-dissapoint.png`,
  noskoDoubleFist: `${imageHost}/nosko-double-fist.png`,
  noskoJoyJump: `${imageHost}/nosko-joy-jump.png`,
  noskoSad: `${imageHost}/nosko-sad.png`,
  noskoScared: `${imageHost}/nosko-scared.png`,
  pizza: `${imageHost}/pizza.png`,
  trash: `${imageHost}/trash.png`,
  noskoEat: `${imageHost}/nosko-eat.png`,
  noskoEatPlus1: `${imageHost}/nosko-eat-plus-1.png`,
  noskoEatPlus2: `${imageHost}/nosko-eat-plus-2.png`
};

const correctImages = [
  images.noskoJoyJump,
  images.noskoThumbsUp,
  images.noskoDoubleFist
];

const incorrectImages = [
  images.noskoSad,
  images.noskoDisapoint,
  images.noskoScared
];

function getRandomImage(isCorrect) {
  const pool = isCorrect ? correctImages : incorrectImages;
  const index = Math.floor(Math.random() * pool.length);
  return pool[index];
}

const knowledgeCheckData = {
  level_1_q1: {
    question: 'A customer reports, "Nobody at our company can log in!" Does this statement verify that nobody can log in?',
    answers: {
      a: { text: 'Yes' },
      b: { text: 'No', correct: true }
    },
    explanation: "Answer: No<br>The customer believes nobody can log in, but we haven't verified that ourselves. We need to test the behavior or examine evidence that confirms who is affected and what actually happens."
  },

  level_1_q2: {
    question: 'A customer reports, "Our automation isn\'t triggering when someone submits a form." Does this statement verify that the automation is failing?',
    answers: {
      a: { text: 'Yes' },
      b: { text: 'No', correct: true }
    },
    explanation: "Answer: No<br>The report describes what the customer believes is happening, not a verified failure. We need to check whether the form was submitted, whether the trigger conditions were met, and whether the automation ran."
  },

  level_2_q1: {
    question: 'A customer reports, "Several subscription payments failed yesterday with an invalid token error." Does this prove the issue started yesterday?',
    answers: {
      a: { text: 'Yes' },
      b: { text: 'No', correct: true }
    },
    explanation: "Answer: No<br>The customer noticed the failures yesterday, but the same issue may have existed earlier. Previous transactions or logs can help establish when the failures actually began."
  },

  level_2_q2: {
    question: "A customer reports that an online form stopped accepting submissions today. They provide a successful submission from this morning, and you test the same form and confirm it fails now. Does this verify the issue started today?",
    answers: {
      a: { text: 'Yes', correct: true },
      b: { text: 'No' }
    },
    explanation: "Answer: Yes<br>The successful submission verifies the form worked earlier today, and your test confirms it fails now. That places the change in behavior between those two verified events."
  },

  level_3_q1: {
    question: 'A customer provides a screenshot showing a generic "Something went wrong" error. It contains no URL, timestamp, request ID, or other identifying details. Can you use this screenshot alone to investigate the cause?',
    answers: {
      a: { text: 'Yes' },
      b: { text: 'No', correct: true }
    },
    explanation: "Answer: No<br>The screenshot verifies an error appeared, but contains nothing identifiable to trace through the system. Reproducing the error and inspecting the underlying requests or logs would provide something actionable."
  },

  level_3_q2: {
    question: "A customer reports that a contact's email address changed unexpectedly. They provide an example from 45 days ago, but your system only retains relevant logs for 30 days. Should you request a more recent example?",
    answers: {
      a: { text: 'Yes', correct: true },
      b: { text: 'No' }
    },
    explanation: "Answer: Yes<br>The older example may verify that the email address changed, but the logs needed to investigate the cause are no longer available. A recent example is more likely to provide activity that can be examined."
  },

  level_4_q1: {
    question: 'There\'s a known issue where users receive an "Access denied" error when connecting their Outlook calendars. A new customer reports that their calendar integration fails and displays an error. Does this confirm it\'s the same issue?',
    answers: {
      a: { text: 'Yes' },
      c: { text: 'No', correct: true }
    },
    explanation: "Answer: No<br>We haven't verified which calendar provider they're using or whether the error matches the known issue. Similar symptoms alone don't establish that the failures share a cause."
  },

  level_4_q2: {
    question: "A customer receives an error when saving a credit card. You find an earlier support case where another customer couldn't save cards because their payment processor credentials were incorrect. Does this confirm the new customer has the same problem?",
    answers: {
      a: { text: 'Yes' },
      b: { text: 'No', correct: true }
    },
    explanation: "Answer: No<br>Both customers experienced a similar failure, but that doesn't establish the same cause. The earlier case suggests a possibility worth checking, not a conclusion."
  },

  level_5_q1: {
    question: "A customer reports an error when saving a credit card. During troubleshooting, they explain how they use the reporting dashboard to track monthly sales. Should you include how they use the reporting dashboard in your technical escalation?",
    answers: {
      a: { text: 'Yes' },
      b: { text: 'No', correct: true }
    },
    explanation: "Answer: No<br>The reporting workflow doesn't help explain, reproduce, or investigate the credit card failure. Including unrelated details adds noise without helping the next person resolve the issue."
  },

  level_5_q2: {
    question: "A customer reports that a scheduled email campaign failed. They explain that the campaign normally runs successfully every day and provide records of previous successful runs. Should you include the history of successful campaigns in your technical escalation?",
    answers: {
      a: { text: 'Yes', correct: true },
      b: { text: 'No' }
    },
    explanation: "Answer: Yes<br>The previous successful runs establish expected behavior and provide evidence of when the campaign last worked. That information helps narrow the timeframe of the failure and is relevant to the investigation."
  }
};


const finalQuiz = [
  {
    id: "q1",
    question: "A customer reports that automations have stopped working since yesterday. Which information would be more useful to investigate the cause?",
    answers: {
      a: { text: "The customer confirms that three different automations failed yesterday" },
      b: { text: "Application logs show an automation execution error from 30 minutes ago", correct: true }
    }
  },
  {
    id: "q2",
    question: "A customer cannot schedule an appointment. You've been unable to reproduce the issue in your test environment. Which information would be more useful to include in an escalation?",
    answers: {
      a: { text: "A customer-provided video and HAR file showing the failure", correct: true },
      b: { text: "A detailed description of the troubleshooting steps you performed in your test environment" }
    }
  },
  {
    id: "q3",
    question: "A customer reports that their application isn't sending emails. They provide a screenshot of their inbox showing no new messages. Does this verify that the application failed to send the emails?",
    answers: {
      a: { text: "Yes" },
      b: { text: "No", correct: true }
    }
  },
  {
    id: "q4",
    question: "Two customers report errors when saving changes. In the application logs, one error says \"Unable to save record: Database connection timeout\" and the other says \"Unable to save record: Validation failed: invalid field value\". What should you conclude?",
    answers: {
      a: { text: "Both errors involve saving records, so they're likely related" },
      b: { text: "The issues should be investigated separately", correct: true }
    }
  },
  {
    id: "q5",
    question: "A customer reports their form stopped working last weekend. You can reproduce the issue today. When did the issue actually begin?",
    answers: {
      a: { text: "Before last weekend" },
      b: { text: "Last weekend" },
      c: { text: "There isn't enough information yet", correct: true }
    }
  },
  {
    id: "q6",
    question: "A customer is trying to log in to update customer records, but they're unable to access their account and see an error. Should you explain what the customer needed to update when escalating?",
    answers: {
      a: { text: "Yes" },
      b: { text: "No", correct: true }
    }
  },
  {
    id: "q7",
    question: "A customer reports that clicking the Save button produces an error. You reproduce the issue and see a failed request in Chrome DevTools. What should you do next?",
    answers: {
      a: { text: "Review the failed request in Chrome DevTools", correct: true },
      b: { text: "Check whether the customer has the correct permissions to save changes" },
      c: { text: "Try saving a different record to see whether the problem happens again" },
      d: { text: "Search previous support cases for similar errors" }
    }
  },
  {
    id: "q8",
    question: "There's a known issue where sending text messages manually fails with a \"Something went wrong error\". A new customer reports their automated text messages are not sending. What should you do?",
    answers: {
      a: { text: "Troubleshoot like it's a different new issue", correct: true },
      b: { text: "Tell the customer we have a known issue with sending text messages" }
    }
  },
  {
    id: "q9",
    question: "Which of these is more actionable?",
    answers: {
      a: { text: "A HAR file captured from a user who experienced the issue within the last hour", correct: true },
      b: { text: "All internal logs for the past 1 day because \"all users see a blank screen\"" }
    }
  },
  {
    id: "q10",
    question: "A customer reports they sometimes see a \"Too many redirects\" error when navigating in their account. You see the issue in their account as well. What is most helpful if you escalate this?",
    answers: {
      a: { text: "The customer tried different browsers, logged in and out, cleared cache and cookies, and tried a different computer" },
      b: { text: "A video and HAR file you recorded when you replicated it", correct: true }
    }
  }
];

async function verifyNoskoSession(request, secret) {
  const cookie = getCookieValue(request, 'nosko_session');
  if (!cookie || !secret) return false;

  const parts = cookie.split('.');
  if (parts.length !== 3) return false;

  const [sessionId, expiresText, signatureHex] = parts;
  const expires = Number(expiresText);

  if (
    !/^[0-9a-f-]{36}$/.test(sessionId) ||
    !Number.isSafeInteger(expires) ||
    expires <= Date.now() ||
    !/^[0-9a-f]{64}$/.test(signatureHex)
  ) {
    return false;
  }

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify']
  );

  const signature = Uint8Array.from(
    signatureHex.match(/.{2}/g),
    byte => parseInt(byte, 16)
  );

  return crypto.subtle.verify(
    'HMAC',
    key,
    signature,
    new TextEncoder().encode(sessionId + '.' + expiresText)
  );
}

async function requireAuth(request, env) {
  const { secret } = await getTurnstileConfig(env);
  const isVerified = await verifyNoskoSession(request, secret);

  if (!isVerified) {
    return Response.redirect(new URL('/home', request.url).toString(), 302);
  }

  return null;
}

async function handleRequest(request, env) {
  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/+/, '');

// Public endpoints that must work before a session exists
const PUBLIC_PATHS = new Set(['', 'home', 'verify-turnstile', 'start']);

if (!PUBLIC_PATHS.has(path)) {
  const authResponse = await requireAuth(request, env);
  if (authResponse) return authResponse;
}


  const errorParam = url.searchParams.get('error');
  var errorHtml = '';
  if (errorParam === '401') {
    errorHtml = '<div style="color: #f44; font-weight: bold; margin-bottom: 2rem;">Unauthenticated. Please login.</div>';
  }

  async function createNoskoSession(secret) {
  const expires = Date.now() + 24 * 60 * 60 * 1000;
  const sessionId = crypto.randomUUID();
  const payload = sessionId + '.' + expires;

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(payload)
  );

  const signatureHex = Array.from(new Uint8Array(signature))
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('');

  return payload + '.' + signatureHex;
}

async function verifyNoskoCookie(request, secret) {
  const cookie = getCookieValue(request, 'nosko_turnstile');
  if (!cookie || !secret) return false;

  const [expiresText, signatureHex] = cookie.split('.');
  const expires = Number(expiresText);

  if (!Number.isSafeInteger(expires) || expires <= Date.now()) {
    return false;
  }

  if (!/^[0-9a-f]{64}$/.test(signatureHex || '')) {
    return false;
  }

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify']
  );

  const signature = Uint8Array.from(
    signatureHex.match(/.{2}/g),
    byte => parseInt(byte, 16)
  );

  return crypto.subtle.verify(
    'HMAC',
    key,
    signature,
    new TextEncoder().encode(expiresText)
  );
}

if (path === 'start' && request.method === 'POST') {
    const { secret } = await getTurnstileConfig(env);
    const isVerified = await verifyNoskoCookie(request, secret);

  if (!isVerified) {
    return new Response('Unable to process your request. Please try again.', {
      status: 403
    });
  }

  const { firstName, lastName, honeypot } = await request.json();

  if (
    typeof firstName !== 'string' ||
    typeof lastName !== 'string' ||
    !firstName.trim() ||
    !lastName.trim() ||
    honeypot !== ''
  ) {
    return new Response('Unable to process your request. Please try again.', {
      status: 400
    });
  }

  const sessionToken = await createNoskoSession(secret);

  return new Response('OK', {
    status: 200,
    headers: {
      'Set-Cookie': 'nosko_session=' + sessionToken +
        '; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=86400',
      'Cache-Control': 'no-store'
    }
  });
}

if (path === 'verify-turnstile' && request.method === 'POST') {
  const formData = await request.formData();
  const token = formData.get('turnstile_token') || '';

  const { secret } = await getTurnstileConfig(env);
  const isValid = await validateTurnstile(token, secret);

  const headers = new Headers({
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store'
  });

  if (isValid) {
    const expires = Date.now() + 5 * 60 * 1000;

    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const signature = await crypto.subtle.sign(
      'HMAC',
      key,
      new TextEncoder().encode(String(expires))
    );

    const signatureHex = Array.from(new Uint8Array(signature))
      .map(byte => byte.toString(16).padStart(2, '0'))
      .join('');

    headers.set(
      'Set-Cookie',
      'nosko_turnstile=' + expires + '.' + signatureHex +
      '; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=300'
    );
  }

  return new Response(
    JSON.stringify({ success: isValid }),
    {
      status: isValid ? 200 : 403,
      headers
    }
  );
}

if (path === 'home' || path === '') {
  const { siteKey } = await getTurnstileConfig(env);

  const htmlHome = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Make Nosko Happy</title>
  <script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>
  <link rel="icon" href="${images.heroEraser}" type="image/png" />
  <style>
    body, html {
      height: auto;
      min-height: 100%;
      margin: 0;
      padding: 2rem;
      background: #222;
      color: white;
      font-family: sans-serif;
      display: flex;
      flex-direction: column;
      align-items: center;
      box-sizing: border-box;
    }

    body {
      width: 100%;
      max-width: 800px;
      margin: 0 auto;
    }

    body > h1,
    body > #message,
    body > #explanation {
      width: 100%;
      max-width: 800px;
      text-align: center;
    }
    img {
      max-width: 400px;
      width: 100%;
      height: auto;
      margin-bottom: 2rem;
    }
    input[type="text"] {
      padding: 0.75rem 1rem;
      font-size: 1.2rem;
      border-radius: 8px;
      border: none;
      margin-bottom: 1rem;
      width: 100%;
      max-width: 300px;
      box-sizing: border-box;
    }
    button {
      padding: 1rem 2rem;
      font-size: 1.5rem;
      background-color: #09f;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      transition: background-color 0.3s ease;
      color: white;
    }
    button:hover {
      background-color: #07c;
    }
    #nameForm {
      width: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
      margin-top: 0.65rem;
    }

    #nameForm input {
      display: block;
      margin-left: auto;
      margin-right: auto;
    }

    #startBtn {
      font-size: 1.1rem;
      padding: 0.65rem 1.5rem;
      margin-top: 0.5rem;
    }
    #startBtn:disabled {
      background-color: #555;
      color: #aaa;
      cursor: not-allowed;
      opacity: 0.6;
    } 
  </style>
</head>
<body>
  <img src="${images.makeNoskoHappy}" alt="Make Nosko Happy" />
  ${errorHtml}
  <div class="cf-turnstile"
      data-sitekey="${siteKey}"
      data-callback="onTurnstileSuccess"
      data-error-callback="onTurnstileFailure"
      data-expired-callback="onTurnstileFailure">
  </div>

  <div id="nameForm" style="display: none;">
    <input type="text" id="firstName" placeholder="First Name" autocomplete="given-name" required />
    <input type="text" id="lastName" placeholder="Last Name" autocomplete="family-name" required />

    <div style="position: absolute; left: -10000px;" aria-hidden="true">
      <input type="text" id="website_reference" name="website_reference"
            tabindex="-1" autocomplete="off" />
    </div>
  </div>
  <button id="startBtn" style="display: none;">Start</button>

  <script>
    let turnstileVerified = false;

    async function onTurnstileSuccess(token) {
      const formData = new FormData();
      formData.append('turnstile_token', token);

      try {
        const response = await fetch('/verify-turnstile', {
          method: 'POST',
          body: formData
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
          onTurnstileFailure();
          return;
        }

        turnstileVerified = true;
        document.getElementById('nameForm').style.display = 'block';
        document.getElementById('startBtn').style.display = 'inline-block';
      } catch (error) {
        onTurnstileFailure();
      }
    }

    function onTurnstileFailure() {
      turnstileVerified = false;
      document.getElementById('nameForm').style.display = 'none';
      document.getElementById('startBtn').style.display = 'none';
    }

    const firstNameInput = document.getElementById('firstName');
    const lastNameInput = document.getElementById('lastName');
    const startButton = document.getElementById('startBtn');

    function updateStartButton() {
      startButton.disabled =
        !firstNameInput.value.trim() || !lastNameInput.value.trim();
    }

    firstNameInput.addEventListener('input', updateStartButton);
    lastNameInput.addEventListener('input', updateStartButton);
    updateStartButton();
    document.getElementById('startBtn').addEventListener('click', async () => {
      if (!turnstileVerified) return;

      const firstName = document.getElementById('firstName').value.trim();
      const lastName = document.getElementById('lastName').value.trim();
      const honeypot = document.getElementById('website_reference').value;

      if (!firstName || !lastName || honeypot !== '') {
        alert('Unable to process your request. Please try again.');
        return;
      }

      const response = await fetch('/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ firstName, lastName, honeypot })
      });

      if (response.ok) {
        sessionStorage.clear();
        sessionStorage.setItem('nosko_first_name', firstName);
        sessionStorage.setItem('nosko_last_name', lastName);
        window.location.href = '/intro';
      } else {
        alert('Unable to process your request. Please try again.');
      }
    });
  </script>
</body>
</html>
    `;
    return new Response(htmlHome, { headers: { 'content-type': 'text/html;charset=UTF-8' } });
  }

  if (/^level_\d+_training$/.test(path)) {
    const levelMatch = path.match(/^level_(\d+)_training$/);
    const levelNum = levelMatch ? levelMatch[1] : null;
  
    const trainingMessages = {
      1: "A customer's report tells us what they experienced or believe happened. We should take it seriously, but believing a problem exists is different from verifying what actually happened. Verification requires something we can confirm through testing, logs, data, or observed behavior.",

      2: "When someone says an issue started yesterday or immediately after an update, they're often describing when they noticed it. That doesn't establish when it actually began. Use verifiable events, such as the last successful operation and first confirmed failure, to narrow down the timeframe.",

      3: "A screenshot, error message, or log can show that something went wrong, but that doesn't always mean it's actionable. To investigate why, we need relevant clues we can trace through the system or technical details we can break down and examine. For example, a screenshot showing a generic error without a URL, timestamp, or request ID might confirm a failure, but gives us nothing specific to investigate its cause.",

      4: "Two problems can produce similar symptoms without sharing the same cause. Even matching error messages don't necessarily mean you're dealing with the same issue. Compare the features involved, conditions, errors, and technical evidence before assuming problems are related.",

      5: "An escalation should give the next person the information needed to understand and investigate the issue without starting over. Include relevant technical evidence, reproducible steps, expected versus actual behavior, and details that help establish timing or impact. Leave out unrelated background information that doesn't contribute to the investigation."
    };

    const trainingMessagesHeading = {
      1: "WHAT PEOPLE SAY IS NOT PROOF",
      2: "WHEN IT WAS NOTICED IS NOT WHEN IT STARTED",
      3: "SOME INFORMATION IS NOT ACTIONABLE YET",
      4: "LOOKS THE SAME DOES NOT MEAN IT IS THE SAME",
      5: "WHAT HELPS MOST IN AN ESCALATION"
    };
  
    const message = trainingMessages[levelNum] || "Training message not found.";
    const messageHeading = trainingMessagesHeading[levelNum] || "Training message heading not found.";
    const nextPath = `level_${levelNum}_q1`;
  
    const htmlTraining = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <title>Level ${levelNum}</title>
      <link rel="icon" href="${images.heroEraser}" type="image/png" />
      <style>
        body {
          background: #222;
          color: white;
          font-family: sans-serif;
          font-size: 18px;
          line-height: 1.6;
          padding: 2rem;
          max-width: 800px;
          margin: 0 auto;
          text-align: center;
        }
        button {
          margin-top: 2rem;
          padding: 1rem 2rem;
          font-size: 1.2rem;
          background-color: #09f;
          border: none;
          border-radius: 8px;
          color: white;
          cursor: pointer;
        }
        button:hover {
          background-color: #07c;
        }
      </style>
    </head>
    <body>
      <h1>${messageHeading}</h1>
      <p>${message}</p>
      <button onclick="location.href='${nextPath}'">Level ${levelNum} Questions</button>
    </body>
    </html>
    `;
    return new Response(htmlTraining, { headers: { 'content-type': 'text/html;charset=UTF-8' } });
  }

  if (path === 'intro') {
    const { secret } = await getTurnstileConfig(env);
    const isVerified = await verifyNoskoSession(request, secret);

    if (!isVerified) {
      return Response.redirect(new URL('/home', request.url).toString(), 302);
    }

    const htmlIntro = `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>Intro</title>
    <link rel="icon" href="${images.heroEraser}" type="image/png" />
    <style>
      body {
        background: #222;
        color: white;
        font-family: sans-serif;
        font-size: 18px;
        line-height: 1.6;
        padding: 2rem;
        max-width: 800px;
        margin: 0 auto;
        text-align: center;
      }
      img {
        max-width: 300px;
        width: 100%;
        height: auto;
        display: block;
        margin: 0 auto 2rem;
      }
      p {
        margin-bottom: 1rem;
        line-height: 1.6;
      }
      button {
        display: block;
        margin: 2rem auto 0;
        padding: 1rem 2rem;
        font-size: 1.2rem;
        background-color: #09f;
        border: none;
        border-radius: 8px;
        color: white;
        cursor: pointer;
      }
      button:hover {
        background-color: #07c;
      }
    </style>
  </head>
  <body>
    <img src="${images.makeNoskoHappy}" alt="Make Nosko Happy" />
    <p>In tech support, not everything you hear is useful. Some information helps you solve a problem. Other information leads you in the wrong direction.</p>

    <p>In this training, you'll learn how to separate assumptions from facts, recognize actionable information, and focus on what matters when troubleshooting or escalating an issue.</p>

    <p>You'll complete 5 short levels, each with a quick knowledge check, followed by a final quiz. Let's make Nosko happy!</p>
    <button onclick="location.href='/level_1_training'">Continue</button>
  </body>
  </html>
    `;
    return new Response(htmlIntro, { headers: { 'content-type': 'text/html;charset=UTF-8' } });
  }

  if (path === 'summary') {
    const htmlSummary = `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="UTF-8" />
    <title>Summary</title>
    <link rel="icon" href="${images.heroEraser}" type="image/png" />
    <style>
      body {
        background: #222;
        color: white;
        font-family: sans-serif;
        font-size: 18px;
        line-height: 1.6;
        padding: 2rem;
        max-width: 800px;
        margin: 0 auto;
        text-align: center;
      }
      img {
        max-width: 300px;
        width: 100%;
        height: auto;
        display: block;
        margin: 0 auto 2rem;
      }
      p {
        margin-bottom: 1rem;
        line-height: 1.6;
      }
      button {
        display: block;
        margin: 2rem auto 0;
        padding: 1rem 2rem;
        font-size: 1.2rem;
        background-color: #09f;
        border: none;
        border-radius: 8px;
        color: white;
        cursor: pointer;
      }
      button:hover {
        background-color: #07c;
      }
    </style>
  </head>
  <body>
    <h1>Summary</h1>
    <p>What people say is not proof. A customer's report tells us what they experienced or believe happened, but it doesn't verify what actually happened. Use their report to guide your investigation, then confirm the facts through testing, logs, or data.</p>

    <p>When something was noticed is not necessarily when it started. A customer might discover an issue today that actually began days earlier. Use the last confirmed success and first confirmed failure to narrow down when it started.</p>

    <p>Not all information is actionable. A screenshot, error message, or log might verify that something went wrong, but it needs relevant details you can trace or investigate to help identify the cause.</p>

    <p>Problems can look the same but have different causes. Similar symptoms or error messages don't necessarily mean you're dealing with the same issue. Compare the technical evidence before assuming they're related.</p>

    <p>When escalating, include information that helps the next person investigate without starting over. Focus on reproducible steps, expected versus actual behavior, relevant technical evidence, and details that help establish timing or impact. Leave out unrelated information that doesn't help with the investigation.</p>
    <div class="button-container">
    <button onclick="location.href='/quiz'">Take Quiz</button>
      </body>
      </html>
        `;
    return new Response(htmlSummary, { headers: { 'content-type': 'text/html;charset=UTF-8' } });
  }

  // Assign images dynamically to each answer
  for (const level of Object.values(knowledgeCheckData)) {
    for (const answer of Object.values(level.answers)) {
      answer.img = getRandomImage(!!answer.correct);
    }
  }

  if (knowledgeCheckData[path]) {
    const level = knowledgeCheckData[path];
    const answersHtml = Object.entries(level.answers).map(([key, ans]) => `
      <label class="answerLabel">
        <input type="radio" name="answer" value="${key}" />
        <span class="answerText">${ans.text}</span>
      </label>
    `).join('');

const htmlQuiz = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${path.replace('_', ' ').toUpperCase()}</title>
  <link rel="icon" href="${images.heroEraser}" type="image/png" />
  <style>
    html {
      background: #222;
    }
    body {
      width: 100%;
      max-width: 1000px;
      margin: 0 auto;
      padding: 2rem;
      background: #222;
      color: white;
      font-family: sans-serif;
      display: flex;
      flex-direction: column;
      align-items: center;
      box-sizing: border-box;
    }
    h1 {
      margin-bottom: 1rem;
      text-align: center;
    }
    #answers {
      margin-bottom: 20px;
      display: flex;
      flex-direction: column;
      gap: 1rem;
      max-width: 600px;
      width: 100%;
    }
    .answerLabel {
      display: flex;
      align-items: flex-start;
      cursor: pointer;
      background-color: #09f;
      border-radius: 8px;
      padding: 0.75rem 1rem;
      color: white;
      font-size: 1.1rem;
      user-select: none;
      line-height: 1.4;
    }
    .answerLabel:hover {
      background-color: #07c;
    }    
    input[type="radio"]:disabled + .answerText {
      color: #555;
    }
    #message {
      margin-top: 1rem;
      font-size: 1.3rem;
      font-weight: bold;
      text-align: center;
      color: white;
      min-height: 1.5em;
      display: none;
      word-wrap: break-word;
      max-width: 90%;
      box-sizing: border-box;
    }
    
    canvas {
      width: 90vw;
      max-width: 400px;
      aspect-ratio: 2 / 3;
      height: auto;
      background-color: #111;
      border: 2px solid #0f0;
      touch-action: none;
      cursor: url('${images.heroEraser}') 16 16, auto;
      user-select: none;
      display: block;
    }       
    
    #nextBtn {
      margin-top: 1rem;
      padding: 1rem 2rem;
      font-size: 1.2rem;
      border-radius: 8px;
      border: none;
      background-color: #09f;
      color: white;
      cursor: pointer;
      display: none;
      user-select: none;
      max-width: 90%;
      box-sizing: border-box;
    }
    
    #nextBtn:hover {
      background-color: #07c;
    }

    #scrollHint {
      position: fixed;
      bottom: 0;
      left: 0;
      font-size: 1.2rem;
      color: #0af;
      animation: bounce 1.5s infinite;
      text-align: center;
      pointer-events: none;
      display: none;
      z-index: 999;
      width: max-content;
      max-width: calc(100% - 2rem);
      left: 50%;
      transform: translateX(-50%);
      background: rgba(0, 0, 0, 0.9);
      padding: 0.75rem 1.5rem;
      border: 1px solid #0af;
      border-radius: 12px;
    }
    
    @keyframes bounce {
      0%, 100% { transform: translate(-50%, 0); }
      50% { transform: translate(-50%, -8px); }
    }
  </style>
</head>
<body>
  <h1>${level.question}</h1>
  <div id="answers">${answersHtml}</div>
  <canvas id="game" width="400" height="600" style="display: none;"></canvas>
  <div id="scrollHint">↓ Scroll down ↓</div>
  <div id="message"></div>
  <div id="explanation" style="display: none; max-width: 90%; text-align: center; font-size: 1.1rem; line-height: 1.5; margin-top: 0.5rem; color: #ccc;"></div>
  <button id="nextBtn">Next</button>  

  <script>
    const images = ${JSON.stringify(images)};
    const levelData = ${JSON.stringify(level)};
    const knowledgeCheckData = ${JSON.stringify(knowledgeCheckData)};

    let selectedAnswerKey = null;
    let selectedAnswerData = null;
    let nextBtnVisible = false;

    const canvas = document.getElementById('game');

    function resizeCanvasBuffer() {
      const canvasWidth = canvas.offsetWidth;
      const canvasHeight = canvasWidth * 1.5;
    
      canvas.width = canvasWidth;
      canvas.height = canvasHeight;
    
      bufferCanvas.width = canvasWidth;
      bufferCanvas.height = canvasHeight;
    }
    
    const observer = new ResizeObserver(() => {
      if (canvas.style.display !== 'none') {
        resizeCanvasBuffer();
        initBuffer();
        draw();
      }
    });
    
    observer.observe(canvas);    
    const ctx = canvas.getContext('2d');
    const bufferCanvas = document.createElement('canvas');
    const bufferCtx = bufferCanvas.getContext('2d');    

    let bgImg = null;
    const nextBtn = document.getElementById('nextBtn');
    const messageDiv = document.getElementById('message');
    const explanationDiv = document.getElementById('explanation');
    const answersContainer = document.getElementById('answers'); 

    function initBuffer() {
      bufferCtx.clearRect(0, 0, bufferCanvas.width, bufferCanvas.height);
      
      // Draw dark overlay
      bufferCtx.fillStyle = '#111';
      bufferCtx.fillRect(0, 0, bufferCanvas.width, bufferCanvas.height);
    
      // Add centered "Scratch me!" text on top of overlay
      bufferCtx.fillStyle = '#888'; // light gray text
      bufferCtx.font = 'bold ' + Math.floor(bufferCanvas.height / 12) + 'px sans-serif';
      bufferCtx.textAlign = 'center';
      bufferCtx.textBaseline = 'middle';
      bufferCtx.fillText('Scratch me!', bufferCanvas.width / 2, bufferCanvas.height / 2);
    }    

    let isMouseDown = false;
    let isScratching = false;
    let scratchStarted = false;
    const brushRadius = 40;

    answersContainer.addEventListener('change', (e) => {
      if (!e.target.matches('input[name="answer"]')) return;
      if (selectedAnswerKey) return;
      canvas.style.display = 'block';
      selectedAnswerKey = e.target.value;
      selectedAnswerData = levelData.answers[selectedAnswerKey];

      answersContainer.querySelectorAll('.answerLabel').forEach(label => {
        const input = label.querySelector('input');
        if (input.value === selectedAnswerKey) {
          // Keep the selected visible and disabled
          input.disabled = true;
          label.style.display = 'flex';
        } else {
          // Hide unselected answers to save space
          label.style.display = 'none';
        }
      });

      bgImg = new Image();
      bgImg.crossOrigin = "anonymous";
      bgImg.src = selectedAnswerData.img;
      bgImg.onload = () => { draw(); };

      initBuffer();

      nextBtnVisible = false;
      nextBtn.style.display = 'none';
      messageDiv.style.display = 'none';
    });

    function getPointerPos(e) {
      const rect = canvas.getBoundingClientRect();
      let clientX, clientY;
      if (e.touches && e.touches.length) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
      } else {
        clientX = e.clientX;
        clientY = e.clientY;
      }
      return {
        x: clientX - rect.left,
        y: clientY - rect.top
      };
    }

    function scratchAt(x, y) {
      scratchStarted = true;
      bufferCtx.globalCompositeOperation = 'destination-out';
      bufferCtx.beginPath();
      bufferCtx.arc(x, y, brushRadius, 0, Math.PI * 2, false);
      bufferCtx.fill();
      bufferCtx.globalCompositeOperation = 'source-over';
    }

    canvas.addEventListener('mousedown', e => {
      if (!selectedAnswerKey) return;
      isMouseDown = true;
      isScratching = true;
      const pos = getPointerPos(e);
      scratchAt(pos.x, pos.y);
      draw();
    });

    canvas.addEventListener('mousemove', e => {
      if (!isScratching) return;
      const pos = getPointerPos(e);
      scratchAt(pos.x, pos.y);
      draw();
      if (Math.random() < 0.15) spawnEmoji();
    });

    canvas.addEventListener('mouseup', () => {
      isMouseDown = false;
      isScratching = false;
    });

    canvas.addEventListener('mouseleave', () => {
      isScratching = false;
    });

    canvas.addEventListener('mouseenter', () => {
      if (isMouseDown && selectedAnswerKey) {
        isScratching = true;
      }
    });

    canvas.addEventListener('touchstart', e => {
      if (!selectedAnswerKey) return;
      e.preventDefault();
      isScratching = true;
      const pos = getPointerPos(e);
      scratchAt(pos.x, pos.y);
      draw();
    }, { passive: false });
    canvas.addEventListener('touchmove', e => {
      if (!isScratching) return;
      e.preventDefault();
      const pos = getPointerPos(e);
      scratchAt(pos.x, pos.y);
      draw();
      if (Math.random() < 0.2) spawnEmoji();
    }, { passive: false });
    canvas.addEventListener('touchend', () => { isScratching = false; });
    canvas.addEventListener('touchcancel', () => { isScratching = false; });

    function getErasedRatio() {
      const imageData = bufferCtx.getImageData(0, 0, bufferCanvas.width, bufferCanvas.height);
      const pixels = imageData.data;
      let erasedPixels = 0;
      const totalPixels = pixels.length / 4;
      for (let i = 3; i < pixels.length; i += 4) {
        if (pixels[i] === 0) erasedPixels++;
      }
      return erasedPixels / totalPixels;
    }

    function draw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (selectedAnswerKey && bgImg && bgImg.complete) {
        ctx.drawImage(bgImg, 0, 0, canvas.width, canvas.height);
      }
      ctx.drawImage(bufferCanvas, 0, 0);
    }

    // === Floating emoji effect ===
    const emojiList = ['😂','🤣','🍕','🔧','🏎️','🔩','🚗'];
    const chosenEmoji = emojiList[Math.floor(Math.random() * emojiList.length)];
    
    function spawnEmoji() {
      const emoji = document.createElement('div');
      emoji.textContent = chosenEmoji;
      emoji.style.position = 'fixed';
      emoji.style.left = Math.random() * 80 + 10 + 'vw';
      emoji.style.bottom = '-40px';
      emoji.style.fontSize = Math.floor(Math.random() * 30 + 25) + 'px';
      emoji.style.opacity = '1';
      emoji.style.zIndex = '9999';
      emoji.style.transition = 'transform 2.5s ease-out, opacity 2.5s ease-out';
      document.body.appendChild(emoji);
    
      setTimeout(function() {
        emoji.style.transform = 'translateY(-110vh) rotate(' + (Math.random() * 360) + 'deg)';
        emoji.style.opacity = '0';
      }, 50);
    
      setTimeout(function() {
        emoji.remove();
      }, 6000);
    }      

    function loop() {
      draw();

      if (!nextBtnVisible && selectedAnswerKey && scratchStarted) {
        const ratio = getErasedRatio();
        if (ratio > 0.5) {
          nextBtn.style.display = 'inline-block';
          messageDiv.style.display = 'block';
          const messageVisible = isElementInView(messageDiv);
          const nextBtnIsVisible = isElementInView(nextBtn);
          if (!nextBtnIsVisible) {
            document.getElementById('scrollHint').style.display = 'block';
          } else {
            document.getElementById('scrollHint').style.display = 'none';
          }

          if (selectedAnswerData.correct) {
            messageDiv.textContent = "Correct ✔️";
            messageDiv.style.color = '#28a745';
          } else {
            messageDiv.textContent = "Incorrect ❌";
            messageDiv.style.color = '#f44';
          }

          // Show explanation text under the message
          if (levelData.explanation) {
            explanationDiv.innerHTML = levelData.explanation;
            explanationDiv.style.display = 'block';
          } else {
            explanationDiv.style.display = 'none';
          }          

          nextBtnVisible = true;
          requestAnimationFrame(() => {
            document.getElementById('scrollHint').style.display =
              isElementInView(nextBtn) ? 'none' : 'block';
          });
        }
      }

      requestAnimationFrame(loop);
    }
    loop();

    nextBtn.addEventListener('click', function () {
      var parts = window.location.pathname.replace(/^\\//, '').split('_q');
      var lvl = parts[0];
      var q = parts[1];
      var levelNum = parseInt(lvl.split('_')[1]);
      var questionNum = parseInt(q);
    
      var nextPath = '';
    
      if (knowledgeCheckData[lvl + '_q' + (questionNum + 1)]) {
        nextPath = lvl + '_q' + (questionNum + 1);
      } else if (levelNum < 5) {
        nextPath = 'level_' + (levelNum + 1) + '_training';
      } else {
        nextPath = 'summary';
      }
    
      window.location.href = '/' + nextPath;
    });

    function isElementInView(el) {
      const rect = el.getBoundingClientRect();
      return rect.bottom >= 0 && rect.top <= window.innerHeight;
    }
    
    window.addEventListener('scroll', () => {
      const messageVisible = isElementInView(messageDiv);
      const nextBtnIsVisible = isElementInView(nextBtn);
      const scrollHint = document.getElementById('scrollHint');
      if (!nextBtnIsVisible && nextBtn.style.display === 'inline-block') {
        scrollHint.style.display = 'block';
      } else {
        scrollHint.style.display = 'none';
      }
    });

  </script>
</body>
</html>
    `;

    return new Response(htmlQuiz, { headers: { 'content-type': 'text/html;charset=UTF-8' } });
  }

if (path === 'complete') {

  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <title>Woohoo Your Done!</title>
      <link rel="icon" href="${images.heroEraser}" type="image/png" />
      <style>
        body {
          background: #222;
          color: white;
          font-family: sans-serif;
          font-size: 18px;
          line-height: 1.6;
          padding: 2rem;
          max-width: 800px;
          margin: 0 auto;
          text-align: center;
        } 
        button {
          padding: 1rem 2rem;
          font-size: 1.2rem;
          background-color: #28a745; /* green */
          border: none;
          border-radius: 8px;
          color: white;
          cursor: pointer;
          transition: background-color 0.3s ease;
          margin-top: 2.5rem; /* keep your spacing */
        }
        
        button:hover {
          background-color: #218838; /* darker green on hover */
        }        

        #congrats {
          color: #ffa500; /* bright orange text */
          text-shadow: 0 0 10px #ffb347, 0 0 20px #ff8c00;
          animation: pulseGlow 2s ease-in-out infinite alternate;
        }
        
        @keyframes pulseGlow {
          from { text-shadow: 0 0 8px #ffb347; }
          to   { text-shadow: 0 0 25px #ff8c00; }
        }        
        
        @keyframes fall {
          0% { transform: translateY(0) rotate(0deg); opacity: 1; }
          100% { transform: translateY(100vh) rotate(360deg); opacity: 0; }
        }
        
      </style>
    </head>
    <body>
      <h1 id="congrats">🍕 You made Nosko happy! 🍕</h1><br>
      <p id="pizzaIntake"></p>
      <p>Employee satisfaction: Maximum</p>
      <p>Recommendation: Immediate raise in pizza budget.</p>      
      <button onclick="downloadCertificate()">Download Nutritional Facts</button>
      <script>
      var name = sessionStorage.getItem('nosko_first_name') || 'Friend';

      document.getElementById('congrats').textContent =
        '🍕 You made Nosko happy, ' + name + '! 🍕';
      var progress = JSON.parse(sessionStorage.getItem('nosko_progress') || '{}');
      var correctCount = Object.values(progress).filter(answer => answer.correct === true).length;

      document.getElementById('pizzaIntake').textContent =
        'Pizza intake: ' + correctCount + ' slices';
      function downloadCertificate() {
        const canvas = document.createElement('canvas');
        canvas.width = 700;
        canvas.height = 950;
        const ctx = canvas.getContext('2d');
      
        // Background (off-white label)
        ctx.fillStyle = '#fdf6e3';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      
        // Border
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 8;
        ctx.strokeRect(20, 20, canvas.width - 40, canvas.height - 40);
      
        // Title
        ctx.fillStyle = '#000';
        ctx.font = 'bold 36px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Nutritional Facts', canvas.width / 2, 80);
      
        // Divider line
        ctx.beginPath();
        ctx.moveTo(50, 100);
        ctx.lineTo(canvas.width - 50, 100);
        ctx.lineWidth = 2;
        ctx.stroke();
      
        // Serving info with user's name
        ctx.font = 'bold 22px Arial';
        ctx.textAlign = 'left';
        ctx.fillText('Prepared for: ' + name, 50, 140);
        ctx.fillText('Serving Size: 1 completed quiz', 50, 170);
      
        // Divider
        ctx.beginPath();
        ctx.moveTo(50, 190);
        ctx.lineTo(canvas.width - 50, 190);
        ctx.stroke();
      
        // Dynamic nutritional facts
        const facts = [
          ['Correct Answers', correctCount + ' slices'],
          ['Focus', '120%'],
          ['Troubleshooting Power', '95%'],
          ['Team Spirit', '110%'],
          ['Pizza Energy', '∞ slices'],
          ['Daily Motivation', '200%']
        ];
      
        ctx.font = '20px Arial';
        let y = 230;
        for (const [label, value] of facts) {
          ctx.fillText(label, 60, y);
          ctx.textAlign = 'right';
          ctx.fillText(value, canvas.width - 60, y);
          ctx.textAlign = 'left';
          y += 40;
        }
      
        // Footer line
        ctx.beginPath();
        ctx.moveTo(50, y + 10);
        ctx.lineTo(canvas.width - 50, y + 10);
        ctx.stroke();
      
        // Footer text
        ctx.font = '16px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Made fresh by Nosko Labs 🍕', canvas.width / 2, y + 50);
      
        // Bigger Nosko image (noskoDoubleFist)
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.src = "${images.noskoDoubleFist}";
        img.onload = function() {
          ctx.drawImage(img, canvas.width / 2 - 125, y + 70, 250, 310);
      
          // Trigger download
          const link = document.createElement('a');
          link.download = 'nutritional_facts.png';
          link.href = canvas.toDataURL();
          link.click();
        };
      }      
      </script>

      <script>
      const emojis = ['🍕','🎉','👏','💪','🚀'];
      for (let i = 0; i < 15; i++) {
        const e = document.createElement('div');
        e.textContent = emojis[Math.floor(Math.random()*emojis.length)];
        e.style.position = 'fixed';
        e.style.left = Math.random()*100 + 'vw';
        e.style.top = '-20px';
        e.style.fontSize = Math.random()*20 + 20 + 'px';
        e.style.animation = 'fall 3s ease-out forwards';
        e.style.pointerEvents = 'none';
        document.body.appendChild(e);
      }
      </script>
      
    </body>
    </html>
  `;
  return new Response(html, { headers: { 'content-type': 'text/html;charset=UTF-8' } });
}

if (path === 'quiz') {

  const htmlQuizPage = `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>Quiz</title>
    <link rel="icon" href="${images.heroEraser}" type="image/png" />
    <style>
      body {
        background: #222;
        color: white;
        font-family: sans-serif;
        font-size: 18px;
        line-height: 1.6;
        padding: 2rem;
        max-width: 800px;
        margin: 0 auto;
        text-align: center;
      }
      h1 {
        margin-bottom: 2rem;
      }
      .question {
        font-size: 1.3rem;
        margin-bottom: 1.5rem;
        line-height: 1.5;
      }
      .answers {
        display: flex;
        flex-direction: column;
        gap: 1rem;
        max-width: 500px;
        margin: 0 auto;
      }
      .answerLabel {
        background-color: #09f;
        padding: 0.75rem 1rem;
        border-radius: 8px;
        cursor: pointer;
        font-size: 1.1rem;
        transition: background-color 0.3s ease;
        text-align: left;
      }
      .answerLabel:hover {
        background-color: #07c;
      }
      button {
        margin-top: 2rem;
        padding: 1rem 2rem;
        font-size: 1.2rem;
        border: none;
        border-radius: 8px;
        background-color: #09f;
        color: white;
        cursor: pointer;
      }
      button:hover {
        background-color: #07c;
      }
      #message {
        margin-top: 1.5rem;
        font-size: 1.3rem;
        font-weight: bold;
        display: none;
      }
      #game-area {
        display: flex;
        align-items: center;
        justify-content: space-between;
        width: 90%;
        max-width: 800px;
        margin: 1rem auto 2rem;
        position: relative;
        background: #FCFCFC;
        padding: 1rem 1.5rem 3.0rem;
        border-radius: 12px;
        box-shadow: 0 0 15px rgba(255,255,255,0.1);
      }      
      
      #game-area img {
        height: 150px;
        width: auto;
        user-select: none;
      }
      
      #pizza {
        transition: transform 1s ease-in-out;
        position: relative;
        z-index: 0;
      }
      
      #line {
        flex-grow: 1;
        height: 4px;
        background: #555;
        margin: 0 1rem;
        border-radius: 2px;
      }

      #trash,
      #guy {
        position: relative;
        z-index: 1; /* higher number = in front */
      }

      @keyframes wobbleTrash {
        0%   { transform: rotate(0deg); }
        15%  { transform: rotate(-5deg); }
        30%  { transform: rotate(4deg); }
        45%  { transform: rotate(-3deg); }
        60%  { transform: rotate(2deg); }
        75%  { transform: rotate(-1deg); }
        100% { transform: rotate(0deg); }
      }
      
      .wobble {
        animation: wobbleTrash 0.6s ease-in-out;
      }   
    </style>
  </head>
  <body>
    <h1>Quiz</h1>

    <div id="game-area">
    <img id="trash" src="${images.trash}" alt="Trash Can">
    <div id="line"></div>
    <img id="pizza" src="${images.pizza}" alt="Pizza Slice">
    <div id="line"></div>
    <img id="guy" src="${images.noskoEat}" alt="Nosko Guy">
  
    <div id="pizzaProgress" style="
        position: absolute;
        bottom: 6px;
        left: 0;
        width: 100%;
        text-align: center;
        font-size: 1.8rem;
    ">
      🍕🍕🍕🍕🍕🍕🍕🍕🍕🍕
    </div>
  </div>  
  
    <div class="question" id="questionText"></div>
    <div class="answers" id="answers"></div>    
    
    <div id="message"></div>
    <button id="nextBtn" style="display:none;">Next</button>

    <div id="caloriesDisplay" style="
    position: fixed;
    bottom: 20px;
    right: 40px;
    font-size: 1.6rem;
    color: #fff;
    text-align: right;
    font-weight: bold;
  ">
    Calories: 0
  </div>
   

    <script>
    const messageDiv = document.getElementById('message');
    const nextBtn = document.getElementById('nextBtn');
    let selected = false;

    function saveQuizProgress(questionId, selectedAnswer, correct) {
      const progress = JSON.parse(sessionStorage.getItem('nosko_progress') || '{}');

      progress[questionId] = {
        selectedAnswer,
        correct
      };

      sessionStorage.setItem('nosko_progress', JSON.stringify(progress));
    }

    const totalQuestions = 10;
    const savedProgress = JSON.parse(sessionStorage.getItem('nosko_progress') || '{}');
    const savedAnswers = Object.values(savedProgress);
    const savedQuestionCount = savedAnswers.length;

    let remainingPizzas = Math.max(totalQuestions - savedQuestionCount, 0);   
    let lastAnswerCorrect = false;
    let lastQuestionText = '';
    let lastSelectedText = '';
    let correctCount = savedAnswers.filter(answer => answer.correct === true).length;

    document.getElementById('pizzaProgress').textContent = '🍕'.repeat(remainingPizzas);

    function updatePizzaProgress() {
      const bar = document.getElementById('pizzaProgress');
      if (!bar) return;
      remainingPizzas = Math.max(remainingPizzas - 1, 0);
      bar.textContent = '🍕'.repeat(remainingPizzas);
    }

    function updateCaloriesDisplay() {
      const calDiv = document.getElementById('caloriesDisplay');
      const totalCalories = correctCount * 300;
      calDiv.textContent = "Calories: " + totalCalories;
    }    
    
    var finalQuizData = ${JSON.stringify(finalQuiz)};
    var currentIndex = savedQuestionCount; // track which question we're on

    function animatePizza(isCorrect) {
      const pizza = document.getElementById('pizza');
      const trash = document.getElementById('trash');
      const guy = document.getElementById('guy');
    
      // measure positions
      const pizzaRect = pizza.getBoundingClientRect();
      const targetRect = (isCorrect ? guy : trash).getBoundingClientRect();
      const pizzaCenter = pizzaRect.left + pizzaRect.width / 2;
      const targetCenter = targetRect.left + targetRect.width / 2;
      const dx = targetCenter - pizzaCenter;
    
      // reset pizza to visible
      pizza.style.opacity = '1';
      pizza.style.transform = 'translateX(0px) scale(1)';
    
      // animate toward target
      pizza.style.transition = 'transform 0.7s ease-in-out, opacity 0.3s ease-out';
      pizza.style.transform = 'translateX(' + dx + 'px) scale(0.6)';

      if (!isCorrect) {
        setTimeout(() => {
          trash.classList.add('wobble');
          setTimeout(() => trash.classList.remove('wobble'), 600);
        }, 435);
      }      
    
      // fade it out after slide
      setTimeout(() => {
        pizza.style.opacity = '0';
      }, 680);
    }    
    
    function renderQuestion() {
      const q = finalQuizData[currentIndex];
      document.getElementById('questionText').innerHTML = q.question;
      
      let answersHTML = "";
      for (var key in q.answers) {
        const ans = q.answers[key];
        answersHTML +=
          '<label class="answerLabel">' +
            '<input type="radio" name="answer" value="' + key + '" /> ' +
            ans.text +
          '</label>';
      }
      document.getElementById('answers').innerHTML = answersHTML;
    
      // Reset message and hide next button for new question
      messageDiv.style.display = 'none';
      nextBtn.style.display = 'none';
      selected = false;

      // Change button label depending on progress
      if (currentIndex === finalQuizData.length - 1) {
        nextBtn.textContent = 'Complete';
      } else {
        nextBtn.textContent = 'Next';
      }      
    
      // Re-attach listener for new answers
      attachAnswerHandler();
    }
    
    function attachAnswerHandler() {
      const answersContainer = document.getElementById('answers');
      answersContainer.onchange = (e) => {
        if (selected) return;
        selected = true;
        const value = e.target.value;
    
        // Disable all other answers
        const inputs = answersContainer.querySelectorAll('input');
        inputs.forEach(i => i.disabled = true);
    
        const q = finalQuizData[currentIndex];
        const correctKey = Object.keys(q.answers).find(k => q.answers[k].correct);
        const isCorrect = (value === correctKey);
        lastAnswerCorrect = isCorrect;
        lastQuestionText = q.question;
        lastSelectedText = q.answers[value].text;
        
        messageDiv.style.display = 'block';
        if (isCorrect) {
          messageDiv.textContent = "Correct ✔️";
          messageDiv.style.color = '#28a745';
          animatePizza(true);
        } else {
          messageDiv.textContent = "Incorrect ❌";
          messageDiv.style.color = '#f44';
          animatePizza(false);
        }             
    
        // Show button, update calories, and change image after pizza finishes animation
        setTimeout(() => {
          if (isCorrect) {
            correctCount = correctCount + 1;
            updateCaloriesDisplay();

            // Change guy image at milestones
            const guy = document.getElementById('guy');
            if (correctCount === 3) {
              guy.src = "${images.noskoEatPlus1}";
            } else if (correctCount === 6) {
              guy.src = "${images.noskoEatPlus2}";
            }
          }
          nextBtn.style.display = 'inline-block';
        }, 435);
        
      };
    }
    
    nextBtn.addEventListener('click', async () => {
      updatePizzaProgress();
      const pizza = document.getElementById('pizza');
      
      // Only reset pizza if NOT the last question
      if (currentIndex < finalQuizData.length - 1) {
        pizza.style.transition = 'none';
        pizza.style.transform = 'translateX(0px) scale(1)';
        pizza.style.opacity = '1';
      }

    // Save current progress in the browser
    saveQuizProgress(
      finalQuizData[currentIndex].id,
      lastSelectedText,
      lastAnswerCorrect
    );
        
      currentIndex++;
      if (currentIndex < finalQuizData.length) {
        renderQuestion();
      } else {
        window.location.href = '/complete';
      }
    });
    
    // Initialize first question or show completion
    if (currentIndex >= finalQuizData.length) {
      window.location.href = '/complete';
    } else {
      renderQuestion();
    }

    const guy = document.getElementById('guy');
    if (correctCount >= 6) {
      guy.src = "${images.noskoEatPlus2}";
    } else if (correctCount >= 3) {
      guy.src = "${images.noskoEatPlus1}";
    }
    
    updateCaloriesDisplay();
    </script>
  </body>
  </html>
  `;
  return new Response(htmlQuizPage, { headers: { 'content-type': 'text/html;charset=UTF-8' } });
}

  return new Response('Page not found', { status: 404 });
}
