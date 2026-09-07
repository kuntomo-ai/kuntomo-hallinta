# Kuntomo Hallinta — järjestelmädokumentaatio

Sisäinen ERP/hallintajärjestelmä kuntosalille. React SPA + Supabase-backend, deployattu Verceliin.

**Tuotanto-URL:** https://hallinta.kuntomo.com  
**Repo:** github.com/kuntomo-ai/kuntomo-hallinta  
**Deploy:** `git push origin main` → Vercel buildaa ja julkaisee automaattisesti

---

## Teknologiapino

| Kerros | Teknologia |
|--------|-----------|
| Frontend | React 18, React Router v6, Recharts, Lucide |
| Build | Vite + Rolldown, PWA (vite-plugin-pwa) |
| Backend/DB | Supabase (PostgreSQL + Auth + Storage + Realtime) |
| Hosting | Vercel (frontend + serverless API) |
| Rate limiting | Upstash Redis + @upstash/ratelimit |
| AI | Anthropic Claude API (@anthropic-ai/sdk) |
| Auth | Supabase Auth (sähköposti + salasana) |

---

## Arkkitehtuuri

```
Selain (PWA)
  └── React SPA  (src/)
        ├── AuthContext   – kirjautuminen, roolit, reittioikeudet
        ├── Supabase-client (src/lib/supabase.js, publishable key)
        └── Sivut (src/pages/)

Vercel serverless  (api/)
  ├── _lib/auth.js        – cron-token + bearer-auth
  ├── _lib/rateLimit.js   – Upstash-rate limit
  ├── _lib/requireRole.js – roolitarkistus API-endpointeissa
  ├── laite/[id].js       – julkinen QR-laitelukija (GET = laitetieto, POST = vikailmoitus)
  ├── laite/signed-url.js – allekirjoitettu Storage-URL
  ├── admin/users.js      – käyttäjälista (admin-only)
  ├── cron/ig-daily.js    – päivittäinen cron (sync + analyze + token-refresh ma)
  ├── cron/ig-sync.js     – Instagram-postien haku
  ├── cron/ig-analyze.js  – Claude-analyysi posteille
  └── cron/ig-token-refresh.js – IG long-lived token refresh

Supabase
  ├── PostgreSQL  – kaikki data (myynti, henkilöstö, laitteet, kirjanpito…)
  ├── Auth        – käyttäjätunnukset, sessiot
  └── Storage     – dokumentit, kuvat (RLS-suojattu)
```

---

## Roolijärjestelmä

Käyttäjällä on yksi tai useampi rooli. Roolit tallennetaan `profiles`-tauluun:
- `role` TEXT — vanhan profiilin ensisijainen rooli
- `roles` TEXT[] — uudempi monikkoroolikenttä (prioriteetti, jos ei tyhjä)

`hasRole(r)` tarkistaa molemmista. `role` = `roles[0]` tai fallback-singulaariarvo.

### Roolit ja oikeudet

| Rooli | Kuvaus | Pääsy |
|-------|---------|-------|
| `admin` | Täydet oikeudet | Kaikki |
| `manager` | Johto | Kaikki kuten admin |
| `hallitus` | Hallitus | Kirjanpito, talousraportit |
| `myynti` | Myyntihenkilöstö | Myynti, timelog, oma-raportointi |
| `terapia_valmennus` | Terapeutit/valmentajat | Myynti, terapiamyynti, lahjakortit, yritykset |
| `sport` | Sport Hockey -tiimi | Myynti, sport-hockey, oma-raportointi |
| `respa` | Vastaanotto | Laiteluettelo, varasto, lahjakortit, MobilePay, Instagram |
| `huolto` | Huoltohenkilöstö | Laiteluettelo (vikakuittaukset), timelog |

### Reittioikeudet (`AuthContext.jsx`)

```
/timelog              → myynti, terapia_valmennus, huolto, sport, respa
/employees            → admin/manager vain
/inventory            → respa
/laiteluettelo        → respa, huolto
/finance/myynti       → myynti, terapia_valmennus, sport, respa
/finance/lahjakortit  → terapia_valmennus, respa
/finance/kirjanpito   → hallitus (+ admin/manager)
/finance/raportointi  → hallitus (alaosiot vaihtelevat)
/customers/yritykset  → terapia_valmennus, respa
/customers/sport-hockey → sport
/instagram            → admin, respa
```

