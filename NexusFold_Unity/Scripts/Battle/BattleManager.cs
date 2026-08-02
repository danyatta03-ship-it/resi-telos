using UnityEngine;
using UnityEngine.UI;
using TMPro;
using System.Collections.Generic;
using NexusFold.Core;
using NexusFold.Core.Events;
using NexusFold.Core.Pooling;
using NexusFold.Core.Rng;
using NexusFold.Data;
using NexusFold.Data.Effects;

namespace NexusFold.Battle
{
    /// <summary>
    /// Coordinator della scena Battle:
    /// - implementa IBattleContext (dati + operazioni board);
    /// - possiede TurnController + IEnemyAI;
    /// - gestisce input tap-to-place / tap-to-move / tap-to-attack.
    ///
    /// Mantiene i callback pubblici del vecchio BattleManager
    /// (OnClickEndTurn / OnClickHeroAbility / OnClickBack) per non rompere i binding UI esistenti.
    /// </summary>
    public class BattleManager : MonoBehaviour, IBattleContext
    {
        [Header("Hero")]
        public HeroData[] heroes;
        public TextMeshProUGUI heroNameLabel;
        public TextMeshProUGUI heroHpLabel;
        public TextMeshProUGUI enemyHpLabel;
        public TextMeshProUGUI energyLabel;
        public TextMeshProUGUI turnLabel;

        [Header("Board")]
        public Transform boardParent;
        public GameObject cellPrefab;

        [Header("Hand")]
        public Transform handParent;
        public GameObject handCardPrefab;

        [Header("Card Pool")]
        public CardData[] starterCards;
        public CardData[] enemyStarterCards;

        [Header("Layout")]
        [Range(3, 8)] public int rows = 5;
        [Range(3, 8)] public int cols = 5;
        [Range(0, 4)] public int playerPlacementRows = 2;
        [Range(0, 4)] public int enemyPlacementRows  = 2;

        [Header("Rules")]
        [Range(3, 30)] public int startingHp = 20;
        [Range(0, 10)] public int startingEnergy = 1;
        [Range(1, 12)] public int maxEnergy = 10;
        [Range(1, 10)] public int startingHandSize = 5;

        [Header("Scene")]
        public string mainMenuSceneName = "MainMenu";

        BoardCell[,] _board;
        readonly List<CardInstance> _hand = new List<CardInstance>();
        int _selectedHand = -1;
        BoardCell _selectedCell;
        int _playerHp, _enemyHp, _energy, _turn = 1;
        HeroData _hero;
        bool _abilityUsed;
        bool _matchEnded;

        GameObjectPool _handPool;
        GameObjectPool _cellPool;

        TurnController _turnController;
        IRng _rng;

        public int Rows { get { return rows; } }
        public int Cols { get { return cols; } }
        public int Turn { get { return _turn; } }
        public bool PlayerTurn { get { return _turnController != null && _turnController.AwaitingInput; } }
        public int PlayerHp { get { return _playerHp; } }
        public int EnemyHp { get { return _enemyHp; } }
        public IRng Rng { get { return _rng; } }

        void Start()
        {
            _rng = Services.TryGet<IRng>(out var rng) ? rng : new DeterministicRng((ulong)System.DateTime.UtcNow.Ticks);

            ResolveHero();
            BuildBoard();
            DrawStarterHand();
            SpawnEnemyStartingUnits();

            _playerHp = _hero != null ? _hero.maxHP : startingHp;
            _enemyHp  = _hero != null ? Mathf.Max(startingHp, _hero.maxHP + 2) : startingHp + 2;
            _energy   = startingEnergy;

            var ai = new SimpleUtilityAI();
            _turnController = new TurnController(this, ai, this, OnPlayerTurnBegan);

            GameEvents.Publish(new MatchStarted(_rng.CurrentState));
            PublishAllHud();
            _turnController.BeginPlayerTurn();
        }

        void OnPlayerTurnBegan()
        {
            _abilityUsed = false;
            _energy = Mathf.Min(maxEnergy, _energy + 1);
            _turn++;
            GameEvents.Publish(new EnergyChanged(_energy, maxEnergy));
            RefreshTurnLabel();
        }

