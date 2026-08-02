using NexusFold.Data;

namespace NexusFold.Meta
{
    /// <summary>
    /// Currency sink no-P2W: la polvere si guadagna solo giocando o da duplicati.
    /// Non è mai vendibile per gemme.
    /// </summary>
    public static class DustEconomy
    {
        public static int DustFromDuplicate(CardRarity r)
        {
            switch (r)
            {
                case CardRarity.Common:    return 5;
                case CardRarity.Uncommon:  return 10;
                case CardRarity.Rare:      return 25;
                case CardRarity.Epic:      return 60;
                case CardRarity.Legendary: return 150;
                case CardRarity.Mythic:    return 400;
                case CardRarity.Ancestral: return 1000;
                case CardRarity.Nexus:     return 2500;
            }
            return 0;
        }

        public static int CraftCost(CardRarity r) { return DustFromDuplicate(r) * 4; }
    }
}
