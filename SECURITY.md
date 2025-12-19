# Security Policy

## Reporting a Vulnerability

Please report security issues by emailing **alphinctom@gmail.com** (GitHub: @alpha912).
Do not open public issues for security-sensitive reports.

## Scope

This repository contains the LocalLoop backend API. All dependencies and server logic
are in scope.

## Response Timeline

- Initial response: within 72 hours
- Status update: within 7 business days

## Secure Deployment Notes
- Run behind TLS (reverse proxy).
- Keep `ALLOWED_ORIGINS` restricted to the GitHub Pages domain.
- Store the SQLite database outside the web root.

*Last Updated: December 2025*
