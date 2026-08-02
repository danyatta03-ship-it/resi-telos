using UnityEngine;
using NexusFold.Core.Events;
using NexusFold.Core.Rng;
using NexusFold.Data;

namespace NexusFold.Fusion
{
    /// <summary>
    /// Sistema di fusione deterministico.
    /// Chance calcolata da DNA (peso, aggressività, intelligenza, rareGene, fazione, tipo).
    /// L'unico consumatore di RNG è IRng — mai UnityEngine.Random.
    /// Emette FusionResolved sul bus per l'UI/animazioni.
    /// </summary>
    public static class FusionResolver
    {
        public static float ChanceOf(CardData a, CardData b)
        {
            if (a == null || b == null) return 0f;

            float score = 0f;
            score += a.faction == b.faction ? 35f : -15f;
            int aggrDiff = Mathf.Abs(a.aggression - b.aggression);
            if (aggrDiff <= 20) score += 10f;
            int intDiff = Mathf.Abs(a.intelligence - b.intelligence);
            if (intDiff <= 15) score += 8f;
            score += (a.rareGene + b.rareGene) * 0.15f;
            if (a.cardType == b.cardType) score += 10f;

            score = Mathf.Clamp(score, 0f, 100f);

            if (score < 30f) return 0.20f;
            if (score < 50f) return 0.45f;
            if (score < 70f) return 0.65f;
            if (score < 85f) return 0.80f;
            return 0.95f;
        }

        public static bool TryFuse(CardData a, CardData b, IRng rng, out CardData result)
        {
            result = null;
            if (a == null || b == null || rng == null) return false;

            float chance = ChanceOf(a, b);
            bool success = rng.Chance(chance);
            if (success) result = Build(a, b);

            GameEvents.Publish(new FusionResolved(a, b, result, success, chance));
            return success;
        }

        static CardData Build(CardData a, CardData b)
        {
            var r = ScriptableObject.CreateInstance<CardData>();
            string aName = string.IsNullOrEmpty(a.cardName) ? "Fusion" : a.cardName.Split(' ')[0];
            r.cardId   = "fus-" + SafeId(a.cardId) + "-" + SafeId(b.cardId) + "-" + System.DateTime.UtcNow.Ticks.ToString("x");
            r.cardName = aName + " Prime";
            r.subtitle = "Fusione";
            r.faction  = a.faction;
            r.rarity   = (CardRarity)Mathf.Min((int)a.rarity + 1, (int)CardRarity.Nexus);
            r.cardType = CardType.Creature;
            r.cost     = Mathf.Min(9, Mathf.CeilToInt((a.cost   + b.cost)   * 0.65f));
            r.attack   = Mathf.CeilToInt((a.attack + b.attack) * 0.7f);
            r.health   = Mathf.CeilToInt((a.health + b.health) * 0.7f);
            r.speed    = Mathf.Max(a.speed, b.speed);
            r.range    = Mathf.Max(a.range, b.range);
            r.artwork  = a.artwork != null ? a.artwork : b.artwork;
            r.frame    = a.frame   != null ? a.frame   : b.frame;

            r.weight       = (a.weight + b.weight) / 2;
            r.intelligence = (a.intelligence + b.intelligence) / 2;
            r.aggression   = (a.aggression   + b.aggression)   / 2;
            r.rareGene     = Mathf.Min(100, Mathf.Max(a.rareGene, b.rareGene) + 5);

            r.abilityText  = CombineAbility(a.abilityText, b.abilityText);
            r.effectId     = string.IsNullOrEmpty(a.effectId) ? b.effectId : a.effectId;

            return r;
        }

        static string SafeId(string id)
        {
            return string.IsNullOrEmpty(id) ? "x" : id;
        }

        static string CombineAbility(string a, string b)
        {
            if (string.IsNullOrEmpty(a)) return b ?? "";
            if (string.IsNullOrEmpty(b)) return a ?? "";
            return a + " + " + b;
        }
    }
}
