using UnityEngine;
using System;
using System.Collections.Generic;
using System.Globalization;

namespace NexusFold.LiveOps
{
    public enum EventType
    {
        None, Halloween, Christmas, Summer, RedMoon, Anniversary, BossRaid, ClanWar
    }

    [System.Serializable]
    public class GameEvent
    {
        public string eventId;
        public string displayName;
        public EventType type;
        public string startDate; // ISO 8601, es. "2026-10-20"
        public string endDate;
        public bool isActive;
        public string description;
    }

    public class EventManager : MonoBehaviour
    {
        public static EventManager Instance { get; private set; }

        public List<GameEvent> events = new List<GameEvent>();

        void Awake()
        {
            if (Instance != null && Instance != this) { Destroy(gameObject); return; }
            Instance = this;
            DontDestroyOnLoad(gameObject);
            SeedDefaultEvents();
            RefreshActive();
        }

        void SeedDefaultEvents()
        {
            if (events.Count > 0) return;
            events.Add(new GameEvent
            {
                eventId = "halloween_2026",
                displayName = "Luna Rossa di Halloween",
                type = EventType.Halloween,
                startDate = "2026-10-20",
                endDate = "2026-11-05",
                description = "Pacchetti Evento e carte tematiche"
            });
            events.Add(new GameEvent
            {
                eventId = "anniversary",
                displayName = "Anniversario Nexus",
                type = EventType.Anniversary,
                startDate = "2027-01-01",
                endDate = "2027-01-15",
                description = "Ricompense speciali e Battle Pass bonus"
            });
        }

        public void RefreshActive()
        {
            DateTime now = DateTime.UtcNow;
            for (int i = 0; i < events.Count; i++)
            {
                var e = events[i];
                if (e == null) continue;
                DateTime start, end;
                bool okStart = DateTime.TryParse(e.startDate, CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal | DateTimeStyles.AdjustToUniversal, out start);
                bool okEnd   = DateTime.TryParse(e.endDate,   CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal | DateTimeStyles.AdjustToUniversal, out end);
                e.isActive = okStart && okEnd && now >= start && now <= end;
            }
        }

        public List<GameEvent> GetActiveEvents()
        {
            RefreshActive();
            return events.FindAll(delegate(GameEvent e) { return e != null && e.isActive; });
        }

        public bool IsEventActive(EventType type)
        {
            var active = GetActiveEvents();
            for (int i = 0; i < active.Count; i++)
                if (active[i].type == type) return true;
            return false;
        }
    }
}
