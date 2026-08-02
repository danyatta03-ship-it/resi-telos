using UnityEngine;
using UnityEngine.UI;
using TMPro;
using NexusFold.Core;
using NexusFold.Core.Events;

namespace NexusFold.UI
{
    /// <summary>
    /// Attacca al Canvas del MainMenu. Collega i bottoni ai metodi pubblici.
    /// Consuma eventi CurrencyChanged / LevelUp / XpGained per aggiornarsi
    /// senza polling.
    /// </summary>
    public class MainMenuUI : MonoBehaviour
    {
        [Header("Currency (TMP consigliato)")]
        public TextMeshProUGUI gemsLabel;
        public TextMeshProUGUI goldLabel;
        public TextMeshProUGUI dustLabel;
        public TextMeshProUGUI levelLabel;
        public TextMeshProUGUI xpLabel;
        public Image xpBar;

        [Header("Scenes")]
        public string heroSelectScene = "HeroSelect";
        public string shopScene       = "Shop";
        public string collectionScene = "Collection";
        public string fusionScene     = "Fusion";

        Subscription _sCurrency, _sLevel, _sXp;

        void OnEnable()
        {
            _sCurrency = GameEvents.Subscribe<CurrencyChanged>(OnCurrency);
            _sLevel    = GameEvents.Subscribe<LevelUp>(OnLevelUp);
            _sXp       = GameEvents.Subscribe<XpGained>(OnXpGained);
            Refresh();
        }

        void OnDisable()
        {
            _sCurrency.Dispose();
            _sLevel.Dispose();
            _sXp.Dispose();
        }

        void OnCurrency(CurrencyChanged e)
        {
            if (gemsLabel) gemsLabel.text = e.Gems.ToString();
            if (goldLabel) goldLabel.text = e.Gold.ToString();
            if (dustLabel && GameManager.Instance != null) dustLabel.text = GameManager.Instance.Dust.ToString();
        }

        void OnLevelUp(LevelUp e)
        {
            if (levelLabel) levelLabel.text = "Livello " + e.NewLevel;
        }

        void OnXpGained(XpGained e)
        {
            if (levelLabel) levelLabel.text = "Livello " + e.NewLevel;
            if (xpLabel) xpLabel.text = e.NewXp.ToString();
            if (xpBar != null)
            {
                int target = ProgressionCurveTarget(e.NewLevel);
                xpBar.fillAmount = target <= 0 ? 0f : (float)e.NewXp / target;
            }
        }

        static int ProgressionCurveTarget(int level)
        {
            return NexusFold.Meta.ProgressionCurve.XpForLevel(level);
        }

        void Refresh()
        {
            if (GameManager.Instance == null) return;
            if (gemsLabel)  gemsLabel.text = GameManager.Instance.Gems.ToString();
            if (goldLabel)  goldLabel.text = GameManager.Instance.Gold.ToString();
            if (dustLabel)  dustLabel.text = GameManager.Instance.Dust.ToString();
            if (levelLabel) levelLabel.text = "Livello " + GameManager.Instance.Level;
            if (xpLabel)    xpLabel.text = GameManager.Instance.XP.ToString();
        }

        // ===== BOTTONI — collega OnClick a questi =====
        public void OnClickGioca()      { Navigate(heroSelectScene); }
        public void OnClickCollezione() { Navigate(collectionScene); }
        public void OnClickNegozio()    { Navigate(shopScene); }
        public void OnClickFusione()    { Navigate(fusionScene); }
        public void OnClickClan()       { Debug.Log("Clan (WIP)"); }
        public void OnClickProfilo()    { Debug.Log("Profilo (WIP)"); }
        public void OnClickMissioni()   { Debug.Log("Missioni (WIP)"); }
        public void OnClickEventi()     { Debug.Log("Eventi (WIP)"); }
        public void OnClickPass()       { Debug.Log("Battle Pass (WIP)"); }
        public void OnClickClassifica() { Debug.Log("Classifica (WIP)"); }
        public void OnClickPosta()      { Debug.Log("Posta (WIP)"); }

        void Navigate(string scene)
        {
            if (string.IsNullOrEmpty(scene)) return;
            SceneRouter router;
            if (Services.TryGet<SceneRouter>(out router)) router.Go(scene);
            else if (GameManager.Instance != null) GameManager.Instance.LoadScene(scene);
        }
    }
}
