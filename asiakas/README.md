# Asiakasportaali (MVP)

Kirjautuminen: `/asiakas`  
Dashboard: `/asiakas/dashboard`

Asiakkaat kirjautuvat omilla tunnuksillaan samaan portaaliin; jokainen näkee vain oman projektinsa analytiikan.

## Mitä tarvitaan Vercelissä

1. Luo token: Vercel → Account Settings → Tokens
2. Ota Web Analytics päälle asiakasprojekteissa
3. Kopioi projektin **Project ID** (Project Settings → General)
4. Lisää Environment Variables productioniin (ja tarvittaessa previewhin):

- `AUTH_SECRET`
- `VERCEL_TOKEN`
- `VERCEL_TEAM_ID` (jos team-tili)
- `CLIENT_JK_*` (JK Best Carwash)
- `CLIENT_LUMIA_*` (Lumia Autofix)

Katso myös `.env.example`.

## Turvallisuus

- Vercel-token elää vain API-funktiossa (ei frontendissä)
- Sessio on allekirjoitettu HMAC-token (12 h)
- Portaali on `noindex`

## Paikallinen testaus

Staattinen `serve` ei aja `/api/*` serverless-funktioita.
Käytä `node server.js` → http://localhost:8080/asiakas
