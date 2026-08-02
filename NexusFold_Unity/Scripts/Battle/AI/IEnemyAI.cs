using System.Collections;

namespace NexusFold.Battle
{
    /// <summary>
    /// Interfaccia IA nemica. Restituisce un IEnumerator che il TurnController esegue
    /// come coroutine: permette pacing visivo (yield WaitForSeconds) senza bloccare l'update loop.
    /// </summary>
    public interface IEnemyAI
    {
        IEnumerator ExecuteTurn(IBattleContext ctx);
    }
}
