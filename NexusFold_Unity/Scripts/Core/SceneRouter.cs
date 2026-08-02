using System.Collections;
using UnityEngine;
using UnityEngine.SceneManagement;
using UnityEngine.UI;
using NexusFold.Core.Events;

namespace NexusFold.Core
{
    /// <summary>
    /// Router asincrono con fade. Sostituisce SceneManager.LoadScene sincrono
    /// per evitare freeze visibili sui device low-end.
    /// </summary>
    public class SceneRouter : MonoBehaviour
    {
        public static SceneRouter Instance { get; private set; }

        [SerializeField] CanvasGroup fader;
        [SerializeField] float fadeSeconds = 0.25f;

        bool _busy;

        void Awake()
        {
            if (Instance != null && Instance != this) { Destroy(gameObject); return; }
            Instance = this;
            DontDestroyOnLoad(gameObject);
            if (fader != null) { fader.alpha = 0f; fader.blocksRaycasts = false; }
        }

        /// <summary>Naviga verso una scena con fade in/out. No-op se già in corso.</summary>
        public void Go(string sceneName)
        {
            if (_busy || string.IsNullOrEmpty(sceneName)) return;
            StartCoroutine(GoRoutine(sceneName));
        }

        IEnumerator GoRoutine(string sceneName)
        {
            _busy = true;
            GameEvents.Publish(new SceneTransitionStarted(sceneName));

            yield return Fade(0f, 1f);
            var op = SceneManager.LoadSceneAsync(sceneName);
            if (op == null) { _busy = false; yield break; }
            op.allowSceneActivation = false;
            while (op.progress < 0.9f) yield return null;
            op.allowSceneActivation = true;
            while (!op.isDone) yield return null;
            yield return Fade(1f, 0f);

            GameEvents.Publish(new SceneTransitionEnded(sceneName));
            _busy = false;
        }

        IEnumerator Fade(float from, float to)
        {
            if (fader == null) yield break;
            fader.blocksRaycasts = true;
            float t = 0f;
            while (t < fadeSeconds)
            {
                t += Time.unscaledDeltaTime;
                float k = fadeSeconds > 0f ? t / fadeSeconds : 1f;
                fader.alpha = Mathf.Lerp(from, to, k);
                yield return null;
            }
            fader.alpha = to;
            fader.blocksRaycasts = to > 0.5f;
        }
    }
}
