using UnityEngine;
using UnityEngine.UI;
using TMPro;
using NexusFold.Core;
using NexusFold.Core.Events;
using NexusFold.Core.Rng;
using NexusFold.Data;
using NexusFold.Fusion;
using NexusFold.Meta;

namespace NexusFold.UI
{
    /// <summary>
    /// UI di fusione: due slot carta + probabilità dinamica + pulsante "Fondi".
    /// Ascolta FusionResolved per il feedback visivo/animato.
    ///
    /// Setup UI (minimo):
    ///   slotA / slotB (Image + Button per aprire un picker)
    ///   chanceFill  → Image type Filled (radial o horizontal)
    ///   chanceLabel → "65%"
    ///   fuseButton  → OnClick → OnClickFuse
    ///   resultBanner → mostrato dopo il resolve
    /// </summary>
    public class FusionUI : MonoBehaviour
    {
        [Header("Slots")]
        public Image slotAImage;
        public Image slotBImage;
        public TextMeshProUGUI slotAName;
        public TextMeshProUGUI slotBName;

        [Header("Chance")]
        public Image chanceFill;
        public TextMeshProUGUI chanceLabel;

        [Header("Fuse")]
        public Button fuseButton;

        [Header("Result")]
        public GameObject resultBanner;
        public TextMeshProUGUI resultLabel;

        [Header("Scenes")]
        public string mainMenuScene = "MainMenu";

        CardData _a;
        CardData _b;
        Subscription _sub;

        void OnEnable()
        {
            _sub = GameEvents.Subscribe<FusionResolved>(OnFusionResolved);
            if (resultBanner) resultBanner.SetActive(false);
            RefreshChance();
        }

        void OnDisable() { _sub.Dispose(); }

        public void SetSlotA(CardData a) { _a = a; RefreshSlotUI(); }
        public void SetSlotB(CardData b) { _b = b; RefreshSlotUI(); }

        void RefreshSlotUI()
        {
            if (slotAImage) { slotAImage.enabled = _a != null && _a.artwork != null; if (slotAImage.enabled) slotAImage.sprite = _a.artwork; }
            if (slotBImage) { slotBImage.enabled = _b != null && _b.artwork != null; if (slotBImage.enabled) slotBImage.sprite = _b.artwork; }
            if (slotAName)  slotAName.text = _a != null ? _a.cardName : "-";
            if (slotBName)  slotBName.text = _b != null ? _b.cardName : "-";
            RefreshChance();
        }

        void RefreshChance()
        {
            float p = FusionResolver.ChanceOf(_a, _b);
            if (chanceFill)  chanceFill.fillAmount = p;
            if (chanceLabel) chanceLabel.text = Mathf.RoundToInt(p * 100f) + "%";
            if (fuseButton != null) fuseButton.interactable = _a != null && _b != null;
        }

        public void OnClickFuse()
        {
            if (_a == null || _b == null) return;
            IRng rng;
            if (!Services.TryGet<IRng>(out rng)) rng = new DeterministicRng((ulong)System.DateTime.UtcNow.Ticks);

            CardData result;
            FusionResolver.TryFuse(_a, _b, rng, out result);
            // La UI risultato viene aggiornata da OnFusionResolved.
        }

        void OnFusionResolved(FusionResolved e)
        {
            if (resultBanner) resultBanner.SetActive(true);
            if (resultLabel)
            {
                if (e.Success && e.Result != null)
                    resultLabel.text = "Fusione riuscita!\n" + e.Result.cardName;
                else
                    resultLabel.text = "Fusione fallita (" + Mathf.RoundToInt(e.Chance * 100f) + "%)";
            }

            // Aggiungi alla collezione se successo
            if (e.Success && e.Result != null)
            {
                CardInventory inv;
                if (Services.TryGet<CardInventory>(out inv))
                {
                    inv.Add(e.Result);
                    Save.SaveSystem save;
                    if (Services.TryGet<Save.SaveSystem>(out save)) save.CaptureInventory(inv);
                }
            }
        }

        public void OnClickBack()
        {
            SceneRouter router;
            if (Services.TryGet<SceneRouter>(out router)) router.Go(mainMenuScene);
            else if (GameManager.Instance != null) GameManager.Instance.LoadScene(mainMenuScene);
        }
    }
}
