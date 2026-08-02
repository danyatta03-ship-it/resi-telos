using System.Collections.Generic;
using NexusFold.Core.Events;
using NexusFold.Data;

namespace NexusFold.Meta
{
    /// <summary>
    /// Inventario carte del giocatore. Conta duplicati per craft/fusione.
    /// L'aggiunta oltre il cap trasforma in dust.
    /// </summary>
    public sealed class CardInventory
    {
        readonly Dictionary<string, int> _counts = new Dictionary<string, int>();

        public int CountOf(string cardId)
        {
            if (string.IsNullOrEmpty(cardId)) return 0;
            int n;
            return _counts.TryGetValue(cardId, out n) ? n : 0;
        }

        public bool Owns(string cardId) { return CountOf(cardId) > 0; }

        public IEnumerable<KeyValuePair<string, int>> All { get { return _counts; } }

        public IReadOnlyDictionary<string, int> AsReadOnly() { return _counts; }

        /// <summary>Aggiunge una carta all'inventario e restituisce eventuali duplicati oltre il cap.</summary>
        public int Add(CardData card, int cap = 3)
        {
            if (card == null || string.IsNullOrEmpty(card.cardId)) return 0;
            int had = CountOf(card.cardId);
            bool wasDupe = had >= cap;
            int overflow = 0;

            if (had >= cap)
            {
                overflow = 1;
                GameEvents.Publish(new CardAcquired(card.cardId, wasDupe, DustEconomy.DustFromDuplicate(card.rarity)));
                return overflow;
            }
            _counts[card.cardId] = had + 1;
            GameEvents.Publish(new CardAcquired(card.cardId, wasDupe, 0));
            return 0;
        }

        public bool Consume(string cardId, int amount = 1)
        {
            if (amount <= 0 || string.IsNullOrEmpty(cardId)) return false;
            int n;
            if (!_counts.TryGetValue(cardId, out n) || n < amount) return false;
            n -= amount;
            if (n <= 0) _counts.Remove(cardId);
            else _counts[cardId] = n;
            return true;
        }

        public void LoadFromSave(IEnumerable<KeyValuePair<string, int>> saved)
        {
            _counts.Clear();
            if (saved == null) return;
            foreach (var kv in saved)
            {
                if (string.IsNullOrEmpty(kv.Key) || kv.Value <= 0) continue;
                _counts[kv.Key] = kv.Value;
            }
        }
    }
}
