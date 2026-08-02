using UnityEngine;

namespace NexusFold.Audio
{
    public class AudioManager : MonoBehaviour
    {
        public static AudioManager Instance { get; private set; }

        [Header("Sources")]
        public AudioSource musicSource;
        public AudioSource sfxSource;

        [Header("Clips")]
        public AudioClip menuMusic;
        public AudioClip battleMusic;
        public AudioClip buttonClick;
        public AudioClip packOpen;
        public AudioClip cardPlay;
        public AudioClip attackHit;
        public AudioClip fusionSuccess;
        public AudioClip fusionFail;
        public AudioClip victory;
        public AudioClip defeat;

        [Range(0f, 1f)] public float musicVolume = 0.6f;
        [Range(0f, 1f)] public float sfxVolume = 1f;

        void Awake()
        {
            if (Instance != null) { Destroy(gameObject); return; }
            Instance = this;
            DontDestroyOnLoad(gameObject);

            if (musicSource == null)
            {
                musicSource = gameObject.AddComponent<AudioSource>();
                musicSource.loop = true;
                musicSource.playOnAwake = false;
            }
            if (sfxSource == null)
            {
                sfxSource = gameObject.AddComponent<AudioSource>();
                sfxSource.playOnAwake = false;
            }
        }

        public void PlayMusic(AudioClip clip)
        {
            if (clip == null || musicSource == null) return;
            if (musicSource.clip == clip && musicSource.isPlaying) return;
            musicSource.clip = clip;
            musicSource.volume = musicVolume;
            musicSource.Play();
        }

        public void PlaySFX(AudioClip clip)
        {
            if (clip == null || sfxSource == null) return;
            sfxSource.PlayOneShot(clip, sfxVolume);
        }

        public void PlayClick() => PlaySFX(buttonClick);
        public void PlayPackOpen() => PlaySFX(packOpen);
        public void PlayCardPlay() => PlaySFX(cardPlay);
        public void PlayAttack() => PlaySFX(attackHit);
        public void PlayFusionSuccess() => PlaySFX(fusionSuccess);
        public void PlayFusionFail() => PlaySFX(fusionFail);
        public void PlayVictory() => PlaySFX(victory);
        public void PlayDefeat() => PlaySFX(defeat);

        public void PlayMenuMusic() => PlayMusic(menuMusic);
        public void PlayBattleMusic() => PlayMusic(battleMusic);

        public void SetMusicVolume(float v) { musicVolume = v; if (musicSource) musicSource.volume = v; }
        public void SetSFXVolume(float v) { sfxVolume = v; }
    }
}