Kaikki määrittelemättömät reitit: kaikki kirjautuneet pääsevät.

---

## Sivukartta

### Myynti (`/finance/myynti`)
- Terapiamyynti, valmennusmyynti, jäsenmyynti yhdellä sivulla
- Myyntirivit tallennetaan `terapiamyynti`, `valmennusmyynti`, `jasenmyynti` -tauluihin

### Kirjanpito (`/finance/kirjanpito`)
- **Tulos** – tuloslaskelma kuukausiraporteista
- **Tase** – tase-snapshot
- **Kassavirta** – kassavirtaennuste
- **Ennuste** – kuukausiennuste
- **Investointilaskuri** – uusien toimipisteiden ROI-laskuri (tilikausi 1.5–30.4)
- **Tilinpäätös** – tilinpäätöstyökalut
- **Tuonti** – kirjanpitodokumenttien tuonti

### Raportointi (`/finance/raportointi`)
- Terapiamyynti, valmennusmyynti, jäsenmyynti, lahjakortit, MobilePay, jäsenyydet
- Oma-raportointi (yksittäinen työntekijä)

### Henkilöstö (`/employees`)
- Henkilöstöhallinta: tiedot, roolit, palkkaus
- Kausityöntekijät
- Kyselyt ja ohjeet (kaikki roolit)

### Laiteluettelo (`/laiteluettelo`)
- Laitteiden hallinta, QR-koodit, vikailmoitukset
- `canService` = admin | respa | huolto → vikailmoituksen kuittaus
- Julkinen QR-sivu: `/laite/:id` (ei vaadi kirjautumista)

### Muut sivut
| Reitti | Sivu |
|--------|------|
| `/` | Dashboard |
| `/calendar` | Kalenteri |
| `/communication` | Viestintä / kanavat |
| `/tasks` | Tehtävät |
| `/inventory` | Varasto |
| `/laiteluettelo/kaapit` | Kaapit/lukot |
| `/customers/yritykset` | Yritysasiakkaat |
| `/customers/sport-hockey` | Sport Hockey |
| `/instagram` | Instagram-analytiikka |
| `/timelog` | Työvuorokirjaus |
| `/settings` | Omat asetukset |

---

## Tietokanta (Supabase)

### Päätaulut

| Taulu | Sisältö |
|-------|---------|
| `profiles` | Käyttäjäprofiilit, roolit (`role`, `roles[]`) |
| `employees` | Henkilöstötiedot, status (active/inactive) |
| `terapiamyynti` | Terapiamyynnin rivit |
| `valmennusmyynti` | Valmennusmyynnin rivit |
| `jasenmyynti` | Jäsenmyynnin rivit |
| `lahjakortit` | Lahjakortit (koodi, arvo, käyttö) |
| `mobilepay_transactions` | MobilePay-tapahtumat |
| `tulos_kuukausiraportti` | Kuukausittaiset tuloslaskelmarivit |
| `tase_snapshot` | Tase-tilannekuva |
| `kassavirta` | Kassavirtaennuste |
| `kirjanpito_documents` | Kirjanpitodokumentit (Storage-linkit) |
| `investoinnit_data` | Investointilaskurin data (yksi JSONB-rivi) |
| `devices` | Laitteet (nimi, malli, QR-id, sijainti) |
| `device_faults` | Vikailmoitukset |
| `work_logs` | Työvuorot |
| `work_time_logs` | Kellonaikakirjaukset |
| `drive_logs` | Ajopäiväkirja |
| `lockers` | Kaapit/lukot |
| `tasks` | Tehtävät |
| `channel_messages` | Sisäiset viestit/kanavat |
| `company_visits` | Yritysasiakaskäynnit |
| `instagram_posts` | IG-postit (synkattu) |
| `instagram_analyses` | Claude-analyysit posteista |

### RLS-politiikka

Row Level Security on päällä kaikissa tuotantotauluissa. Käyttöoikeudet:
- `has_role(text[])` — PostgreSQL-funktio, tarkistaa `profiles`-taulun
- Finanssitaulut (tulos, tase, kirjanpito): vain `admin`, `hallitus`, `manager`
- `investoinnit_data`: SELECT/INSERT/UPDATE vain `admin`, `hallitus`, `manager`
- `employees`: READ/WRITE `admin`, `hallitus`, `manager`
- `lahjakortit`: SELECT laajempi roolijoukko

