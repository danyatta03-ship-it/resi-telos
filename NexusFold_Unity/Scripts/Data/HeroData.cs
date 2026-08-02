using UnityEngine;

namespace NexusFold.Data
{
    [CreateAssetMenu(fileName = "NewHero", menuName = "NexusFold/Hero Data")]
    public class HeroData : ScriptableObject
    {
        public string heroId;
        public string heroName;
        public string factionName;
        public Sprite portrait;
        public Sprite icon;

        public int maxHP = 20;
        public int abilityCost = 2;

        [TextArea(2, 3)]
        public string abilityDescription;

        public string abilityId; // "heal", "burn_aoe", "drain", etc.
    }
}
