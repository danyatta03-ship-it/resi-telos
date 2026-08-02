using UnityEngine;
using NexusFold.Audio;
using NexusFold.Core;
using NexusFold.Core.Feedback;
using NexusFold.Core.Rng;
using NexusFold.Data;
using NexusFold.Economy;
using NexusFold.Meta;
using NexusFold.Save;

namespace NexusFold.Bootstrap
{
    /// <summary>
    /// Entry point unico. Metti UNA copia su un GameObject nella scena "Boot".
    /// Istanzia / registra tutti i service, poi naviga al MainMenu con fade.
    ///
    /// Ordine di init:
    ///   1) GameManager (contiene valute)
    ///   2) QualityManager (setta target FPS)
    ///   3) SceneRouter (fade)
    ///   4) AudioManager
    ///   5) SaveSystem (Load applica valute a GameManager)
    ///   6) Rng deterministico (seed dal tempo di sistema)
    ///   7) Haptic
    ///   8) CardCatalog + Inventory (popolato dal save)
    ///   9) PackOpener (opzionale)
    ///  10) Progression (dal save)
    /// </summary>
    public class AppBootstrap : MonoBehaviour
    {
        [Header("Prefabs (assegna in scena Boot)")]
        public GameManager     gameManagerPrefab;
        public SaveSystem      saveSystemPrefab;
        public QualityManager  qualityPrefab;
        public SceneRouter     sceneRouterPrefab;
        public AudioManager    audioPrefab;
        public PackOpener      packOpenerPrefab;

        [Header("Content")]
        public CardData[] allCards;

        [Header("Scenes")]
        public string firstScene = "MainMenu";
        public float bootDelay = 0.35f;

        void Awake()
        {
            // Idempotenza: se qualcuno ha già avviato il bootstrap, non ripetere.
            if (Services.Has<AppBootstrap>()) { Destroy(gameObject); return; }
            Services.Register(this);

            DontDestroyOnLoad(gameObject);

            var gm      = gameManagerPrefab  != null ? Instantiate(gameManagerPrefab)  : new GameObject("GameManager").AddComponent<GameManager>();
            var quality = qualityPrefab      != null ? Instantiate(qualityPrefab)      : new GameObject("QualityManager").AddComponent<QualityManager>();
            var router  = sceneRouterPrefab  != null ? Instantiate(sceneRouterPrefab)  : new GameObject("SceneRouter").AddComponent<SceneRouter>();
            var audio   = audioPrefab        != null ? Instantiate(audioPrefab)        : new GameObject("AudioManager").AddComponent<AudioManager>();
            var save    = saveSystemPrefab   != null ? Instantiate(saveSystemPrefab)   : new GameObject("SaveSystem").AddComponent<SaveSystem>();
            var packs   = packOpenerPrefab   != null ? Instantiate(packOpenerPrefab)   : new GameObject("PackOpener").AddComponent<PackOpener>();

            var rng     = new DeterministicRng((ulong)System.DateTime.UtcNow.Ticks);
            var haptic  = new HapticService(true);

            var catalog   = new StaticCardCatalog(allCards);
            var inventory = new CardInventory();
            save.ApplyToInventory(inventory);

            var progression = new PlayerProgression(save.Data.level, save.Data.xp);

            Services.Register(gm);
            Services.Register(quality);
            Services.Register(router);
            Services.Register(audio);
            Services.Register(save);
            Services.Register(packs);
            Services.Register<IRng>(rng);
            Services.Register<IHapticService>(haptic);
            Services.Register<ICardCatalog>(catalog);
            Services.Register(inventory);
            Services.Register(progression);

            if (!string.IsNullOrEmpty(firstScene))
                Invoke("GoFirstScene", bootDelay);
        }

        void GoFirstScene()
        {
            SceneRouter router;
            if (Services.TryGet<SceneRouter>(out router)) router.Go(firstScene);
            else if (GameManager.Instance != null) GameManager.Instance.LoadScene(firstScene);
        }
    }
}
