using System.Collections;
using UnityEngine;
using NexusFold.Core;
using NexusFold.Core.Rng;

namespace NexusFold.Network
{
    /// <summary>
    /// Stub matchmaking 1v1 per singleplayer. Determinismo dell'attesa via IRng
    /// (nessun UnityEngine.Random). Cancel non uccide altre coroutine — usa handle dedicato.
    /// </summary>
    public class MatchmakingStub : MonoBehaviour
    {
        public static MatchmakingStub Instance { get; private set; }

        public bool IsSearching { get; private set; }
        public bool MatchFound  { get; private set; }

        public System.Action OnMatchFound;
        public System.Action OnSearchCancelled;

        public string battleScene = "Battle";

        Coroutine _searchCoroutine;

        void Awake()
        {
            if (Instance != null && Instance != this) { Destroy(gameObject); return; }
            Instance = this;
            DontDestroyOnLoad(gameObject);
        }

        public void StartSearch()
        {
            if (IsSearching) return;
            IsSearching = true;
            MatchFound = false;
            _searchCoroutine = StartCoroutine(FakeSearch());
        }

        public void CancelSearch()
        {
            if (!IsSearching) return;
            IsSearching = false;
            if (_searchCoroutine != null) StopCoroutine(_searchCoroutine);
            _searchCoroutine = null;
            if (OnSearchCancelled != null) OnSearchCancelled();
        }

        IEnumerator FakeSearch()
        {
            IRng rng;
            if (!Services.TryGet<IRng>(out rng)) rng = new DeterministicRng((ulong)System.DateTime.UtcNow.Ticks);
            float wait = 1f + rng.Value01() * 2f;
            yield return new WaitForSeconds(wait);
            if (!IsSearching) yield break;

            IsSearching = false;
            MatchFound = true;
            if (OnMatchFound != null) OnMatchFound();

            SceneRouter router;
            if (Services.TryGet<SceneRouter>(out router)) router.Go(battleScene);
            else if (GameManager.Instance != null) GameManager.Instance.LoadScene(battleScene);
        }
    }
}
