using NexusFold.Core;
using NexusFold.Core.Rng;
using NexusFold.Data;

namespace NexusFold.Fusion
{
    /// <summary>
    /// Wrapper backwards-compat con la vecchia API statica.
    /// Deprecated in favore di FusionResolver.
    /// </summary>
    public static class FusionSystem
    {
        public static float GetSuccessChance(CardData a, CardData b)
        {
            return FusionResolver.ChanceOf(a, b);
        }

        public static CardData CreateFusionResult(CardData a, CardData b)
        {
            IRng rng;
            if (!Services.TryGet<IRng>(out rng)) rng = new DeterministicRng(1);
            CardData result;
            FusionResolver.TryFuse(a, b, rng, out result);
            return result;
        }

        public static bool TryFuse(CardData a, CardData b, out CardData result)
        {
            IRng rng;
            if (!Services.TryGet<IRng>(out rng)) rng = new DeterministicRng((ulong)System.DateTime.UtcNow.Ticks);
            return FusionResolver.TryFuse(a, b, rng, out result);
        }
    }
}