        void ResolveHero()
        {
            string id = GameManager.Instance != null ? GameManager.Instance.SelectedHeroId : "lumina";
            if (heroes != null)
            {
                for (int i = 0; i < heroes.Length; i++)
                    if (heroes[i] != null && heroes[i].heroId == id) { _hero = heroes[i]; break; }
            }
            if (_hero == null && heroes != null && heroes.Length > 0) _hero = heroes[0];
            if (heroNameLabel) heroNameLabel.text = _hero != null ? _hero.heroName : "Hero";
        }

        void BuildBoard()
        {
            _board = new BoardCell[rows, cols];
            if (boardParent == null || cellPrefab == null) return;

            if (_cellPool == null)
                _cellPool = new GameObjectPool(cellPrefab, prewarm: rows * cols, hardCap: rows * cols + 4, parkingName: "Pool[BoardCell]");

            _cellPool.ReturnAll(boardParent);

            for (int r = 0; r < rows; r++)
            {
                for (int c = 0; c < cols; c++)
                {
                    var go = _cellPool.Rent(boardParent);
                    var cell = go.GetComponent<BoardCell>();
                    if (cell == null) cell = go.AddComponent<BoardCell>();
                    cell.Setup(r, c);

                    int cr = r, cc = c;
                    var btn = go.GetComponent<Button>();
                    if (btn == null) btn = go.AddComponent<Button>();
                    btn.onClick.RemoveAllListeners();
                    btn.onClick.AddListener(delegate { OnCellClicked(cr, cc); });
                    _board[r, c] = cell;
                }
            }
        }

        void DrawStarterHand()
        {
            _hand.Clear();
            if (starterCards == null || starterCards.Length == 0) { RebuildHandUI(); return; }
            var pool = new List<CardData>(starterCards);
            for (int i = pool.Count - 1; i > 0; i--)
            {
                int j = _rng.Range(0, i + 1);
                var tmp = pool[i]; pool[i] = pool[j]; pool[j] = tmp;
            }
            int n = Mathf.Min(startingHandSize, pool.Count);
            for (int i = 0; i < n; i++) _hand.Add(new CardInstance(pool[i], true));
            RebuildHandUI();
        }

        void SpawnEnemyStartingUnits()
        {
            var pool = (enemyStarterCards != null && enemyStarterCards.Length > 0) ? enemyStarterCards : starterCards;
            if (pool == null || pool.Length == 0) return;

            int mid = cols / 2;
            var e1 = new CardInstance(pool[_rng.Range(0, pool.Length)], false);
            var e2 = new CardInstance(pool[_rng.Range(0, pool.Length)], false);
            TryPlace(e1, 0, Mathf.Max(0, mid - 1));
            TryPlace(e2, 0, Mathf.Min(cols - 1, mid + 1));
        }

        void RebuildHandUI()
        {
            if (handParent == null) return;
            if (_handPool == null && handCardPrefab != null)
                _handPool = new GameObjectPool(handCardPrefab, prewarm: startingHandSize + 2, hardCap: 32, parkingName: "Pool[HandCard]");

            if (_handPool != null) _handPool.ReturnAll(handParent);
            else
                for (int i = handParent.childCount - 1; i >= 0; i--)
                    Destroy(handParent.GetChild(i).gameObject);

            for (int i = 0; i < _hand.Count; i++)
            {
                int idx = i;
                GameObject go;
                if (_handPool != null) go = _handPool.Rent(handParent);
                else if (handCardPrefab != null) go = Instantiate(handCardPrefab, handParent);
                else
                {
                    go = new GameObject("HandCard", typeof(RectTransform), typeof(Image), typeof(Button));
                    go.transform.SetParent(handParent, false);
                }

                var btn = go.GetComponent<Button>();
                if (btn != null)
                {
                    btn.onClick.RemoveAllListeners();
                    btn.onClick.AddListener(delegate { OnHandClicked(idx); });
                }

                var tmp = go.GetComponentInChildren<TextMeshProUGUI>();
                if (tmp != null) tmp.text = _hand[i].Data.cardName + "\n" + _hand[i].Data.cost;
            }
        }

        public void OnHandClicked(int idx)
        {
            if (!PlayerTurn || _matchEnded) return;
            _selectedHand = _selectedHand == idx ? -1 : idx;
            _selectedCell = null;
            RefreshHints();
        }

