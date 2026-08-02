using UnityEngine;
using NexusFold.Core;

namespace NexusFold.Battle
{
    /// <summary>
    /// Formula ufficiale Nexus Fold:
    ///   Danno_Vita = max(0, (ATK + mods) - Armatura_effettiva) - Scudo
    /// con Armatura_effettiva = max(0, Armor_stacks - Corrosion_stacks).
    /// Overload aggiunge ATK. Ogni status contribuisce a UNA sola colonna: no double counting.
    /// </summary>
    public static class DamageCalculator
    {
        public static int ComputeDamage(int attack, int attackMods, int armor, int shield)
        {
            int raw = attack + attackMods;
            if (raw < 0) raw = 0;
            int armEff = armor < 0 ? 0 : armor;
            int shEff  = shield < 0 ? 0 : shield;
            int afterArmor = Mathf.Max(0, raw - armEff);
            return Mathf.Max(0, afterArmor - shEff);
        }

        public static int ComputeDamage(int attack,
            System.Collections.Generic.IList<StatusEffect> attackerStatuses,
            System.Collections.Generic.IList<StatusEffect> defenderStatuses)
        {
            int atkMod = 0, armor = 0, corrosion = 0, shield = 0;

            if (attackerStatuses != null)
            {
                for (int i = 0; i < attackerStatuses.Count; i++)
                {
                    var s = attackerStatuses[i];
                    if (s == null) continue;
                    if (s.type == StatusType.Overload) atkMod += s.GetAttackBonus();
                }
            }
            if (defenderStatuses != null)
            {
                for (int i = 0; i < defenderStatuses.Count; i++)
                {
                    var s = defenderStatuses[i];
                    if (s == null) continue;
                    switch (s.type)
                    {
                        case StatusType.Armor:     armor     += s.stacks; break;
                        case StatusType.Corrosion: corrosion += s.stacks; break;
                        case StatusType.Shield:    shield    += s.stacks; break;
                    }
                }
            }

            int armEff = Mathf.Max(0, armor - corrosion);
            return ComputeDamage(attack, atkMod, armEff, shield);
        }

        public static int ComputeDamage(int attack, StatusEffect[] attackerStatuses, StatusEffect[] defenderStatuses)
        {
            return ComputeDamage(attack,
                (System.Collections.Generic.IList<StatusEffect>)attackerStatuses,
                (System.Collections.Generic.IList<StatusEffect>)defenderStatuses);
        }

        public static int ComputeAttackDamage(CardInstance attacker, CardInstance defender)
        {
            if (attacker == null || defender == null) return 0;
            return ComputeDamage(attacker.Atk, attacker.Statuses, defender.Statuses);
        }
    }
}
