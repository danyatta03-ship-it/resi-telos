# Nexus Fold — Architettura (v2)

Documento vivo. Descrive la baseline dopo l'uplift architetturale.

## Layer

```
Bootstrap
   AppBootstrap   → istanzia + registra tutti i service, poi Go(firstScene)

Core
   Services       → service locator minimale (Register / Get / TryGet)
   Events/        → GameEvents (bus tipizzato) + GameSignals (catalogo eventi)
   Rng/           → IRng + DeterministicRng (xoroshiro128**), zero UnityEngine.Random nella logica
   Pooling/       → GameObjectPool riutilizzabile (mano, board, collection)
   Feedback/      → HapticService, VfxBudget
   SceneRouter    → LoadSceneAsync + fade in/out
   QualityManager → tier auto-detect, ApplyBudget(ParticleSystem)
   GameManager    → valute, publish CurrencyChanged
   StatusEffect   → enum Bruciatura/Annegamento/... + calcolo bonus
   BootLoader     → legacy, mantenuto per compat

Data
   CardData       → +cardId, +CardEffect[], validazione OnValidate
   HeroData       → invariato
   Effects/
      CardEffect          (base)
      ApplyStatusEffect   (Burn/Corrosion/Shield ecc., AoE, self, target)
      DamageEffect        (single/AoE, hero-target, scale ATK)
      HealEffect          (self/allied, AoE)

Battle
   IBattleContext   → astrazione ai/tick/effetti
   CardInstance     → runtime istanza carta (out di BoardCell)
   BoardCell        → pura view + hint (Move/Attack/Placement/Selected)
   BattleManager    → implementa IBattleContext, gestisce input + HUD
   TurnController   → Player → StatusTick → Enemy → StatusTick loop
   StatusEngine     → applica danno stato e decadimento a fine turno
   DamageCalculator → formula ufficiale (fix double counting)
   AI/
      IEnemyAI          (interfaccia)
      SimpleUtilityAI   (score lethal + threat + rarity, path clear check)

Fusion
   FusionResolver   → chance da DNA, RNG deterministico, publish FusionResolved
   FusionSystem     → legacy wrapper, deprecato

Economy
   PackOpener       → IRng + ICardCatalog + inventario auto-push, dust da duplicati

Meta
   PlayerProgression → curva XP + LevelUp events
   CardInventory     → dict cardId → count, cap 3
   DustEconomy       → tabella dust/craft cost per rarità
   ICardCatalog + StaticCardCatalog

Save
   SaveSystem      → JSON atomic write, migrazione ownedCardIds → cardCounts

Audio
   AudioManager    → music/sfx (invariato)

Network
   MatchmakingStub → coroutine handle dedicata, no StopAllCoroutines

LiveOps
   EventManager    → date parsing InvariantCulture

UI
   MainMenuUI      → subscribe eventi, TMP-only
   ShopUI          → chiama PackOpener, mostra rewards
   HeroSelectUI    → invariato core, TMP-only
   CollectionUI    → pool + inventory count
   FusionUI        → nuova, slot A/B + probabilità dinamica
   SafeAreaFitter  → auto-adatta a notch
   FeedbackHub     → audio + haptic driven da eventi
```

## Regole d'oro

1. **Mai `UnityEngine.Random` nella logica.** Usa `Services.Get<IRng>()` o passalo come parametro.
2. **UI si iscrive al bus, non chiama singleton in Update.** Vedi `MainMenuUI` / `ShopUI`.
3. **Effetti carta = ScriptableObject.** Aggiungi un nuovo effetto = nuovo file + `[CreateAssetMenu]`, zero switch.
4. **View pura.** `BoardCell` non tocca lo stato di battle. La business logic sta in `BattleManager`+`TurnController`.
5. **`SceneRouter.Go` è l'unica via per cambiare scena.**
6. **Un ParticleSystem "importante" deve avere `VfxBudget` sulla root.**
7. **`SaveSystem.Save` è atomico** (temp file + rename): non lascia mai un JSON parziale sul disco.

## Come aggiungere una nuova carta con effetto

1. Create → NexusFold → Card Data → riempi statiche (attack/health/cost/faction/rarity).
2. Compila `cardId` (kebab-case unico) oppure lascia auto-generare dal filename.
3. Create → NexusFold → Effects → Apply Status / Damage / Heal, configura.
4. Trascina l'effetto nell'array `effects` della CardData.
5. In battle, `BattleManager.OnCellClicked` chiamerà `RunEffects(card, EffectTrigger.OnPlay, ...)` automaticamente al piazzamento.

## Come aggiungere un nuovo evento sul bus

1. `Core/Events/GameSignals.cs` → aggiungi `public readonly struct MyEvent : IGameEvent { ... }`.
2. Emettilo con `GameEvents.Publish(new MyEvent(...))`.
3. Ascoltalo: `_sub = GameEvents.Subscribe<MyEvent>(OnMy); ... void OnDisable() { _sub.Dispose(); }`.

## Come cambiare l'IA

1. Implementa `IEnemyAI` in un nuovo file.
2. Sostituisci in `BattleManager.Start`: `var ai = new SimpleUtilityAI();` → la tua IA.
3. Facoltativo: registra come service e prendila da lì per configurabilità.
