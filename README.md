# Make Nosko Happy 🍕

An interactive, browser-based training game designed to teach technical support engineers how to recognize actionable information, verify issues, and build better technical escalations.

## Why I Built It

I originally created Make Nosko Happy as an internal training game to help support engineers develop stronger troubleshooting habits. The goal was to make learning more engaging while reinforcing an important principle: not all information is equally useful when investigating a problem.

I later adapted the game into a standalone public demo.

## How It Works

Players complete five short training levels covering:

1. Separating customer reports from verified facts
2. Distinguishing when an issue was noticed from when it started
3. Recognizing actionable technical evidence
4. Investigating similar symptoms without assuming identical causes
5. Including relevant information in technical escalations

Each level includes two interactive scratch-off knowledge checks. Players then complete a 10-question final quiz and receive a downloadable, personalized *Nutritional Facts* certificate.

## Technologies

- JavaScript, HTML, and CSS
- Cloudflare Workers
- Cloudflare Turnstile
- Cloudflare D1
- Canvas API for interactive scratch-off cards and downloadable certificates
- Web Crypto API for signed, expiring sessions
- Browser session storage for player progress

## Technical Highlights

- Server-side session authentication using signed, expiring cookies
- Turnstile verification to protect public access
- Dynamically generated training pages and quizzes
- Canvas-based scratch-off interactions
- Personalized completion experience and certificate generation
- Responsive browser-based interface

## Live Demo

[Play Make Nosko Happy](https://makenoskohappy.smithbits.io)

## About

Designed and developed by Ryan Smith as part of a portfolio demonstrating technical troubleshooting, support operations, and practical application development.
