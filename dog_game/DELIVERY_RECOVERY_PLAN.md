# Dog recovery plan (step-by-step)

Denne planen er laget basert på nåværende kode/status i repoet, med fokus på at ting som virket før nå er ustabile.

## 0) Stabiliseringsmål

Målet er at vi skal kunne spille et helt spill live, med Supabase som autoritativ state-store og server-authoritative regler hele veien.

---

## 1) Endpoint- og kontraktssjekk (P0)

### Hva vi gjør

1. Kartlegg alle kommandoer som klienten sender og bekreft at `dog-room` edge-funksjonen håndterer dem.
2. Bekreft at command payloads alltid inkluderer `idempotencyKey` og `expectedVersion` der det kreves.
3. Verifiser CORS-oppsett for produksjonsdomener.
4. Verifiser at ingen side er låst til feil miljø-endpoint.

### Ferdig når

- `create_room`, `attach`, `join_room`, `set_ready`, `start_match`, `exchange_card`, `request_legal_moves`, `start_move_preview`, `cancel_move_preview`, `confirm_move`, `pass_turn_if_blocked` fungerer via samme deployed endpoint.

---

## 2) Supabase full kontrollsjekk (P0)

### Hva vi gjør

1. Bekreft secrets i Supabase:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `ALLOWED_ORIGINS`
2. Verifiser tabellen `dog_room_states` og indekser.
3. Verifiser at persist/write/read fungerer med service role i Edge Function.
4. Verifiser realtime-publisering fra room-service for state-endringer.
5. Legg inn enkel rate limit policy i edge-ingress og logg tilbakeoff.

### Ferdig når

- Kommandoer persisteres uten race conditions.
- Realtime-eventer følger samme versjon som lagret state.
- Flood/spam blir avvist med 429.

---

## 3) Fullt spillbart for 4 spillere (P0)

### Hva vi gjør

1. Kjør en styrt "golden path" test:
   - create -> join x3 -> ready -> start -> full match -> winner.
2. Valider reconnect mid-turn.
3. Valider at winner er identisk hos alle klienter.
4. Valider at DB holder autoritativ game state gjennom hele matchen.

### Ferdig når

- Ett helt spill kan fullføres uten manuell DB-fiks eller reset.

---

## 4) Fjern lokal/midlertidig som source-of-truth (P0)

### Hva vi gjør

1. Gå gjennom klientkode for localStorage/query-param state som påvirker gameplay.
2. Behold kun lokal cache for UX (ikke autoritativ game state).
3. Flytt all kritisk state til server snapshots/private view.
4. Dokumenter hva som er lov som lokal fallback (f.eks. endpoint-prefill), og hva som aldri er lov (turn/game mutation).

### Ferdig når

- Ingen spillfremdrift avhenger av klientlokal state.

---

## 5) UI-forbedringer med rolleavgrensning (P1)

### Hva vi gjør

1. Hosten alene skal se og bruke:
   - inviteringslenker
   - start-knapp
2. Joinere skal kun:
   - velge navn
   - velge sete (hvis host ikke auto-/manuelt setter sete)
3. Gjør tydelig rollemarkering i lobbyen (Host / Player).
4. Deaktiver og skjul handlinger som ikke er tillatt for rollen.

### Ferdig når

- Ingen ikke-host kan starte spill eller generere invites i UI.

---

## 6) Fjern `solo`/`1v1v1v1` konseptet (P1)

### Hva vi gjør

1. Fjern `solo` valg i opprett-rom UI.
2. Oppdater validering slik at alle konfigurasjoner går via teams-modellen.
3. Migrer eksisterende dokumentasjon/tekst til:
   - "4 lag med 1 spiller" i stedet for "1v1v1v1".
4. Legg inn kompatibilitetsmapping i backend bare hvis nødvendig for gamle klienter (tidsbegrenset).

### Ferdig når

- Nyopprettede rom bruker kun teams-konfigurasjon.

---

## 7) Dokumentasjonshygiene (P1)

### Hva vi gjør

1. Slå sammen overlappende milepælsfiler.
2. Fjern utdaterte statusfiler som ikke lenger brukes operativt.
3. Hold igjen tre operative dokumenter:
   - live status
   - recovery/delivery plan
   - live test runbook
4. Legg inn en kort "single source of truth"-seksjon i planfilen.

### Ferdig når

- Ingen motstridende MD-filer beskriver ulike sannheter for samme område.

---

## Foreslått gjennomføringsrekkefølge (10 arbeidsdager)

- Dag 1-2: Endpoint + Supabase kontrollsjekk
- Dag 3-4: Full spillbarhet + reconnect verifikasjon
- Dag 5: Fjern lokal source-of-truth avhengigheter
- Dag 6-7: UI-rollebegrensning
- Dag 8: Fjern solo-modus
- Dag 9-10: Dokumentasjon + staging smoke + release gate

## Trenger sjekk fra deg nå

Hvis du vil, sjekk disse to med en gang i produksjon/staging:

1. Om `dog-room` endpoint fortsatt svarer på `OPTIONS` og `POST` uten CORS-feil.
2. Om du nylig har endret Supabase secrets (spesielt `ALLOWED_ORIGINS` eller service role key).

Hvis en av disse feiler, gir det høy sannsynlighet for "ting som plutselig slutter å virke".
