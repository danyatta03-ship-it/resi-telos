using UnityEngine;

namespace NexusFold.Core
{
    public enum StatusType
    {
        None,
        Burn,       // Bruciatura - danno a fine turno
        Drown,      // Annegamento - -VEL + danno
        Root,       // Radicamento - non può muoversi
        Corrosion,  // Corrosione - riduce armatura
        Overload,   // Sovraccarico - +ATK ma fragile
        Shield,     // Scudo - assorbe danni
        Armor       // Armatura - riduce danni
    }

    [System.Serializable]
    public class StatusEffect
    {
        public StatusType type;
        public int stacks;
        public int duration; // turni rimanenti, -1 = permanente finché non rimosso

        public StatusEffect(StatusType t, int s = 1, int d = 2)
        {
            type = t;
            stacks = s;
            duration = d;
        }

        public int GetDamagePerTurn()
        {
            switch (type)
            {
                case StatusType.Burn: return stacks * 1;
                case StatusType.Drown: return stacks * 1;
                default: return 0;
            }
        }

        public int GetArmorReduction()
        {
            return type == StatusType.Corrosion ? stacks : 0;
        }

        public int GetAttackBonus()
        {
            return type == StatusType.Overload ? stacks * 2 : 0;
        }

        public bool BlocksMovement()
        {
            return type == StatusType.Root;
        }
    }
}
