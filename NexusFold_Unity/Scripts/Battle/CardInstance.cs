using System.Collections.Generic;
using NexusFold.Core;
using NexusFold.Data;

namespace NexusFold.Battle
{
    /// <summary>
    /// Istanza runtime di una CardData in una partita.
    /// Contiene stato mutabile (HP, stack effetti, flag turno).
    /// La CardData originale resta immutabile — mai modificarla.
    /// </summary>
    public sealed class CardInstance
    {
        public readonly CardData Data;
        public readonly bool IsPlayer;

        public int MaxHp;
        public int CurrentHp;
        public int Atk;
        public int Speed;
        public int Range;

        public bool HasActedThisTurn;

        public readonly List<StatusEffect> Statuses = new List<StatusEffect>(4);

        public bool IsAlive { get { return CurrentHp > 0; } }
        public string Name  { get { return Data != null ? Data.cardName : "?"; } }

        public CardInstance(CardData data, bool isPlayer)
        {
            Data     = data;
            IsPlayer = isPlayer;
            if (data != null)
            {
                MaxHp     = data.health;
                CurrentHp = data.health;
                Atk       = data.attack;
                Speed     = data.speed;
                Range     = data.range;
            }
            else
            {
                MaxHp = CurrentHp = 1;
                Atk = Speed = Range = 0;
            }
        }

        public StatusEffect FindStatus(StatusType type)
        {
            for (int i = 0; i < Statuses.Count; i++)
                if (Statuses[i] != null && Statuses[i].type == type) return Statuses[i];
            return null;
        }

        /// <summary>Aggiunge o cumula uno status esistente (max di duration, somma stacks).</summary>
        public void ApplyStatus(StatusEffect effect)
        {
            if (effect == null || effect.stacks <= 0) return;
            var existing = FindStatus(effect.type);
            if (existing != null)
            {
                existing.stacks += effect.stacks;
                if (effect.duration > existing.duration || effect.duration < 0)
                    existing.duration = effect.duration;
                return;
            }
            Statuses.Add(effect);
        }

        public bool CanMove()
        {
            for (int i = 0; i < Statuses.Count; i++)
                if (Statuses[i] != null && Statuses[i].BlocksMovement()) return false;
            return true;
        }

        public int TotalArmor()
        {
            int a = 0;
            for (int i = 0; i < Statuses.Count; i++)
            {
                var s = Statuses[i];
                if (s == null) continue;
                if (s.type == StatusType.Armor)     a += s.stacks;
                if (s.type == StatusType.Corrosion) a -= s.stacks;
            }
            return a < 0 ? 0 : a;
        }

        public int TotalShield()
        {
            int a = 0;
            for (int i = 0; i < Statuses.Count; i++)
            {
                var s = Statuses[i];
                if (s != null && s.type == StatusType.Shield) a += s.stacks;
            }
            return a;
        }
    }
}
