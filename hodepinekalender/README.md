# Hodepinekalender PWA

En enkel lokal nettapp for å registrere hodepine, migrene, anfall og medisinbruk.

## Publisering

Mappen publiseres som `/hodepinekalender/`. Appen må åpnes over HTTPS for at nettleseren skal kunne tilby installasjon.

## Filer

- `index.html` – liten oppstartsside som laster selve kalenderen
- `payload/` – fire deler av den komprimerte, frittstående kalenderapplikasjonen
- `manifest.webmanifest` – navn, appmodus og ikoner
- `service-worker.js` – offline-cache
- `icons/` – appikoner

Offline-versjonen genereres direkte i nettleseren med knappen «Last ned offline-versjon».

## Lagring

Data lagres i LocalStorage for `sarcasm.games`. Den installerte appen og nettsiden deler derfor data på samme enhet og i samme nettleserprofil. Data synkroniseres ikke mellom enheter.

## Oppdatering

Ved endringer i de cachede filene skal `CACHE_NAME` i `service-worker.js` økes, for eksempel fra `v1` til `v2`.