        public void OnCellClicked(int r, int c)
        {
            if (!PlayerTurn || _matchEnded) return;
            if (r < 0 || r >= rows || c < 0 || c >= cols) return;
            var cell = _board[r, c];
            if (cell == null) return;

            if (_selectedHand >= 0 && cell.Occupant == null)
            {
                if (!IsPlayerPlacementRow(r)) return;
                var card = _hand[_selectedHand];
                if (_energy < card.Data.cost) return;

                _energy -= card.Data.cost;
                cell.Place(card);
                _hand.RemoveAt(_selectedHand);
                _selectedHand = -1;
                RunEffects(card, EffectTrigger.OnPlay, target: null, r, c);
                GameEvents.Publish(new CardPlayed(r, c, card.Data, byPlayer: true));
                GameEvents.Publish(new EnergyChanged(_energy, maxEnergy));

                RebuildHandUI();
                RefreshHints();
                return;
            }

            if (cell.Occupant != null && cell.Occupant.IsPlayer && !cell.Occupant.HasActedThisTurn)
            {
                _selectedCell = cell;
                _selectedHand = -1;
                RefreshHints();
                cell.SetHint(HintType.Selected);
                return;
            }

            if (_selectedCell != null)
            {
                var from = _selectedCell.Occupant;
                if (from == null) { _selectedCell = null; return; }

                int dist = Chebyshev(_selectedCell.row, _selectedCell.col, r, c);

                if (cell.Occupant != null && !cell.Occupant.IsPlayer && dist > 0 && dist <= from.Range)
                {
                    int dmg = DamageCalculator.ComputeAttackDamage(from, cell.Occupant);
                    int hpBefore = cell.Occupant.CurrentHp;
                    DealCardDamage(cell.Occupant, dmg, from);
                    int overkill = dmg > hpBefore ? dmg - hpBefore : 0;
                    GameEvents.Publish(new AttackResolved(_selectedCell.row, _selectedCell.col, r, c, dmg, overkill));
                    from.HasActedThisTurn = true;
                    _selectedCell = null;
                    RefreshHints();
                    return;
                }

                if (cell.Occupant == null && from.CanMove() && dist > 0 && dist <= from.Speed && ColumnPathClear(_selectedCell.row, _selectedCell.col, r, c))
                {
                    if (MoveOccupant(_selectedCell.row, _selectedCell.col, r, c))
                    {
                        from.HasActedThisTurn = true;
                        _selectedCell = null;
                        RefreshHints();
                    }
                }
            }
        }

        bool ColumnPathClear(int fr, int fc, int tr, int tc)
        {
            if (fr != tr && fc != tc) return true;
            int stepR = tr == fr ? 0 : (tr > fr ? 1 : -1);
            int stepC = tc == fc ? 0 : (tc > fc ? 1 : -1);
            int r = fr + stepR, c = fc + stepC;
            int guard = 0;
            while ((r != tr || c != tc) && guard++ < 32)
            {
                if (_board[r, c] != null && _board[r, c].Occupant != null) return false;
                r += stepR; c += stepC;
            }
            return true;
        }

        void RunEffects(CardInstance source, EffectTrigger trigger, CardInstance target, int row, int col)
        {
            if (source == null || source.Data == null || source.Data.effects == null) return;
            for (int i = 0; i < source.Data.effects.Length; i++)
            {
                var eff = source.Data.effects[i];
                if (eff == null || eff.trigger != trigger) continue;
                eff.Execute(new EffectContext(this, source, target, row, col));
            }
        }

        void RefreshHints()
        {
            if (_board == null) return;
            for (int r = 0; r < rows; r++)
                for (int c = 0; c < cols; c++)
                    if (_board[r, c] != null) _board[r, c].ClearHints();

            if (_selectedHand >= 0)
            {
                for (int r = 0; r < rows; r++)
                {
                    if (!IsPlayerPlacementRow(r)) continue;
                    for (int c = 0; c < cols; c++)
                        if (_board[r, c] != null && _board[r, c].Occupant == null)
                            _board[r, c].SetHint(HintType.Placement);
                }
            }
            else if (_selectedCell != null && _selectedCell.Occupant != null)
            {
                _selectedCell.SetHint(HintType.Selected);
                var unit = _selectedCell.Occupant;
                for (int r = 0; r < rows; r++)
                {
                    for (int c = 0; c < cols; c++)
                    {
                        if (_board[r, c] == null || (_selectedCell.row == r && _selectedCell.col == c)) continue;
                        int dist = Chebyshev(_selectedCell.row, _selectedCell.col, r, c);
                        var occ = _board[r, c].Occupant;
                        if (occ != null && !occ.IsPlayer && dist <= unit.Range && dist > 0)
                            _board[r, c].SetHint(HintType.Attack);
                        else if (occ == null && unit.CanMove() && dist <= unit.Speed && dist > 0 && ColumnPathClear(_selectedCell.row, _selectedCell.col, r, c))
                            _board[r, c].SetHint(HintType.Move);
                    }
                }
            }
        }

