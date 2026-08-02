using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using NexusFold.Core.Events;

namespace NexusFold.Battle
{
    /// <summary>
    /// IA a 3 fasi per unità:
    ///  1) prova ad attaccare il bersaglio con miglior utility (lethal + HP mancanti + minaccia);
    ///  2) altrimenti avanza verso la fila del giocatore;
    ///  3) altrimenti passa.
    /// Nessun uso di UnityEngine.Random — determinismo sfruttando IBattleContext.Rng.
    /// </summary>
    public sealed class SimpleUtilityAI : IEnemyAI
    {
        public float ActionPacing = 0.35f;
        public float StartDelay   = 0.35f;
        public bool  Verbose      = false;

        public IEnumerator ExecuteTurn(IBattleContext ctx)
        {
            if (ctx == null) yield break;
            yield return new WaitForSeconds(StartDelay);

            var units = CollectEnemies(ctx);
            // Ordinamento deterministico: prima quelli con HP alto (tanker davanti), poi da alto a basso ATK
            units.Sort(delegate(UnitRef a, UnitRef b) {
                int c = b.Unit.CurrentHp.CompareTo(a.Unit.CurrentHp);
                if (c != 0) return c;
                return b.Unit.Atk.CompareTo(a.Unit.Atk);
            });

            for (int i = 0; i < units.Count; i++)
            {
                var u = units[i];
                if (u.Unit == null || !u.Unit.IsAlive) continue;

                if (TryAttack(ctx, u)) { yield return new WaitForSeconds(ActionPacing); continue; }
                if (TryAdvance(ctx, u)) { yield return new WaitForSeconds(ActionPacing); continue; }
            }
        }

        struct UnitRef { public CardInstance Unit; public int R, C; }

        static List<UnitRef> CollectEnemies(IBattleContext ctx)
        {
            var list = new List<UnitRef>();
            for (int r = 0; r < ctx.Rows; r++)
            {
                for (int c = 0; c < ctx.Cols; c++)
                {
                    var o = ctx.GetOccupant(r, c);
                    if (o != null && !o.IsPlayer) list.Add(new UnitRef { Unit = o, R = r, C = c });
                }
            }
            return list;
        }

        static bool TryAttack(IBattleContext ctx, UnitRef u)
        {
            CardInstance bestUnit = null;
            int bestScore = int.MinValue;
            int bestR = 0, bestC = 0;

            for (int r = 0; r < ctx.Rows; r++)
            {
                for (int c = 0; c < ctx.Cols; c++)
                {
                    var t = ctx.GetOccupant(r, c);
                    if (t == null || t.IsPlayer == u.Unit.IsPlayer) continue;
                    int dist = Chebyshev(u.R, u.C, r, c);
                    if (dist > u.Unit.Range || dist == 0) continue;

                    int score = ScoreTarget(u.Unit, t);
                    if (score > bestScore) { bestScore = score; bestUnit = t; bestR = r; bestC = c; }
                }
            }

            if (bestUnit == null) return false;

            int dmg = DamageCalculator.ComputeAttackDamage(u.Unit, bestUnit);
            int hpBefore = bestUnit.CurrentHp;
            ctx.DealCardDamage(bestUnit, dmg, u.Unit);
            int overkill = dmg > hpBefore ? dmg - hpBefore : 0;
            GameEvents.Publish(new AttackResolved(u.R, u.C, bestR, bestC, dmg, overkill));
            u.Unit.HasActedThisTurn = true;
            return true;
        }

        static int ScoreTarget(CardInstance atk, CardInstance def)
        {
            int lethal = atk.Atk >= def.CurrentHp ? 200 : 0;
            int missing = def.MaxHp <= 0 ? 0 : (int)(100f * (def.MaxHp - def.CurrentHp) / def.MaxHp);
            int threat  = def.Atk * 8;
            int rarityBonus = (int)(def.Data != null ? def.Data.rarity : 0) * 5;
            return lethal + missing + threat + rarityBonus;
        }

        static bool TryAdvance(IBattleContext ctx, UnitRef u)
        {
            if (u.Unit == null || !u.Unit.CanMove() || u.Unit.Speed <= 0) return false;
            int step = u.Unit.Speed;
            int dir = u.Unit.IsPlayer ? -1 : +1; // nemico va verso righe alte (verso il player, che sta in basso)
            int targetR = u.R + dir * step;
            if (targetR < 0) targetR = 0;
            if (targetR >= ctx.Rows) targetR = ctx.Rows - 1;
            if (targetR == u.R) return false;

            // Percorso passo-passo: avanza finché la cella successiva è libera
            int r = u.R;
            while (r != targetR)
            {
                int next = r + dir;
                if (next < 0 || next >= ctx.Rows) break;
                if (ctx.GetOccupant(next, u.C) != null) break;
                r = next;
            }
            if (r == u.R) return false;

            bool ok = ctx.MoveOccupant(u.R, u.C, r, u.C);
            if (ok) GameEvents.Publish(new UnitMoved(u.R, u.C, r, u.C));
            return ok;
        }

        static int Chebyshev(int r1, int c1, int r2, int c2)
        {
            int dr = r1 - r2; if (dr < 0) dr = -dr;
            int dc = c1 - c2; if (dc < 0) dc = -dc;
            return dr > dc ? dr : dc;
        }
    }
}
