using UnityEngine;
using NexusFold.Battle;

namespace NexusFold.Data.Effects
{
    public enum EffectTrigger
    {
        OnPlay,        // quando la carta viene piazzata
        OnAttack,      // prima di applicare il danno del proprio attacco
        OnHit,         // dopo essere stata colpita
        OnDeath,       // quando la carta muore
        OnTurnStart,   // inizio turno del proprietario
        OnTurnEnd,     // fine turno del proprietario
        OnAbility      // quando eroe usa l'ability sulla carta
    }

    public readonly struct EffectContext
    {
        public readonly IBattleContext Battle;
        public readonly CardInstance Source;
        public readonly CardInstance Target;   // può essere null
        public readonly int Row, Col;          // coord del source (o target) al momento dell'evento

        public EffectContext(IBattleContext battle, CardInstance source, CardInstance target, int row, int col)
        {
            Battle = battle;
            Source = source;
            Target = target;
            Row    = row;
            Col    = col;
        }
    }

    /// <summary>
    /// Base per tutti gli effetti carta (ScriptableObject).
    /// Un CardData tiene un array di CardEffect: nessun switch string, tutto data-driven.
    /// </summary>
    public abstract class CardEffect : ScriptableObject
    {
        public EffectTrigger trigger = EffectTrigger.OnPlay;
        [TextArea(1, 3)] public string rulesText;

        public abstract void Execute(EffectContext ctx);
    }
}
