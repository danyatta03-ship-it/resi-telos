using UnityEngine;
using NexusFold.Battle;
using NexusFold.Core;
using NexusFold.Core.Events;

namespace NexusFold.Data.Effects
{
    [CreateAssetMenu(fileName = "NewApplyStatus", menuName = "NexusFold/Effects/Apply Status")]
    public class ApplyStatusEffect : CardEffect
    {
        [Header("Target")]
        public bool targetSelf = false;
        public bool targetSource = false; // per OnHit: applica al source (contrattacco)
        [Range(0, 4)] public int aoeRadius = 0;
        public bool includeAllies = false;

        [Header("Status")]
        public StatusType status = StatusType.Burn;
        [Range(1, 10)] public int stacks = 1;
        [Range(-1, 10)] public int duration = 2;

        public override void Execute(EffectContext ctx)
        {
            if (ctx.Battle == null) return;

            if (targetSelf && ctx.Source != null) { Apply(ctx.Source, ctx.Battle); return; }
            if (targetSource && ctx.Source != null) { Apply(ctx.Source, ctx.Battle); return; }

            if (aoeRadius <= 0)
            {
                if (ctx.Target != null) Apply(ctx.Target, ctx.Battle);
                return;
            }

            foreach (var c in ctx.Battle.EnumerateOccupantsInRadius(ctx.Row, ctx.Col, aoeRadius, includeAllies))
                Apply(c, ctx.Battle);
        }

        void Apply(CardInstance c, IBattleContext battle)
        {
            if (c == null || !c.IsAlive) return;
            c.ApplyStatus(new StatusEffect(status, stacks, duration));
            if (battle.TryFindCoord(c, out int r, out int col))
                GameEvents.Publish(new StatusApplied(r, col, status, stacks));
        }
    }
}
