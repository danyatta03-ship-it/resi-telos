using UnityEngine;
using UnityEngine.UI;

namespace NexusFold.UI
{
    /// <summary>
    /// Adatta un RectTransform alla safe area del device (notch / pill / camera holes).
    /// Metti su un pannello figlio del Canvas che contiene HUD.
    /// </summary>
    [RequireComponent(typeof(RectTransform))]
    public class SafeAreaFitter : MonoBehaviour
    {
        RectTransform _rt;
        Rect _lastSafeArea;
        Vector2 _lastResolution;

        void OnEnable()
        {
            _rt = GetComponent<RectTransform>();
            _lastSafeArea = new Rect();
            Apply();
        }

        void Update()
        {
            var sa = Screen.safeArea;
            var res = new Vector2(Screen.width, Screen.height);
            if (sa.x == _lastSafeArea.x && sa.y == _lastSafeArea.y &&
                sa.width == _lastSafeArea.width && sa.height == _lastSafeArea.height &&
                res.x == _lastResolution.x && res.y == _lastResolution.y) return;
            Apply();
        }

        void Apply()
        {
            if (_rt == null) return;
            var sa = Screen.safeArea;
            _lastSafeArea = sa;
            _lastResolution = new Vector2(Screen.width, Screen.height);

            if (Screen.width <= 0 || Screen.height <= 0) return;

            Vector2 min = sa.position;
            Vector2 max = sa.position;
            max.x += sa.size.x;
            max.y += sa.size.y;

            min.x /= Screen.width;
            min.y /= Screen.height;
            max.x /= Screen.width;
            max.y /= Screen.height;

            _rt.anchorMin = min;
            _rt.anchorMax = max;
        }
    }
}
