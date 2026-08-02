using UnityEngine;
using NexusFold.Battle;

namespace NexusFold.Data.Effects
{
    [CreateAssetMenu(fileName = "NewDamage", menuName = "NexusFold/Effects/Damage")]
    public class DamageEffect : CardEffect
    {
        [Header("Amount")]
        [Range(0, 30)] public int amount = 1;
        public bool scaleWithSourceAtk = false;

        [Header("Target")]
        public bool targetHero = false;
        public bool targetSelf = false;
        [Range(0, 4)] public int aoeRadius = 0;
        public bool hitAllies = false;

        public override void Execute(EffectContext ctx)
        {
            if (ctx.Battle == null) return;
            int dmg = amount + (scaleWithSourceAtk && ctx.Source != null ? ctx.Source.Atk : 0);
            if (dmg <= 0) return;

            if (targetHero)
            {
                bool toPlayer = ctx.Source != null ? !ctx.Source.IsPlayer : ctx.Battle.PlayerTurn == false;
                ctx.Battle.DealHeroDamage(toPlayer, dmg);
                return;
            }

            if (targetSelf && ctx.Source != null)
            {
                ctx.Battle.DealCardDamage(ctx.Source, dmg, ctx.Source);
                return;
            }

            if (aoeRadius <= 0)
            {
                if (ctx.Target != null) ctx.Battle.DealCardDamage(ctx.Target, dmg, ctx.Source);
                return;
            }

            foreach (var c in ctx.Battle.EnumerateOccupantsInRadius(ctx.Row, ctx.Col, aoeRadius, hitAllies))
                ctx.Battle.DealCardDamage(c, dmg, ctx.Source);
        }
    }
}