        public void OnClickEndTurn()
        {
            if (_matchEnded || _turnController == null) return;
            if (!_turnController.AwaitingInput) return;
            _selectedCell = null;
            _selectedHand = -1;
            RefreshHints();
            _turnController.EndPlayerTurn();
        }

        public void OnClickHeroAbility()
        {
            if (_matchEnded || _hero == null || _abilityUsed) return;
            if (!PlayerTurn) return;
            if (_energy < _hero.abilityCost) return;

            _energy -= _hero.abilityCost;
            _abilityUsed = true;
            GameEvents.Publish(new EnergyChanged(_energy, maxEnergy));

            switch (_hero.abilityId)
            {
                case "heal":
                    HealHero(true, 5);
                    break;
                case "burn_aoe":
                case "burn":
                    for (int r = 0; r < rows; r++)
                        for (int c = 0; c < cols; c++)
                        {
                            var o = _board[r, c] != null ? _board[r, c].Occupant : null;
                            if (o != null && !o.IsPlayer)
                            {
                                o.ApplyStatus(new StatusEffect(StatusType.Burn, 1, 2));
                                GameEvents.Publish(new StatusApplied(r, c, StatusType.Burn, 1));
                                RefreshCell(r, c);
                            }
                        }
                    break;
                case "drain":
                    DealHeroDamage(false, 2);
                    HealHero(true, 2);
                    break;
                default:
                    DealHeroDamage(false, 3);
                    break;
            }
        }

        public void OnClickBack()
        {
            if (Services.TryGet<SceneRouter>(out var router)) router.Go(mainMenuSceneName);
            else if (GameManager.Instance != null) GameManager.Instance.LoadScene(mainMenuSceneName);
        }

        // IBattleContext ─────────────────────────────────────────
        public CardInstance GetOccupant(int row, int col)
        {
            if (_board == null || row < 0 || row >= rows || col < 0 || col >= cols) return null;
            return _board[row, col] != null ? _board[row, col].Occupant : null;
        }

        public bool TryPlace(CardInstance card, int row, int col)
        {
            if (_board == null || row < 0 || row >= rows || col < 0 || col >= cols) return false;
            var cell = _board[row, col];
            if (cell == null || cell.Occupant != null) return false;
            cell.Place(card);
            return true;
        }

        public bool MoveOccupant(int fromR, int fromC, int toR, int toC)
        {
            if (_board == null) return false;
            if (fromR < 0 || fromR >= rows || fromC < 0 || fromC >= cols) return false;
            if (toR   < 0 || toR   >= rows || toC   < 0 || toC   >= cols) return false;
            var fromCell = _board[fromR, fromC];
            var toCell   = _board[toR, toC];
            if (fromCell == null || toCell == null || fromCell.Occupant == null || toCell.Occupant != null) return false;
            var unit = fromCell.Occupant;
            fromCell.Clear();
            toCell.Place(unit);
            GameEvents.Publish(new UnitMoved(fromR, fromC, toR, toC));
            return true;
        }

        public void DealHeroDamage(bool toPlayer, int amount)
        {
            if (amount <= 0 || _matchEnded) return;
            if (toPlayer)
            {
                _playerHp = Mathf.Max(0, _playerHp - amount);
                GameEvents.Publish(new HeroHpChanged(true, _playerHp, -amount));
                if (heroHpLabel) heroHpLabel.text = _playerHp.ToString();
            }
            else
            {
                _enemyHp = Mathf.Max(0, _enemyHp - amount);
                GameEvents.Publish(new HeroHpChanged(false, _enemyHp, -amount));
                if (enemyHpLabel) enemyHpLabel.text = _enemyHp.ToString();
            }
            CheckEnd();
        }

