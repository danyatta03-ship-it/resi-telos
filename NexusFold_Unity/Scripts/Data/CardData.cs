using UnityEngine;
using NexusFold.Data.Effects;

namespace NexusFold.Data
{
    public enum CardFaction
    {
        Cinder, Abyssal, Verdant, Umbral, Aether, Iron, Prism, Null
    }

    public enum CardRarity
    {
        Common, Uncommon, Rare, Epic, Legendary, Mythic, Ancestral, Nexus
    }

    public enum CardType
    {
        Creature, Spell, Relic, Hero
    }

    [CreateAssetMenu(fileName = "NewCard", menuName = "NexusFold/Card Data")]
    public class CardData : ScriptableObject
    {
        [Header("Identity")]
        [Tooltip("ID stabile univoco (kebab-case). Se vuoto in editor viene generato dal filename.")]
        public string cardId;
        public string cardName;
        public string subtitle;
        public CardFaction faction;
        public CardRarity rarity;
        public CardType cardType;
        public Sprite artwork;
        public Sprite frame;

        [Header("Stats")]
        [Range(0, 12)] public int cost = 1;
        [Range(0, 30)] public int attack = 1;
        [Range(1, 60)] public int health = 1;
        [Range(0, 5)]  public int speed = 1;
        [Range(0, 5)]  public int range = 1;

        [Header("Ability (legacy)")]
        [TextArea(2, 4)]
        public string abilityText;
        public string effectId;

        [Header("Effects (data-driven)")]
        public CardEffect[] effects;

        [Header("DNA (for fusion)")]
        [Range(0, 100)] public int weight = 50;
        [Range(0, 100)] public int intelligence = 50;
        [Range(0, 100)] public int aggression = 50;
        [Range(0, 100)] public int rareGene = 10;

#if UNITY_EDITOR
        void OnValidate()
        {
            if (string.IsNullOrWhiteSpace(cardId))
            {
                var path = UnityEditor.AssetDatabase.GetAssetPath(this);
                if (!string.IsNullOrEmpty(path))
                    cardId = System.IO.Path.GetFileNameWithoutExtension(path).ToLowerInvariant();
            }
            if (cost == 0 && cardType == CardType.Creature && attack + health > 2)
                Debug.LogWarning("CardData '" + name + "': costo 0 su Creatura potente - verifica balance.");
        }
#endif
    }
}
