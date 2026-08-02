using System.Collections.Generic;
using UnityEngine;

namespace NexusFold.Core.Pooling
{
    /// <summary>
    /// Pool GameObject semplice. Prewarm su parking root disattivato,
    /// Rent riattiva, Return riparcheggia. Cap opzionale per sicurezza memoria.
    /// </summary>
    public sealed class GameObjectPool
    {
        readonly GameObject _prefab;
        readonly Transform _parking;
        readonly Stack<GameObject> _idle;
        readonly int _hardCap;

        public int IdleCount { get { return _idle.Count; } }

        public GameObjectPool(GameObject prefab, int prewarm = 8, int hardCap = 256, string parkingName = null)
        {
            _prefab = prefab;
            _hardCap = hardCap < 1 ? 1 : hardCap;
            _idle = new Stack<GameObject>(prewarm);

            var parkGo = new GameObject(parkingName ?? ("Pool[" + (prefab != null ? prefab.name : "null") + "]"));
            Object.DontDestroyOnLoad(parkGo);
            parkGo.SetActive(false);
            _parking = parkGo.transform;

            if (_prefab == null) return;

            for (int i = 0; i < prewarm; i++)
            {
                var go = Object.Instantiate(_prefab, _parking);
                _idle.Push(go);
            }
        }

        public GameObject Rent(Transform parent)
        {
            GameObject go;
            if (_idle.Count > 0) go = _idle.Pop();
            else if (_prefab != null) go = Object.Instantiate(_prefab);
            else return null;

            go.transform.SetParent(parent, false);
            go.SetActive(true);
            return go;
        }

        public void Return(GameObject go)
        {
            if (go == null) return;
            if (_idle.Count >= _hardCap) { Object.Destroy(go); return; }
            go.SetActive(false);
            go.transform.SetParent(_parking, false);
            _idle.Push(go);
        }

        public void ReturnAll(Transform activeParent)
        {
            if (activeParent == null) return;
            for (int i = activeParent.childCount - 1; i >= 0; i--)
            {
                Return(activeParent.GetChild(i).gameObject);
            }
        }
    }
}
