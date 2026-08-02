using UnityEngine;

namespace NexusFold.Core.Feedback
{
    /// <summary>
    /// Metti sulla root di un prefab VFX. Al primo enable chiede al QualityManager
    /// di cappare maxParticles e di scalare l'emission secondo il tier.
    /// </summary>
    [DisallowMultipleComponent]
    public class VfxBudget : MonoBehaviour
    {
        bool _applied;

        void OnEnable()
        {
            if (_applied || QualityManager.Instance == null) return;
            var systems = GetComponentsInChildren<ParticleSystem>();
            for (int i = 0; i < systems.Length; i++)
                QualityManager.Instance.ApplyBudget(systems[i]);
            _applied = true;
        }
    }
}
