# NEXUS FOLD — Setup Minimo Unity
Fai SOLO questi passaggi. Tutto il resto è già pronto nei file.

## 1. Crea il progetto (2 minuti)
1. Apri Unity Hub
2. New Project → **2D (URP)** oppure **3D (URP)** (consigliato URP)
3. Nome: `NexusFold`
4. Editor: Unity 2022.3 LTS o 6000.x

## 2. Copia i file (1 minuto)
Copia l’intera cartella `Scripts` e `ScriptableObjects` dentro:
`Assets/`

Struttura finale:
```
Assets/
  Scripts/
    Core/
    UI/
    Battle/
    Data/
  ScriptableObjects/
```

## 3. Importa le immagini (2 minuti)
1. Crea cartella `Assets/Art/UI/`
2. Trascina dentro:
   - l’immagine del **Menu** (quella con il portale)
   - l’immagine del **Negozio** (quella con i pacchetti)
3. Seleziona ogni immagine → Inspector:
   - Texture Type: **Sprite (2D and UI)**
   - Apply

## 4. Crea le Scene (3 minuti)
Crea queste scene vuote in `Assets/Scenes/`:
- `Boot`
- `MainMenu`
- `Shop`
- `HeroSelect`
- `Battle`

Apri **File → Build Settings** e aggiungi tutte le scene in quest’ordine:
0. Boot
1. MainMenu
2. Shop
3. HeroSelect
4. Battle

## 5. Setup MainMenu (il più importante – 5 minuti)
1. Apri scena `MainMenu`
2. Crea UI:
   - Tasto destro Hierarchy → UI → **Canvas**
   - Canvas Scaler: Scale With Screen Size, Reference 1080×1920 (portrait)
3. Dentro Canvas crea **Raw Image** o **Image**:
   - Chiama `Background`
   - Stretch a tutto schermo
   - Assegna lo **Sprite/Texture del Menu**
4. Crea 5 bottoni **invisibili** (Image con Color alpha = 0) e posizionali esattamente sopra:
   - GIOCA
   - Collezione
   - Negozio
   - Clan
   - Profilo
5. Aggiungi lo script `MainMenuUI.cs` al Canvas (o a un GameObject vuoto “UI”)
6. Collega i bottoni ai metodi pubblici dello script (OnClick)

## 6. Setup Negozio (3 minuti)
Stessa cosa:
- Sfondo = immagine Negozio
- Bottoni invisibili sopra ogni pacchetto
- Script `ShopUI.cs`

## 7. Premi Play
Se hai collegato i bottoni correttamente, la navigazione funziona già.

---

## Cosa NON devi fare
- Non riscrivere la logica
- Non cambiare i nomi degli script
- Non creare sistemi nuovi

## Prossimi passi (dopo che il menu funziona)
1. HeroSelect funzionante
2. Battle base
3. Import carte DRAKONAR
4. Animazioni pacchetti

Quando il menu e il negozio aprono le scene giuste, dimmelo e ti do il pezzo successivo già pronto.

---

## FASE 2 — Dopo che Menu e Shop funzionano

### HeroSelect
1. Crea scena HeroSelect
2. Canvas + griglia (Grid Layout Group)
3. Aggiungi `HeroSelectUI`
4. Crea 8 HeroData (Assets → Create → NexusFold → Hero Data)
5. Assegna i 8 HeroData all'array `heroes` dello script
6. Bottone "Inizia Battaglia" → OnClickStartBattle
7. Bottone Indietro → OnClickBack

### Battle
1. Canvas
2. Testi HP / Energia / Turno
3. GameObject vuoto "Board" con Grid Layout 5x5
4. Prefab Cellula (Image + BoardCell.cs + Button)
5. Prefab HandCard (Image + Button + Text)
6. Aggiungi `BattleManager`
7. Assegna boardParent, cellPrefab, handParent, handCardPrefab
8. Crea qualche CardData e mettili in starterCards
9. Bottoni: Fine Turno, Abilità, Esci

### CardData
Assets → Create → NexusFold → Card Data
Compila nome, costo, atk, hp, faction, abilityText.
