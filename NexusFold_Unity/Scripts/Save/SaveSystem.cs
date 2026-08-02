using UnityEngine;
using System.IO;
using System.Collections.Generic;
using NexusFold.Meta;

namespace NexusFold.Save
{
    [System.Serializable]
    public class CardCountEntry
    {
        public string cardId;
        public int count;
    }

    [System.Serializable]
    public class PlayerSaveData
    {
        public int gems = 120;
        public int gold = 850;
        public int dust = 0;
        public int level = 1;
        public int xp = 0;
        public string selectedHeroId = "lumina";
        public int wins = 0;
        public int losses = 0;
        public int packsOpened = 0;

        // JsonUtility non supporta Dictionary → serializziamo come lista.
        public List<CardCountEntry> cardCounts = new List<CardCountEntry>();

        // Vecchio campo legacy: manteniamo per migrazione automatica.
        public List<string> ownedCardIds = new List<string>();
    }

    /// <summary>
    /// Persistenza JSON su persistentDataPath. Save atomico via file temp + rename
    /// così una write interrotta non corrompe il file esistente.
    /// </summary>
    public class SaveSystem : MonoBehaviour
    {
        public static SaveSystem Instance { get; private set; }

        const string SaveFile = "nexus_fold_save.json";

        public PlayerSaveData Data { get; private set; } = new PlayerSaveData();

        void Awake()
        {
            if (Instance != null && Instance != this) { Destroy(gameObject); return; }
            Instance = this;
            DontDestroyOnLoad(gameObject);
            Load();
        }

        string Path { get { return System.IO.Path.Combine(Application.persistentDataPath, SaveFile); } }
        string TempPath { get { return Path + ".tmp"; } }

        public void Save()
        {
            try
            {
                string json = JsonUtility.ToJson(Data, true);
                File.WriteAllText(TempPath, json);
                if (File.Exists(Path)) File.Delete(Path);
                File.Move(TempPath, Path);
            }
            catch (System.Exception e)
            {
                Debug.LogWarning("Save failed: " + e.Message);
            }
        }

        public void Load()
        {
            try
            {
                if (File.Exists(Path))
                {
                    string json = File.ReadAllText(Path);
                    var loaded = JsonUtility.FromJson<PlayerSaveData>(json);
                    Data = loaded != null ? loaded : new PlayerSaveData();
                    MigrateLegacyOwnedCards();
                }
            }
            catch (System.Exception e)
            {
                Debug.LogWarning("Load failed, reset to defaults: " + e.Message);
                Data = new PlayerSaveData();
            }
            ApplyToGameManager();
        }

        void MigrateLegacyOwnedCards()
        {
            if (Data.ownedCardIds == null || Data.ownedCardIds.Count == 0) return;
            for (int i = 0; i < Data.ownedCardIds.Count; i++)
            {
                var id = Data.ownedCardIds[i];
                if (string.IsNullOrEmpty(id)) continue;
                bool found = false;
                for (int j = 0; j < Data.cardCounts.Count; j++)
                {
                    if (Data.cardCounts[j].cardId == id) { Data.cardCounts[j].count++; found = true; break; }
                }
                if (!found) Data.cardCounts.Add(new CardCountEntry { cardId = id, count = 1 });
            }
            Data.ownedCardIds.Clear();
        }

        void ApplyToGameManager()
        {
            if (Core.GameManager.Instance == null) return;
            Core.GameManager.Instance.Gems = Data.gems;
            Core.GameManager.Instance.Gold = Data.gold;
            Core.GameManager.Instance.Dust = Data.dust;
            Core.GameManager.Instance.Level = Data.level;
            Core.GameManager.Instance.XP = Data.xp;
            Core.GameManager.Instance.SelectedHeroId = Data.selectedHeroId;
        }

        public void CaptureFromGameManager()
        {
            if (Core.GameManager.Instance == null) return;
            Data.gems = Core.GameManager.Instance.Gems;
            Data.gold = Core.GameManager.Instance.Gold;
            Data.dust = Core.GameManager.Instance.Dust;
            Data.level = Core.GameManager.Instance.Level;
            Data.xp = Core.GameManager.Instance.XP;
            Data.selectedHeroId = Core.GameManager.Instance.SelectedHeroId;
            Save();
        }

        public void CaptureInventory(CardInventory inventory)
        {
            if (inventory == null) return;
            Data.cardCounts.Clear();
            foreach (var kv in inventory.All)
                if (!string.IsNullOrEmpty(kv.Key) && kv.Value > 0)
                    Data.cardCounts.Add(new CardCountEntry { cardId = kv.Key, count = kv.Value });
            Save();
        }

        public void ApplyToInventory(CardInventory inventory)
        {
            if (inventory == null || Data.cardCounts == null) return;
            var kvs = new List<KeyValuePair<string, int>>(Data.cardCounts.Count);
            for (int i = 0; i < Data.cardCounts.Count; i++)
            {
                var e = Data.cardCounts[i];
                if (e == null || string.IsNullOrEmpty(e.cardId)) continue;
                kvs.Add(new KeyValuePair<string, int>(e.cardId, e.count));
            }
            inventory.LoadFromSave(kvs);
        }

        public void RecordWin()
        {
            Data.wins++;
            Data.xp += 50;
            Save();
        }

        public void RecordLoss()
        {
            Data.losses++;
            Data.xp += 15;
            Save();
        }

        public void RecordPackOpened()
        {
            Data.packsOpened++;
            Save();
        }
    }
}
