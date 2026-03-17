# Dog recovery plan (step-by-step)

Denne planen prioriterer å få en stabil, fullførbar live-match så raskt som mulig.

## 0) Stabiliseringsmål

Spillbar 4-spiller live-opplevelse: create -> join -> ready -> start -> full match -> winner, med Supabase som autoritativ state.

---

## 1) Realtime først (P0)

### Hva vi gjør

1. Implementer Supabase Realtime subscription i klient for room updates.
2. Behold polling kun som fallback.
3. Legg inn versjonsbeskyttelse i klient-reducer (ignorer stale snapshots).

### Ferdig når

- Oppdateringer kommer primært via realtime events.
- Polling fungerer kun som nødnett, ikke hovedflyt.

---

## 2) Full spillbarhet i staging (P0)

### Hva vi gjør

1. Kjør en styrt golden-path med 4 spillere.
2. Trigger reconnect under aktiv tur.
3. Spill helt til vinner.
4. Dokumenter run med timestamp + resultat.

### Ferdig når

- Ett helt spill fullføres uten manuelle reset/DB-fiks.

---

## 3) Team-only enforcement end-to-end (P0)

### Hva vi gjør

1. Fjern/avgrens `solo` på backend command validation.
2. Behold evt. kort kompatibilitetsmapping bare hvis aktiv trafikk krever det.
3. Oppdater tester så teams-only er standard path.

### Ferdig når

- Nye rom og aktiv runtime følger kun teams-modellen.

---

## 4) Host/identity hardening (P1)

### Hva vi gjør

1. Verifiser at start/invite-sensitive handlinger er host-autorisert i backend, ikke kun UI.
2. Verifiser idempotency/version checks på alle writes.
3. Verifiser rate-limit oppførsel (429 + retry hints).

### Ferdig når

- Ikke-host kan ikke utføre host-only actions via direkte API-kall.

---

## 5) Go-live checkliste (P1)

- [ ] Realtime primærflyt aktiv
- [ ] 4-player smoke run dokumentert
- [ ] Reconnect validert mid-turn
- [ ] Team-only bekreftet i backend
- [ ] Host-only autorisasjon verifisert server-side
- [ ] Ingen skjult informasjon i public payloads

## Operativ referanse

For neste arbeidsøkt: bruk `NEXT_CHAT_PROMPT.md`.
