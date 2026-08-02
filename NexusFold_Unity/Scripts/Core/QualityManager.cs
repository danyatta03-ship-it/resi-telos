using UnityEngine;

namespace NexusFold.Core
{
    public enum QualityTier
    {
        Performance = 0,
        Balanced    = 1,
        High        = 2,
        Ultra       = 3
    }

    /// <summary>
    /// Rileva RAM e imposta un tier grafico. Espone budget particelle,
    /// scale rendering e flag feature-specifiche. Chiama ApplyBudget su ogni
    /// ParticleSystem sensibile.
    /// </summary>
    public class QualityManager : MonoBehaviour
    {
        public static QualityManager Instance { get; private set; }

        public QualityTier CurrentTier { get; private set; } = QualityTier.Balanced;

        [Header("Particle Budgets (per QualityTier)")]
        public int[] maxParticles = { 20, 50, 120, 300 };

        [Header("Render Scale (per QualityTier)")]
        public float[] renderScales = { 0.7f, 0.85f, 1.0f, 1.1f };

        [Header("Emission Multiplier (per QualityTier)")]
        public float[] emissionMultipliers = { 0.4f, 0.7f, 1.0f, 1.15f };

        void Awake()
        {
            if (Instance != null && Instance != this) { Destroy(gameObject); return; }
            Instance = this;
            DontDestroyOnLoad(gameObject);
            AutoDetect();
        }

        public void AutoDetect()
        {
            int ram = SystemInfo.systemMemorySize; // MB
            if (ram < 3000)       SetTier(QualityTier.Performance);
            else if (ram < 5000)  SetTier(QualityTier.Balanced);
            else if (ram < 8000)  SetTier(QualityTier.High);
            else                  SetTier(QualityTier.Ultra);
        }

        public void SetTier(QualityTier tier)
        {
            CurrentTier = tier;
            int i = (int)tier;
            int level = i < 0 ? 0 : (i >= QualitySettings.names.Length ? QualitySettings.names.Length - 1 : i);
            QualitySettings.SetQualityLevel(level, true);
            Application.targetFrameRate = tier >= QualityTier.High ? 60 : 30;
            Debug.Log("Quality set to " + tier + " | RAM=" + SystemInfo.systemMemorySize + "MB");
        }

        int Idx { get { int i = (int)CurrentTier; return i < 0 ? 0 : (i >= 4 ? 3 : i); } }
        public int   MaxParticles  { get { return maxParticles     != null && Idx < maxParticles.Length     ? maxParticles[Idx]     : 60; } }
        public float RenderScale   { get { return renderScales     != null && Idx < renderScales.Length     ? renderScales[Idx]     : 1f; } }
        public float EmissionMult  { get { return emissionMultipliers != null && Idx < emissionMultipliers.Length ? emissionMultipliers[Idx] : 1f; } }
        public bool  EnableBloom      { get { return CurrentTier >= QualityTier.High; } }
        public bool  EnableShadows    { get { return CurrentTier >= QualityTier.Balanced; } }
        public bool  EnableCardShine  { get { return CurrentTier >= QualityTier.High; } }
        public bool  EnableHeavyVFX   { get { return CurrentTier >= QualityTier.High; } }

        /// <summary>
        /// Applica il budget al singolo ParticleSystem: cappa maxParticles e scala emission rate.
        /// Chiama in OnEnable dai prefab VFX.
        /// </summary>
        public void ApplyBudget(ParticleSystem ps)
        {
            if (ps == null) return;
            var main = ps.main;
            if (main.maxParticles > MaxParticles) main.maxParticles = MaxParticles;
            var em = ps.emission;
            em.rateOverTimeMultiplier = EmissionMult;
        }
    }
}
