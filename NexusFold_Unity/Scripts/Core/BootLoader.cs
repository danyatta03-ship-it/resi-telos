using UnityEngine;
using UnityEngine.SceneManagement;

namespace NexusFold.Core
{
    /// <summary>
    /// LEGACY: bootloader minimale. Preferisci Bootstrap/AppBootstrap
    /// che registra tutti i service. Mantenuto per non rompere scene esistenti.
    /// </summary>
    public class BootLoader : MonoBehaviour
    {
        [SerializeField] float delay = 0.5f;
        [SerializeField] string firstScene = "MainMenu";

        void Start()
        {
            if (GameManager.Instance == null)
            {
                var go = new GameObject("GameManager");
                go.AddComponent<GameManager>();
            }
            Invoke("GoToFirst", delay);
        }

        void GoToFirst()
        {
            if (!string.IsNullOrEmpty(firstScene)) SceneManager.LoadScene(firstScene);
        }
    }
}
