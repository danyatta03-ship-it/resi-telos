using NexusFold.Data;

namespace NexusFold.Core.Events
{
    // ── Economy / Meta ────────────────────────────────────────────
    public readonly struct CurrencyChanged : IGameEvent
    {
        public readonly int Gold, Gems;
        public CurrencyChanged(int gold, int gems) { Gold = gold; Gems = gems; }
    }

    public readonly struct XpGained : IGameEvent
    {
        public readonly int Amount, NewXp, NewLevel;
        public XpGained(int a, int x, int l) { Amount = a; NewXp = x; NewLevel = l; }
    }

    public readonly struct LevelUp : IGameEvent
    {
        public readonly int NewLevel;
        public LevelUp(int l) { NewLevel = l; }
    }

    public readonly struct CardAcquired : IGameEvent
    {
        public readonly string CardId;
        public readonly bool WasDuplicate;
        public readonly int DustEarned;
        public CardAcquired(string id, bool dupe, int dust) { CardId = id; WasDuplicate = dupe; DustEarned = dust; }
    }

    // ── Battle ────────────────────────────────────────────────────
    public readonly struct MatchStarted : IGameEvent
    {
        public readonly ulong Seed;
        public MatchStarted(ulong seed) { Seed = seed; }
    }

    public readonly struct TurnStarted : IGameEvent
    {
        public readonly int Turn;
        public readonly bool PlayerTurn;
        public TurnStarted(int t, bool p) { Turn = t; PlayerTurn = p; }
    }

    public readonly struct TurnEnded : IGameEvent
    {
        public readonly int Turn;
        public readonly bool PlayerTurn;
        public TurnEnded(int t, bool p) { Turn = t; PlayerTurn = p; }
    }

    public readonly struct CardPlayed : IGameEvent
    {
        public readonly int Row, Col;
        public readonly CardData Data;
        public readonly bool ByPlayer;
        public CardPlayed(int r, int c, CardData d, bool byPlayer) { Row = r; Col = c; Data = d; ByPlayer = byPlayer; }
    }

    public readonly struct UnitMoved : IGameEvent
    {
        public readonly int FromR, FromC, ToR, ToC;
        public UnitMoved(int fr, int fc, int tr, int tc) { FromR = fr; FromC = fc; ToR = tr; ToC = tc; }
    }

    public readonly struct AttackResolved : IGameEvent
    {
        public readonly int FromR, FromC, ToR, ToC, Damage, Overkill;
        public AttackResolved(int fr, int fc, int tr, int tc, int d, int o)
        { FromR = fr; FromC = fc; ToR = tr; ToC = tc; Damage = d; Overkill = o; }
    }

    public readonly struct HeroHpChanged : IGameEvent
    {
        public readonly bool IsPlayer;
        public readonly int NewValue, Delta;
        public HeroHpChanged(bool p, int v, int d) { IsPlayer = p; NewValue = v; Delta = d; }
    }

    public readonly struct EnergyChanged : IGameEvent
    {
        public readonly int Value, Max;
        public EnergyChanged(int v, int m) { Value = v; Max = m; }
    }

    public readonly struct StatusApplied : IGameEvent
    {
        public readonly int Row, Col;
        public readonly StatusType Type;
        public readonly int Stacks;
        public StatusApplied(int r, int c, StatusType t, int s) { Row = r; Col = c; Type = t; Stacks = s; }
    }

    public readonly struct StatusTicked : IGameEvent
    {
        public readonly int Row, Col;
        public readonly StatusType Type;
        public readonly int DamageDealt;
        public StatusTicked(int r, int c, StatusType t, int d) { Row = r; Col = c; Type = t; DamageDealt = d; }
    }

    public readonly struct MatchEnded : IGameEvent
    {
        public readonly bool Victory;
        public readonly int TurnsPlayed;
        public MatchEnded(bool v, int t) { Victory = v; TurnsPlayed = t; }
    }

    // ── Fusion ────────────────────────────────────────────────────
    public readonly struct FusionResolved : IGameEvent
    {
        public readonly CardData A, B, Result;
        public readonly bool Success;
        public readonly float Chance;
        public FusionResolved(CardData a, CardData b, CardData r, bool s, float c)
        { A = a; B = b; Result = r; Success = s; Chance = c; }
    }

    // ── UI / Nav ──────────────────────────────────────────────────
    public readonly struct SceneTransitionStarted : IGameEvent
    {
        public readonly string Target;
        public SceneTransitionStarted(string t) { Target = t; }
    }

    public readonly struct SceneTransitionEnded : IGameEvent
    {
        public readonly string Target;
        public SceneTransitionEnded(string t) { Target = t; }
    }
}