        public void DealCardDamage(CardInstance target, int amount, CardInstance source)
        {
            if (target == null || amount <= 0 || !target.IsAlive) return;
            target.CurrentHp -= amount;
            if (target.CurrentHp < 0) target.CurrentHp = 0;

            int r, c;
            if (TryFindCoord(target, out r, out c))
            {
                if (target.CurrentHp <= 0)
                {
                    RunEffects(target, EffectTrigger.OnDeath, source, r, c);
                    _board[r, c].Clear();
                }
                else
                {
                    RunEffects(target, EffectTrigger.OnHit, source, r, c);
                    RefreshCell(r, c);
                }
            }
        }

        public IEnumerable<CardInstance> EnumerateOccupantsInRadius(int row, int col, int radius, bool includeAllies)
        {
            if (_board == null) yield break;
            for (int r = 0; r < rows; r++)
            {
                for (int c = 0; c < cols; c++)
                {
                    var cell = _board[r, c];
                    if (cell == null || cell.Occupant == null) continue;
                    int d = Chebyshev(row, col, r, c);
                    if (d > radius) continue;
                    yield return cell.Occupant;
                }
            }
        }

        public bool TryFindCoord(CardInstance card, out int row, out int col)
        {
            row = -1; col = -1;
            if (_board == null || card == null) return false;
            for (int r = 0; r < rows; r++)
                for (int c = 0; c < cols; c++)
                    if (_board[r, c] != null && _board[r, c].Occupant == card) { row = r; col = c; return true; }
            return false;
        }

        void HealHero(bool player, int amount)
        {
            if (player)
            {
                int cap = _hero != null ? _hero.maxHP : startingHp;
                int newHp = Mathf.Min(cap, _playerHp + amount);
                int delta = newHp - _playerHp;
                _playerHp = newHp;
                GameEvents.Publish(new HeroHpChanged(true, _playerHp, delta));
                if (heroHpLabel) heroHpLabel.text = _playerHp.ToString();
            }
        }

        bool IsPlayerPlacementRow(int r) { return r >= rows - playerPlacementRows; }

        static int Chebyshev(int r1, int c1, int r2, int c2)
        {
            int dr = r1 - r2; if (dr < 0) dr = -dr;
            int dc = c1 - c2; if (dc < 0) dc = -dc;
            return dr > dc ? dr : dc;
        }

        void RefreshCell(int r, int c)
        {
            if (_board != null && _board[r, c] != null) _board[r, c].Refresh();
        }

        void RefreshTurnLabel()
        {
            if (turnLabel) turnLabel.text = "TURNO " + _turn + " - " + (PlayerTurn ? "Il tuo turno" : "Nemico");
        }

        void PublishAllHud()
        {
            if (heroHpLabel)  heroHpLabel.text  = _playerHp.ToString();
            if (enemyHpLabel) enemyHpLabel.text = _enemyHp.ToString();
            if (energyLabel)  energyLabel.text  = _energy + "/" + maxEnergy;
            RefreshTurnLabel();
            GameEvents.Publish(new EnergyChanged(_energy, maxEnergy));
        }

        void CheckEnd()
        {
            if (_matchEnded) return;
            if (_playerHp <= 0)
            {
                _matchEnded = true;
                GameEvents.Publish(new MatchEnded(false, _turn));
                Save.SaveSystem save;
                if (Services.TryGet<Save.SaveSystem>(out save)) save.RecordLoss();
                SceneRouter router;
                if (Services.TryGet<SceneRouter>(out router)) router.Go(mainMenuSceneName);
                else if (GameManager.Instance != null) GameManager.Instance.LoadScene(mainMenuSceneName);
            }
            else if (_enemyHp <= 0)
            {
                _matchEnded = true;
                GameEvents.Publish(new MatchEnded(true, _turn));
                if (GameManager.Instance != null) { GameManager.Instance.AddGold(40); GameManager.Instance.AddGems(5); }
                Save.SaveSystem save;
                if (Services.TryGet<Save.SaveSystem>(out save)) save.RecordWin();
                SceneRouter router;
                if (Services.TryGet<SceneRouter>(out router)) router.Go(mainMenuSceneName);
                else if (GameManager.Instance != null) GameManager.Instance.LoadScene(mainMenuSceneName);
            }
        }
    }
}
