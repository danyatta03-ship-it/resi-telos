using UnityEngine;
using UnityEngine.UI;
using TMPro;

namespace NexusFold.Battle
{
    public enum HintType { None, Selected, Move, Attack, Placement }

    /// <summary>
    /// View di una cella della board 5x5. Pura visualizzazione + hint di targeting.
    /// La logica sta in BattleController / IBattleContext.
    /// CardInstance ora vive nel file dedicato CardInstance.cs.
    /// </summary>
    public class BoardCell : MonoBehaviour
    {
        public int row;
        public int col;

        [Header("UI")]
        public Image background;
        public Image cardArt;
        public Image terrainOverlay;
        public TextMeshProUGUI nameLabel;
        public TextMeshProUGUI statsLabel;
        public GameObject statusRoot;

        [Header("Colors")]
        public Color idleColor       = new Color(0.10f, 0.10f, 0.15f, 0.60f);
        public Color selectedColor   = new Color(0.85f, 0.70f, 0.30f, 0.40f);
        public Color moveHintColor   = new Color(0.30f, 0.85f, 0.40f, 0.35f);
        public Color attackHintColor = new Color(0.90f, 0.30f, 0.30f, 0.35f);
        public Color placeHintColor  = new Color(0.40f, 0.65f, 0.95f, 0.35f);

        public CardInstance Occupant { get; private set; }

        public void Setup(int r, int c)
        {
            row = r;
            col = c;
            Clear();
            ClearHints();
        }

        public void Place(CardInstance card)
        {
            Occupant = card;
            if (cardArt)
            {
                bool hasArt = card != null && card.Data != null && card.Data.artwork != null;
                cardArt.enabled = hasArt;
                if (hasArt) cardArt.sprite = card.Data.artwork;
            }
            if (nameLabel)  nameLabel.text  = card != null ? card.Name : "";
            if (statsLabel) statsLabel.text = card != null ? string.Format("{0}/{1}", card.Atk, card.CurrentHp) : "";
        }

        public void Refresh()
        {
            if (Occupant != null) Place(Occupant);
        }

        public void Clear()
        {
            Occupant = null;
            if (cardArt)    cardArt.enabled = false;
            if (nameLabel)  nameLabel.text  = "";
            if (statsLabel) statsLabel.text = "";
        }

        public void SetSelected(bool on)
        {
            if (background) background.color = on ? selectedColor : idleColor;
        }

        public void SetHint(HintType type)
        {
            if (!background) return;
            switch (type)
            {
                case HintType.None:      background.color = idleColor;       break;
                case HintType.Selected:  background.color = selectedColor;   break;
                case HintType.Move:      background.color = moveHintColor;   break;
                case HintType.Attack:    background.color = attackHintColor; break;
                case HintType.Placement: background.color = placeHintColor;  break;
            }
        }

        public void ClearHints() { SetHint(HintType.None); }
    }
}
