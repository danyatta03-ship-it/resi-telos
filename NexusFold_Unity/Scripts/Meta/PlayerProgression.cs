using NexusFold.Core.Events;

namespace NexusFold.Meta
{
    /// <summary>Curva XP: 100 al livello 1, +250 per ogni livello successivo. Cap 60.</summary>
    public static class ProgressionCurve
    {
        public const int MaxLevel = 60;

        public static int XpForLevel(int level)
        {
            if (level < 1) return 100;
            return 100 + (level - 1) * 250;
        }
    }

    /// <summary>
    /// Progressione lineare e prevedibile. Nessun paywall.
    /// Emette XpGained e LevelUp sul bus.
    /// </summary>
    public sealed class PlayerProgression
    {
        public int Level { get; private set; }
        public int Xp    { get; private set; }
        public int XpToNext { get { return ProgressionCurve.XpForLevel(Level); } }

        public PlayerProgression(int level, int xp)
        {
            Level = level < 1 ? 1 : level;
            Xp    = xp < 0 ? 0 : xp;
        }

        public void AddXp(int amount)
        {
            if (amount <= 0) return;
            Xp += amount;
            while (Xp >= XpToNext && Level < ProgressionCurve.MaxLevel)
            {
                Xp -= XpToNext;
                Level++;
                GameEvents.Publish(new LevelUp(Level));
            }
            if (Level >= ProgressionCurve.MaxLevel && Xp > XpToNext) Xp = XpToNext;
            GameEvents.Publish(new XpGained(amount, Xp, Level));
        }
    }
}
