using UnityEngine;
using System.Collections.Generic;
using NexusFold.Core;
using NexusFold.Core.Events;
using NexusFold.Core.Rng;
using NexusFold.Data;
using NexusFold.Meta;

namespace NexusFold.Economy
{
    public enum PackType
    {
        Basic, Rare, Epic, Legendary, Mythic, Event, Fusion, Boss
    }

    [System.Serializable]
    public class PackConfig
    {
        public PackType type;
        public string displayName;
        public int goldCost;
        public int gemCost;
        public int cardCount = 3;
        public CardRarity guaranteedMinRarity = CardRarity.Common;
    }

    /// <summary>
    /// Roll rarità + spesa valuta + push in CardInventory. Determinismo via IRng.
    /// Non usa mai UnityEngine.Random.
    /// </summary>
    public class PackOpener : MonoBehaviour
    {
        public static PackOpener Instance { get; private set; }

        [Header("Card Database (fallback se ICardCatalog non registrato)")]
        public CardData[] allCards;

        [Header("Pack Configs")]
        public PackConfig[] packs;

        void Awake()
        {
            if (Instance != null && Instance != this) { Destroy(gameObject); return; }
            Instance = this;
        }

        public bool TryOpenPack(PackType type, out List<CardData> rewards)
        {
            rewards = new List<CardData>();
            var cfg = GetConfig(type);
            if (cfg == null) return false;

            if (cfg.goldCost > 0 && (GameManager.Instance == null || !GameManager.Instance.SpendGold(cfg.goldCost))) return false;
            if (cfg.gemCost  > 0 && (GameManager.Instance == null || !GameManager.Instance.SpendGems(cfg.gemCost)))  return false;

            IRng rng;
            if (!Services.TryGet<IRng>(out rng)) rng = new DeterministicRng((ulong)System.DateTime.UtcNow.Ticks);

            ICardCatalog catalog;
            Services.TryGet<ICardCatalog>(out catalog);

            CardInventory inventory;
            Services.TryGet<CardInventory>(out inventory);

            for (int i = 0; i < cfg.cardCount; i++)
            {
                var card = RollCard(cfg, rng, catalog);
                if (card == null) continue;
                rewards.Add(card);

                if (inventory != null)
                {
                    int overflow = inventory.Add(card);
                    if (overflow > 0 && GameManager.Instance != null)
                        GameManager.Instance.AddDust(DustEconomy.DustFromDuplicate(card.rarity));
                }
            }

            Save.SaveSystem save;
            if (Services.TryGet<Save.SaveSystem>(out save))
            {
                if (inventory != null) save.CaptureInventory(inventory);
                save.RecordPackOpened();
            }
            return true;
        }

        PackConfig GetConfig(PackType type)
        {
            if (packs != null)
                for (int i = 0; i < packs.Length; i++)
                    if (packs[i] != null && packs[i].type == type) return packs[i];
            return DefaultConfig(type);
        }

        static PackConfig DefaultConfig(PackType type)
        {
            switch (type)
            {
                case PackType.Basic:     return new PackConfig { type = type, goldCost = 100, cardCount = 3, guaranteedMinRarity = CardRarity.Rare };
                case PackType.Rare:      return new PackConfig { type = type, gemCost  = 50,  cardCount = 4, guaranteedMinRarity = CardRarity.Epic };
                case PackType.Epic:      return new PackConfig { type = type, gemCost  = 80,  cardCount = 4, guaranteedMinRarity = CardRarity.Legendary };
                case PackType.Legendary: return new PackConfig { type = type, gemCost  = 150, cardCount = 5, guaranteedMinRarity = CardRarity.Legendary };
                case PackType.Mythic:    return new PackConfig { type = type, gemCost  = 250, cardCount = 5, guaranteedMinRarity = CardRarity.Mythic };
                default:                 return new PackConfig { type = type, gemCost  = 100, cardCount = 3 };
            }
        }

        CardData RollCard(PackConfig cfg, IRng rng, ICardCatalog catalog)
        {
            IReadOnlyList<CardData> pool = catalog != null ? catalog.All : (IReadOnlyList<CardData>)allCards;
            if (pool == null || pool.Count == 0) return null;

            float r = rng.Value01();
            CardRarity target;
            if      (r < 0.45f) target = CardRarity.Common;
            else if (r < 0.70f) target = CardRarity.Uncommon;
            else if (r < 0.85f) target = CardRarity.Rare;
            else if (r < 0.93f) target = CardRarity.Epic;
            else if (r < 0.97f) target = CardRarity.Legendary;
            else if (r < 0.99f) target = CardRarity.Mythic;
            else                target = CardRarity.Ancestral;

            if ((int)target < (int)cfg.guaranteedMinRarity) target = cfg.guaranteedMinRarity;

            var candidates = catalog != null ? catalog.ByRarity(target) : FilterByRarity(pool, target);
            if (candidates == null || candidates.Count == 0)
                return pool[rng.Range(0, pool.Count)];

            return candidates[rng.Range(0, candidates.Count)];
        }

        static IReadOnlyList<CardData> FilterByRarity(IReadOnlyList<CardData> pool, CardRarity target)
        {
            var list = new List<CardData>();
            for (int i = 0; i < pool.Count; i++)
                if (pool[i] != null && pool[i].rarity == target) list.Add(pool[i]);
            return list;
        }
    }
}
