using UnityEngine;

namespace NexusFold.Core.Feedback
{
    public enum HapticStrength { Light, Medium, Heavy, Success, Warning }

    public interface IHapticService
    {
        bool Enabled { get; set; }
        void Play(HapticStrength strength);
    }

    /// <summary>
    /// Implementazione minima cross-platform: usa Handheld.Vibrate sul device.
    /// In produzione sostituire con Lofelt Nice Vibrations o native iOS UIFeedbackGenerator.
    /// </summary>
    public sealed class HapticService : IHapticService
    {
        public bool Enabled { get; set; }

        public HapticService(bool enabled = true) { Enabled = enabled; }

        public void Play(HapticStrength strength)
        {
            if (!Enabled) return;
#if UNITY_IOS || UNITY_ANDROID
            // Placeholder: tutte le forze mappano a Handheld.Vibrate. Da rifinire con plugin nativi.
            Handheld.Vibrate();
#endif
        }
    }

    /// <summary>Fallback no-op per editor / test.</summary>
    public sealed class NullHapticService : IHapticService
    {
        public bool Enabled { get; set; }
        public void Play(HapticStrength s) {}
    }
}
