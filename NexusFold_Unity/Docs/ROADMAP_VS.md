# Roadmap Vertical Slice — 10 giornate

Ipotesi: 1 dev full-time. Con 2 dev accorcia a 6.
Dopo ogni giornata l'APK deve buildare e girare su un device di riferimento (Redmi 9, 4 GB RAM).

## Prima settimana — fondamenta e battle

### G1 — Setup progetto Unity + import codice
- Progetto Unity 2022.3 LTS o 6000.x, template URP.
- Copia `NexusFold_Unity/Scripts/` in `Assets/Scripts/`.
- Copia `NexusFold_Unity/ScriptableObjects/` in `Assets/ScriptableObjects/`.
- Crea scene: `Boot`, `MainMenu`, `Shop`, `HeroSelect`, `Battle`, `Collection`, `Fusion`.
- Aggiungi tutte le scene in Build Settings, in quest'ordine.
- Deliverable: la solution compila con 0 errori, 0 warning inaspettati.

### G2 — Bootstrap + navigazione
- Scena `Boot`: GameObject `[App]` con `AppBootstrap`.
- Assegna al Bootstrap i prefab (crea prefab vuoti con i rispettivi script: `GameManager`, `SaveSystem`, `QualityManager`, `SceneRouter`, `AudioManager`, `PackOpener`).
- Crea `SceneRouter` con `CanvasGroup` fader nero.
- Aggiungi `SafeAreaFitter` sul pannello principale di `MainMenu`, `Shop`, `Battle`.
- Deliverable: da Boot passa a MainMenu con fade; pulsante Shop apre Shop con fade; back torna a MainMenu.

### G3 — Battle scene setup
- Canvas `HUD_Dynamic` con label HP/Energia/Turno (TMP).
- GameObject `Board` con GridLayoutGroup 5x5, prefab `Cell` (Image + Button + BoardCell).
- GameObject `Hand` con HorizontalLayoutGroup, prefab `HandCard` (Image + Button + TMP child).
- Assegna `BattleManager` con starterCards (4-6 CardData iniziali), heroes (8 HeroData).
- Deliverable: puoi entrare in battle da HeroSelect, vedi la board 5x5 e la mano, i tap piazzano carte e attaccano.

### G4 — Status + IA
- Verifica che `StatusEngine.Tick` sia chiamato dal TurnController (già fatto nel codice).
- Assegna `SimpleUtilityAI` (già di default nel BattleManager).
- Testa: applica Bruciatura tramite un `ApplyStatusEffect` OnAttack a una CardData → verifica tick a fine turno.
- Deliverable: IA nemica esegue attacchi e movimenti in modo visibile, gli stati fanno danno visibile a fine turno.

### G5 — Effetti carta data-driven
- Crea in `Assets/ScriptableObjects/Effects/`:
  - `Effect_Burn.asset` (ApplyStatusEffect, OnAttack, Burn 1 stack 2 turni).
  - `Effect_Heal2.asset` (HealEffect, OnPlay, self, amount 2).
  - `Effect_AoE1.asset` (DamageEffect, OnPlay, aoeRadius 1, amount 1).
- Assegna gli effetti alle CardData rilevanti.
- Deliverable: 3+ carte con effetti diversi funzionano in gioco.

## Seconda settimana — meta, polish, ship

### G6 — Inventario + drop
- `PackOpener` è già collegato all'inventario via Services.
- Crea `ShopUI.rewardPopup` che mostra la lista carte pescate.
- Verifica che la scene Collection mostri `x2`, `x3` accanto alle carte owned.
- Deliverable: aprire un pacchetto aggiunge le carte alla collezione, i duplicati oltre cap 3 danno dust.

### G7 — Fusione UI
- Scena `Fusion` con FusionUI.
- Due bottoni Slot A / Slot B che aprono un mini-picker (lista scrollabile di CardInventory).
- Chance bar aggiornata in tempo reale.
- Deliverable: puoi fondere due carte owned, vedi la % di successo, il risultato viene aggiunto alla collection.

### G8 — Progressione + polish HUD
- Aggiungi `PlayerProgression.AddXp(50)` dentro `BattleManager.CheckEnd` on victory (via SaveSystem.RecordWin già presente).
- Nel MainMenu mostra XP bar + livello.
- Aggiungi popup LevelUp che ascolta `LevelUp` sul bus.
- Deliverable: vincere fa avanzare la barra XP, il level up mostra un popup.

### G9 — Audio + haptic + prewarm
- Registra clip audio nel prefab `AudioManager`.
- Assicurati che `FeedbackHub` sia in scena Battle (attivalo su un GameObject vuoto).
- Prewarm pool: in `BattleManager.BuildBoard` c'è già `prewarm = rows*cols`.
- Test su device reale: verifica frame rate e haptic effettivo.
- Deliverable: ogni attacco fa suono + vibrazione, la battle non ha spike GC visibili.

### G10 — Build APK + bug bash + onboarding
- Player Settings: Portrait, Company/Product name, package name, versione.
- Build APK release, installala sul device di riferimento.
- Onboarding: primo avvio → forced HeroSelect → forced Battle facile.
- Bug fix di priorità 1.
- Deliverable: APK stabile 30fps sul low-end, 60fps sul flagship, primo playthrough completo.

## Buffer / stretch

- Banner LiveOps `EventManager` sulla home.
- Battle Pass placeholder.
- Musica loop menu vs battle.
- Localizzazione IT/EN base (SO stringhe per key).

## Definition of Done — Vertical Slice

- 50 CardData popolate con stats e effects.
- 8 HeroData con abilità funzionanti.
- Loop: MainMenu → HeroSelect → Battle → Vittoria/Sconfitta → MainMenu → Shop → Pacchetto → Collection → Fusion → MainMenu.
- Progressione XP visibile, salva/carica.
- Nessun UnityEngine.Random nella logica (grep verifica).
- Nessuna violazione dei layer (ogni consumer va via `Services` o eventi).
- APK gira su device 4 GB RAM a 30fps senza freeze visibili.
