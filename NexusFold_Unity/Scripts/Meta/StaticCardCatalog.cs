using System.Collections.Generic;
using NexusFold.Data;

namespace NexusFold.Meta
{
    /// <summary>
    /// Catalogo carte da array statico (assegnato in Inspector dal Bootstrap).
    /// Facile da sostituire con AddressablesCardCatalog senza toccare i consumer.
    /// </summary>
    public sealed class StaticCardCatalog : ICardCatalog
    {
        readonly List<CardData> _all;
        readonly Dictionary<string, CardData> _byId;
        readonly Dictionary<CardRarity, List<CardData>> _byRarity;
        readonly Dictionary<CardFaction, List<CardData>> _byFaction;

        public StaticCardCatalog(IEnumerable<CardData> cards)
        {
            _all = new List<CardData>();
            _byId = new Dictionary<string, CardData>();
            _byRarity = new Dictionary<CardRarity, List<CardData>>();
            _byFaction = new Dictionary<CardFaction, List<CardData>>();

            if (cards == null) return;
            foreach (var c in cards)
            {
                if (c == null) continue;
                _all.Add(c);
                if (!string.IsNullOrEmpty(c.cardId) && !_byId.ContainsKey(c.cardId)) _byId[c.cardId] = c;

                if (!_byRarity.ContainsKey(c.rarity)) _byRarity[c.rarity] = new List<CardData>();
                _byRarity[c.rarity].Add(c);

                if (!_byFaction.ContainsKey(c.faction)) _byFaction[c.faction] = new List<CardData>();
                _byFaction[c.faction].Add(c);
            }
        }

        public IReadOnlyList<CardData> All { get { return _all; } }

        public CardData Get(string cardId)
        {
            if (string.IsNullOrEmpty(cardId)) return null;
            CardData c;
            return _byId.TryGetValue(cardId, out c) ? c : null;
        }

        static readonly List<CardData> Empty = new List<CardData>();

        public IReadOnlyList<CardData> ByRarity(CardRarity rarity)
        {
            List<CardData> list;
            return _byRarity.TryGetValue(rarity, out list) ? list : (IReadOnlyList<CardData>)Empty;
        }

        public IReadOnlyList<CardData> ByFaction(CardFaction faction)
        {
            List<CardData> list;
            return _byFaction.TryGetValue(faction, out list) ? list : (IReadOnlyList<CardData>)Empty;
        }
    }
}