### SQL-migraatiot

Skeemamuutokset ovat käsinajettavia SQL-tiedostoja `/supabase_*.sql`. Ne ajetaan Supabase Dashboard → SQL Editor. Tiedostoja ei ajeta automaattisesti — ne ovat dokumentaatiota ajetuista muutoksista.

---

## Varmuuskopiot

| Kohde | Metodi | Status |
|-------|--------|--------|
| **Koodi** | GitHub (kuntomo-ai/kuntomo-hallinta) | ✅ Jatkuva — jokainen push |
| **Tietokanta** | Supabase automaattinen backup | ✅ Päivittäin (ilmaistierillä 7 pv, Pro: PITR) |
| **Storage (tiedostot)** | Supabase Storage | ⚠️ Ei erillistä backupia — luotetaan Supabasen replikointiin |
| **Env-muuttujat** | Vercel Dashboard | ⚠️ Ei viety ulos — dokumentoi manuaalisesti jos tili vaihtuu |

**Suositukset:**
1. Varmista Supabase Dashboard → Settings → Backups että backup on päällä ja taso riittävä (Pro-tier suositellaan PITR:n vuoksi)
2. Vie env-muuttujat talteen turvalliseen paikkaan (esim. salattu 1Password-muistiinpano)
3. Storage-sisältö (dokumentit, kuvat): harkitse S3-peilausta tai manuaalista vientiä tarvittaessa

---

## Automatiikka

### Vercel Cron
```
/api/cron/ig-daily    klo 04:00 UTC joka päivä
  ├── ig-sync          hakee uudet IG-postit Meta API:sta
  ├── ig-analyze       analysoi uudet postit Claudella (Sonnet)
  └── ig-token-refresh joka maanantai — uusii long-lived tokenin (vanhenee 60 pv)
```

Cron suojattu `CRON_SECRET` -ympäristömuuttujalla (Vercel Bearer).

---

## Kehitysympäristö

```bash
cd /Dropbox/ai/kuntomo-hallinta-src
npm install
npm run dev          # http://localhost:5173 tai 5174
npm run build        # tuotantobuild → dist/
```

### Deploy
```bash
git add .
git commit -m "feat: ..."
git push origin main   # Vercel käynnistää automaattisen deployn
```

**HUOM:** Älä käytä `vercel deploy` tai `vercel --prod` — ainoastaan `git push` triggeröi tuotantodeploy oikein.

### GitHub-tili
Repo on `kuntomo-ai`-organisaation alla. SSH-avain `~/.ssh/id_ed25519`.

---

## Ympäristömuuttujat (Vercel)

| Muuttuja | Käyttö |
|----------|--------|
| `SUPABASE_URL` | Supabase-projektin URL |
| `SUPABASE_SERVICE_KEY` | Service role -avain (API, ohittaa RLS) |
| `CRON_SECRET` | Vercel cron -autentikointi |
| `ANTHROPIC_API_KEY` | Claude API (IG-analytiikka) |
| `UPSTASH_REDIS_REST_URL` | Rate limiting |
| `UPSTASH_REDIS_REST_TOKEN` | Rate limiting |
| `IG_ACCESS_TOKEN` | Instagram long-lived access token |
| `IG_USER_ID` | Instagram Business -tilin ID |

Frontend käyttää ainoastaan `VITE_SUPABASE_URL` ja publishable key (kovakoodattu `src/lib/supabase.js`).

---

## Tietoturva

- HTTP security headerit (`X-Frame-Options: DENY`, CSP, `Referrer-Policy` jne.) — `vercel.json`
- Rate limiting Upstash Redisillä julkisissa endpointeissa (`/api/laite/`, `/api/admin/users`)
- File upload: MIME-tyyppi + koko tarkistetaan ennen tallennusta
- Gitleaks CI-tarkistus — estää salaisuuksien commitoinnin
- SessionStorage + PWA-cache tyhjennetään uloskirjautumisessa
- RLS kaikissa tauluissa — service_role vain palvelinpuolella
- Inaktiivinen työntekijä kirjataan ulos välittömästi kirjautumisyrityksessä

---

*Päivitetty: 2026-09-07*
