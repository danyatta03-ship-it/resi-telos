using System.Collections.Generic;
using NexusFold.Data;

namespace NexusFold.Meta
{
    /// <summary>
    /// Catalogo di tutte le carte del gioco. Sostituisce la pratica di passare
    /// public CardData[] a mano in ogni MonoBehaviour.
    /// Consente in futuro di caricare da Addressables / rete senza toccare i consumer.
    /// </summary>
    public interface ICardCatalog
    {
        IReadOnlyList<CardData> All { get; }
        CardData Get(string cardId);
        IReadOnlyList<CardData> ByRarity(CardRarity rarity);
        IReadOnlyList<CardData> ByFaction(CardFaction faction);
    }
}
