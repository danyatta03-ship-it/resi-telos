using System.Collections.Generic;
using NexusFold.Core.Rng;

namespace NexusFold.Battle
{
    /// <summary>
    /// Astrazione della partita per IA, effetti, tick.
    /// Permette test unit senza MonoBehaviour e senza scene.
    /// </summary>
    public interface IBattleContext
    {
        int Rows { get; }
        int Cols { get; }
        int Turn { get; }
        bool PlayerTurn { get; }
        int PlayerHp { get; }
        int EnemyHp { get; }
        IRng Rng { get; }

        CardInstance GetOccupant(int row, int col);
        bool TryPlace(CardInstance card, int row, int col);
        bool MoveOccupant(int fromR, int fromC, int toR, int toC);
        void DealHeroDamage(bool toPlayer, int amount);
        void DealCardDamage(CardInstance target, int amount, CardInstance source);
        IEnumerable<CardInstance> EnumerateOccupantsInRadius(int row, int col, int radius, bool includeAllies);
        bool TryFindCoord(CardInstance card, out int row, out int col);
    }
}
