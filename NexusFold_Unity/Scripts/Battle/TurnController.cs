using System.Collections;
using UnityEngine;
using NexusFold.Core.Events;

namespace NexusFold.Battle
{
    /// <summary>
    /// Ciclo di turno canonico:
    ///   PlayerTurn.Start → input → EndPlayerTurn → StatusEngine.Tick(player)
    ///     → EnemyTurn.Start → IEnemyAI.ExecuteTurn → EnemyTurn.End → StatusEngine.Tick(enemy)
    ///     → PlayerTurn.Start (loop)
    /// Emette TurnStarted/TurnEnded via GameEvents. Testabile senza scene.
    /// </summary>
    public sealed class TurnController
    {
        readonly IBattleContext _ctx;
        readonly IEnemyAI _ai;
        readonly MonoBehaviour _host;
        readonly System.Action _onPlayerTurnBegan;

        public bool AwaitingInput { get; private set; }
        public bool EnemyTurnRunning { get; private set; }

        public TurnController(IBattleContext ctx, IEnemyAI ai, MonoBehaviour host, System.Action onPlayerTurnBegan = null)
        {
            _ctx = ctx;
            _ai = ai;
            _host = host;
            _onPlayerTurnBegan = onPlayerTurnBegan;
        }

        public void BeginPlayerTurn()
        {
            AwaitingInput = true;
            GameEvents.Publish(new TurnStarted(_ctx.Turn, true));
            if (_onPlayerTurnBegan != null) _onPlayerTurnBegan();
        }

        public void EndPlayerTurn()
        {
            if (!AwaitingInput) return;
            AwaitingInput = false;
            GameEvents.Publish(new TurnEnded(_ctx.Turn, true));
            StatusEngine.Tick(_ctx, ownerIsPlayer: true);
            if (_host != null) _host.StartCoroutine(RunEnemyTurn());
        }

        IEnumerator RunEnemyTurn()
        {
            EnemyTurnRunning = true;
            GameEvents.Publish(new TurnStarted(_ctx.Turn, false));

            if (_ai != null)
            {
                var it = _ai.ExecuteTurn(_ctx);
                while (it != null && it.MoveNext()) yield return it.Current;
            }

            GameEvents.Publish(new TurnEnded(_ctx.Turn, false));
            StatusEngine.Tick(_ctx, ownerIsPlayer: false);
            EnemyTurnRunning = false;

            yield return new WaitForSeconds(0.2f);
            BeginPlayerTurn();
        }
    }
}
