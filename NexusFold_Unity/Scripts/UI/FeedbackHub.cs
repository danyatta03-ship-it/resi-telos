using UnityEngine;
using NexusFold.Audio;
using NexusFold.Core;
using NexusFold.Core.Events;
using NexusFold.Core.Feedback;

namespace NexusFold.UI
{
    /// <summary>
    /// Ascolta gli eventi di gameplay e li traduce in feedback audio + aptico.
    /// Zero coupling con BattleManager. Vive sulla scena Battle (o DontDestroyOnLoad in Bootstrap).
    /// </summary>
    public class FeedbackHub : MonoBehaviour
    {
        Subscription _sAttack, _sCardPlay, _sMatchEnd, _sStatusApplied, _sStatusTicked, _sLevelUp;

        void OnEnable()
        {
            _sAttack        = GameEvents.Subscribe<AttackResolved>(OnAttack);
            _sCardPlay      = GameEvents.Subscribe<CardPlayed>(OnCardPlay);
            _sMatchEnd      = GameEvents.Subscribe<MatchEnded>(OnMatchEnd);
            _sStatusApplied = GameEvents.Subscribe<StatusApplied>(OnStatusApplied);
            _sStatusTicked  = GameEvents.Subscribe<StatusTicked>(OnStatusTicked);
            _sLevelUp       = GameEvents.Subscribe<LevelUp>(OnLevelUp);
        }

        void OnDisable()
        {
            _sAttack.Dispose();
            _sCardPlay.Dispose();
            _sMatchEnd.Dispose();
            _sStatusApplied.Dispose();
            _sStatusTicked.Dispose();
            _sLevelUp.Dispose();
        }

        void OnAttack(AttackResolved e)
        {
            if (AudioManager.Instance != null) AudioManager.Instance.PlayAttack();
            Haptic(HapticStrength.Medium);
        }

        void OnCardPlay(CardPlayed e)
        {
            if (AudioManager.Instance != null) AudioManager.Instance.PlayCardPlay();
            Haptic(HapticStrength.Light);
        }

        void OnMatchEnd(MatchEnded e)
        {
            if (AudioManager.Instance != null)
            {
                if (e.Victory) AudioManager.Instance.PlayVictory();
                else AudioManager.Instance.PlayDefeat();
            }
            Haptic(e.Victory ? HapticStrength.Success : HapticStrength.Warning);
        }

        void OnStatusApplied(StatusApplied e) { Haptic(HapticStrength.Light); }
        void OnStatusTicked(StatusTicked e)   { Haptic(HapticStrength.Light); }
        void OnLevelUp(LevelUp e)             { Haptic(HapticStrength.Success); }

        static void Haptic(HapticStrength s)
        {
            IHapticService h;
            if (Services.TryGet<IHapticService>(out h)) h.Play(s);
        }
    }
}
