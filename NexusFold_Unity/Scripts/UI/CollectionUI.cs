using UnityEngine;
using UnityEngine.UI;
using TMPro;
using NexusFold.Core;
using NexusFold.Core.Pooling;
using NexusFold.Data;
using NexusFold.Meta;

namespace NexusFold.UI
{
    /// <summary>
    /// Griglia della collezione. Usa ICardCatalog se registrato, altrimenti fallback allCards.
    /// Mostra contatore duplicati dall'inventario. GameObject riciclati via pool per evitare GC.
    /// </summary>
    public class CollectionUI : MonoBehaviour
    {
        [Header("Data (fallback)")]
        public CardData[] allCards;

        [Header("UI")]
        public Transform gridParent;
        public GameObject cardItemPrefab;

        [Header("Scenes")]
        public string mainMenuScene = "MainMenu";

        GameObjectPool _pool;

        void OnEnable()
        {
            Refresh();
        }

        public void Refresh()
        {
            if (gridParent == null) return;

            if (_pool == null && cardItemPrefab != null)
                _pool = new GameObjectPool(cardItemPrefab, prewarm: 16, hardCap: 128, parkingName: "Pool[CollectionCard]");

            if (_pool != null) _pool.ReturnAll(gridParent);
            else for (int i = gridParent.childCount - 1; i >= 0; i--) Destroy(gridParent.GetChild(i).gameObject);

            System.Collections.Generic.IReadOnlyList<CardData> source;
            ICardCatalog cat;
            if (Services.TryGet<ICardCatalog>(out cat) && cat.All != null) source = cat.All;
            else source = allCards;
            if (source == null) return;

            CardInventory inventory;
            Services.TryGet<CardInventory>(out inventory);

            for (int i = 0; i < source.Count; i++)
            {
                var c = source[i];
                if (c == null) continue;
                GameObject go;
                if (_pool != null) go = _pool.Rent(gridParent);
                else if (cardItemPrefab != null) go = Instantiate(cardItemPrefab, gridParent);
                else
                {
                    go = new GameObject(c.cardName, typeof(RectTransform));
                    go.transform.SetParent(gridParent, false);
                }

                int count = inventory != null ? inventory.CountOf(c.cardId) : 0;

                var tmp = go.GetComponentInChildren<TextMeshProUGUI>();
                if (tmp != null) tmp.text = string.IsNullOrEmpty(c.cardName)
                    ? c.name
                    : (count > 0 ? c.cardName + " x" + count : c.cardName);

                var img = go.GetComponent<Image>();
                if (img && c.artwork) img.sprite = c.artwork;
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
