using System;
using System.Collections.Generic;
using UnityEngine;

namespace NexusFold.Core
{
    /// <summary>
    /// Service locator minimo — sostituisce l'accesso ai singleton diretti.
    /// Registrazione avviene in Bootstrap. Reset automatico su domain reload.
    /// </summary>
    public static class Services
    {
        static readonly Dictionary<Type, object> Map = new Dictionary<Type, object>();

        public static void Register<T>(T instance) where T : class
        {
            if (instance == null) throw new ArgumentNullException(nameof(instance));
            Map[typeof(T)] = instance;
        }

        public static void Unregister<T>() where T : class
        {
            Map.Remove(typeof(T));
        }

        public static T Get<T>() where T : class
        {
            if (Map.TryGetValue(typeof(T), out var v)) return (T)v;
            throw new InvalidOperationException(
                "Service " + typeof(T).Name + " non registrato. Verifica AppBootstrap.");
        }

        public static bool TryGet<T>(out T service) where T : class
        {
            if (Map.TryGetValue(typeof(T), out var v)) { service = (T)v; return true; }
            service = null;
            return false;
        }

        public static bool Has<T>() where T : class
        {
            return Map.ContainsKey(typeof(T));
        }

        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.SubsystemRegistration)]
        static void ResetOnLoad()
        {
            Map.Clear();
        }
    }
}
