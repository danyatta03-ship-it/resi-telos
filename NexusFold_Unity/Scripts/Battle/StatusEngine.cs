using NexusFold.Core;
using NexusFold.Core.Events;

namespace NexusFold.Battle
{
    /// <summary>
    /// Applica il tick degli status effect a fine turno del proprietario.
    /// Brucia/Annega infliggono danno, tutti scalano la duration.
    /// Uno stack a duration 0 viene rimosso.
    /// </summary>
    public static class StatusEngine
    {
        public static void Tick(IBattleContext ctx, bool ownerIsPlayer)
        {
            if (ctx == null) return;
            for (int r = 0; r < ctx.Rows; r++)
            {
                for (int c = 0; c < ctx.Cols; c++)
                {
                    var occ = ctx.GetOccupant(r, c);
                    if (occ == null || occ.IsPlayer != ownerIsPlayer) continue;
                    TickOne(ctx, occ, r, c);
                }
            }
        }

        static void TickOne(IBattleContext ctx, CardInstance card, int row, int col)
        {
            // Iterazione reverse per rimozioni sicure
            for (int i = card.Statuses.Count - 1; i >= 0; i--)
            {
                var s = card.Statuses[i];
                if (s == null) { card.Statuses.RemoveAt(i); continue; }

                int dmg = s.GetDamagePerTurn();
                if (dmg > 0)
                {
                    ctx.DealCardDamage(card, dmg, source: null);
                    GameEvents.Publish(new StatusTicked(row, col, s.type, dmg));
                }
                if (s.duration > 0)
                {
                    s.duration--;
                    if (s.duration <= 0) card.Statuses.RemoveAt(i);
                }
            }
            card.HasActedThisTurn = false;
        }
    }
}
