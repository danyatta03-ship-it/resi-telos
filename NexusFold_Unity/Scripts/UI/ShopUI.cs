using System.Collections.Generic;
using UnityEngine;
using TMPro;
using NexusFold.Core;
using NexusFold.Core.Events;
using NexusFold.Data;
using NexusFold.Economy;

namespace NexusFold.UI
{
    /// <summary>
    /// Shop. Ogni bottone chiama BuyBasic / BuyRare / ... che invoca PackOpener.TryOpenPack.
    /// L'inventario e la valuta vengono aggiornati automaticamente via eventi.
    /// </summary>
    public class ShopUI : MonoBehaviour
    {
        [Header("Currency")]
        public TextMeshProUGUI gemsLabel;
        public TextMeshProUGUI goldLabel;
        public TextMeshProUGUI dustLabel;

        [Header("Feedback")]
        public GameObject rewardPopup;
        public TextMeshProUGUI rewardTitle;
        public TextMeshProUGUI rewardBody;

        [Header("Scenes")]
        public string mainMenuScene = "MainMenu";

        Subscription _sub;

        void OnEnable()
        {
            _sub = GameEvents.Subscribe<CurrencyChanged>(OnCurrency);
            Refresh();
        }

        void OnDisable() { _sub.Dispose(); }

        void OnCurrency(CurrencyChanged e)
        {
            if (gemsLabel) gemsLabel.text = e.Gems.ToString();
            if (goldLabel) goldLabel.text = e.Gold.ToString();
            if (dustLabel && GameManager.Instance != null) dustLabel.text = GameManager.Instance.Dust.ToString();
        }

        void Refresh()
        {
            if (GameManager.Instance == null) return;
            if (gemsLabel) gemsLabel.text = GameManager.Instance.Gems.ToString();
            if (goldLabel) goldLabel.text = GameManager.Instance.Gold.ToString();
            if (dustLabel) dustLabel.text = GameManager.Instance.Dust.ToString();
        }

        public void OnClickBack()
        {
            SceneRouter router;
            if (Services.TryGet<SceneRouter>(out router)) router.Go(mainMenuScene);
            else if (GameManager.Instance != null) GameManager.Instance.LoadScene(mainMenuScene);
        }

        // ===== PACCHETTI =====
        public void BuyBasic()     { BuyPack(PackType.Basic,     "Pacchetto Base"); }
        public void BuyRare()      { BuyPack(PackType.Rare,      "Pacchetto Raro"); }
        public void BuyEpic()      { BuyPack(PackType.Epic,      "Pacchetto Epico"); }
        public void BuyLegendary() { BuyPack(PackType.Legendary, "Pacchetto Leggendario"); }
        public void BuyMythic()    { BuyPack(PackType.Mythic,    "Pacchetto Mitico"); }
        public void BuyEvent()     { BuyPack(PackType.Event,     "Pacchetto Evento"); }

        void BuyPack(PackType type, string displayName)
        {
            if (PackOpener.Instance == null)
            {
                ShowReward(displayName, "PackOpener non registrato in scena.");
                return;
            }

            List<CardData> rewards;
            bool ok = PackOpener.Instance.TryOpenPack(type, out rewards);
            if (!ok)
            {
                ShowReward(displayName, "Valuta insufficiente.");
                return;
            }

            if (rewards == null || rewards.Count == 0)
            {
                ShowReward(displayName, "Nessuna carta pescata.");
                return;
            }

            var body = new System.Text.StringBuilder();
            for (int i = 0; i < rewards.Count; i++)
            {
                var c = rewards[i];
                if (c == null) continue;
                body.Append("- ");
                body.Append(c.cardName);
                body.Append(" [");
                body.Append(c.rarity);
                body.Append("]\n");
            }
            ShowReward(displayName, body.ToString());
        }

        void ShowReward(string title, string body)
        {
            if (rewardTitle) rewardTitle.text = title;
            if (rewardBody)  rewardBody.text  = body;
            if (rewardPopup) rewardPopup.SetActive(true);
            else Debug.Log(title + "\n" + body);
        }

        public void CloseReward()
        {
            if (rewardPopup) rewardPopup.SetActive(false);
        }
    }
}
