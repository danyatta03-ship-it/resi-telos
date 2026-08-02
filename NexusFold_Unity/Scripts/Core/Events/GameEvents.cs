using System;
using System.Collections.Generic;

namespace NexusFold.Core.Events
{
    /// <summary>Marker interface per gli eventi del bus.</summary>
    public interface IGameEvent {}

    /// <summary>Handle per l'unsubscribe safe (using / Dispose).</summary>
    public readonly struct Subscription : IDisposable
    {
        readonly Action _off;
        public Subscription(Action off) { _off = off; }
        public void Dispose() { _off?.Invoke(); }
    }

    /// <summary>
    /// Bus statico tipizzato, thread-affinity Unity main.
    /// Zero allocazioni sulla Publish, dispatch generico via classe annidata.
    /// </summary>
    public static class GameEvents
    {
        static class Channel<T> where T : struct, IGameEvent
        {
            public static readonly List<Action<T>> Handlers = new List<Action<T>>(8);
        }

        public static Subscription Subscribe<T>(Action<T> handler) where T : struct, IGameEvent
        {
            if (handler == null) return new Subscription(null);
            Channel<T>.Handlers.Add(handler);
            return new Subscription(() => Channel<T>.Handlers.Remove(handler));
        }

        public static void Publish<T>(T evt) where T : struct, IGameEvent
        {
            var list = Channel<T>.Handlers;
            for (int i = 0; i < list.Count; i++)
            {
                try { list[i](evt); }
                catch (Exception e) { UnityEngine.Debug.LogException(e); }
            }
        }

        public static void ClearChannel<T>() where T : struct, IGameEvent
        {
            Channel<T>.Handlers.Clear();
        }
    }
}
