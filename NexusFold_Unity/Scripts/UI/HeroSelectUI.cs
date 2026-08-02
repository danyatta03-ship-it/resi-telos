using UnityEngine;
using UnityEngine.UI;
using TMPro;
using NexusFold.Core;
using NexusFold.Data;

namespace NexusFold.UI
{
    public class HeroSelectUI : MonoBehaviour
    {
        [Header("Hero Database")]
        public HeroData[] heroes;

        [Header("UI References")]
        public Transform heroGridParent;
        public GameObject heroButtonPrefab;

        [Header("Selected")]
        public TextMeshProUGUI selectedNameLabel;
        public Image selectedPortrait;

        [Header("Scenes")]
        public string battleScene   = "Battle";
        public string mainMenuScene = "MainMenu";

        void Start()
        {
            if (heroes == null || heroes.Length == 0)
            {
                Debug.LogWarning("HeroSelectUI: nessun HeroData assegnato.");
                return;
            }
            BuildGrid();
        }

        void BuildGrid()
        {
            if (heroGridParent == null) return;
            for (int i = heroGridParent.childCount - 1; i >= 0; i--)
                Destroy(heroGridParent.GetChild(i).gameObject);

            for (int i = 0; i < heroes.Length; i++)
            {
                var h = heroes[i];
                if (h == null) continue;
                GameObject btn;
                if (heroButtonPrefab != null) btn = Instantiate(heroButtonPrefab, heroGridParent);
                else
                {
                    btn = new GameObject(h.heroName, typeof(RectTransform), typeof(Image), typeof(Button));
                    btn.transform.SetParent(heroGridParent, false);
                }

                var button = btn.GetComponent<Button>();
                if (button != null)
                {
                    var captured = h;
                    button.onClick.RemoveAllListeners();
                    button.onClick.AddListener(delegate { SelectHero(captured); });
                }

                var tmp = btn.GetComponentInChildren<TextMeshProUGUI>();
                if (tmp != null) tmp.text = h.heroName;
            }
        }

        public void SelectHero(HeroData h)
        {
            if (h == null || GameManager.Instance == null) return;
            GameManager.Instance.SelectedHeroId = h.heroId;
            if (selectedNameLabel) selectedNameLabel.text = h.heroName;
            if (selectedPortrait && h.portrait) selectedPortrait.sprite = h.portrait;
        }

        public void OnClickStartBattle()
        {
            if (GameManager.Instance == null || string.IsNullOrEmpty(GameManager.Instance.SelectedHeroId))
            {
                Debug.LogWarning("Seleziona un eroe prima di iniziare.");
                return;
            }
            Navigate(battleScene);
        }

        public void OnClickBack() { Navigate(mainMenuScene); }

        void Navigate(string scene)
        {
            SceneRouter router;
            if (Services.TryGet<SceneRouter>(out router)) router.Go(scene);
            else if (GameManager.Instance != null) GameManager.Instance.LoadScene(scene);
        }
    }
}
