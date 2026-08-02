using UnityEngine;
using NexusFold.Battle;

namespace NexusFold.Data.Effects
{
    [CreateAssetMenu(fileName = "NewHeal", menuName = "NexusFold/Effects/Heal")]
    public class HealEffect : CardEffect
    {
        [Range(0, 30)] public int amount = 1;
        public bool healSelf = true;
        [Range(0, 4)] public int aoeRadius = 0;
        public bool alliesOnly = true;

        public override void Execute(EffectContext ctx)
        {
            if (amount <= 0 || ctx.Battle == null) return;

            if (healSelf && ctx.Source != null) { HealOne(ctx.Source); return; }

            if (aoeRadius <= 0)
            {
                if (ctx.Target != null) HealOne(ctx.Target);
                return;
            }

            foreach (var c in ctx.Battle.EnumerateOccupantsInRadius(ctx.Row, ctx.Col, aoeRadius, includeAllies: alliesOnly))
            {
                if (alliesOnly && ctx.Source != null && c.IsPlayer != ctx.Source.IsPlayer) continue;
                HealOne(c);
            }
        }

        void HealOne(CardInstance c)
        {
            if (c == null || !c.IsAlive) return;
            int newHp = c.CurrentHp + amount;
            c.CurrentHp = newHp > c.MaxHp ? c.MaxHp : newHp;
        }
    }
}
