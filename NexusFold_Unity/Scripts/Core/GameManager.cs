using UnityEngine;
using UnityEngine.SceneManagement;
using NexusFold.Core.Events;

namespace NexusFold.Core
{
    /// <summary>
    /// Singleton di ingaggio dei sistemi legacy. La nuova business logic
    /// passa da Services + GameEvents. Qui si tengono valute e navigazione.
    /// </summary>
    public class GameManager : MonoBehaviour
    {
        public static GameManager Instance { get; private set; }

        [Header("Player Data")]
        public int Gems = 120;
        public int Gold = 850;
        public int Level = 1;
        public int XP = 0;
        public int XPToNext = 100;
        public int Dust = 0;

        public string SelectedHeroId = "lumina";

        public System.Action OnCurrencyChanged;

        void Awake()
        {
            if (Instance != null && Instance != this) { Destroy(gameObject); return; }
            Instance = this;
            DontDestroyOnLoad(gameObject);
        }

        public void AddGold(int amount)
        {
            if (amount == 0) return;
            Gold += amount;
            if (Gold < 0) Gold = 0;
            PublishCurrency();
        }

        public void AddGems(int amount)
        {
            if (amount == 0) return;
            Gems += amount;
            if (Gems < 0) Gems = 0;
            PublishCurrency();
        }

        public void AddDust(int amount)
        {
            if (amount == 0) return;
            Dust += amount;
            if (Dust < 0) Dust = 0;
            PublishCurrency();
        }

        public bool SpendGold(int amount)
        {
            if (amount <= 0) return true;
            if (Gold < amount) return false;
            Gold -= amount;
            PublishCurrency();
            return true;
        }

        public bool SpendGems(int amount)
        {
            if (amount <= 0) return true;
            if (Gems < amount) return false;
            Gems -= amount;
            PublishCurrency();
            return true;
        }

        public bool SpendDust(int amount)
        {
            if (amount <= 0) return true;
            if (Dust < amount) return false;
            Dust -= amount;
            PublishCurrency();
            return true;
        }

        void PublishCurrency()
        {
            GameEvents.Publish(new CurrencyChanged(Gold, Gems));
            if (OnCurrencyChanged != null) OnCurrencyChanged();
        }

        public void LoadScene(string sceneName)
        {
            if (string.IsNullOrEmpty(sceneName)) return;
            SceneRouter router;
            if (Services.TryGet<SceneRouter>(out router)) { router.Go(sceneName); return; }
            SceneManager.LoadScene(sceneName);
        }
    }
}
