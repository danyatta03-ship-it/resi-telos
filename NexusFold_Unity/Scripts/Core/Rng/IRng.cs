namespace NexusFold.Core.Rng
{
    /// <summary>
    /// Astrazione RNG. Deterministica e sostituibile in test / rete future.
    /// Nessun sistema dovrebbe usare UnityEngine.Random direttamente per la logica.
    /// </summary>
    public interface IRng
    {
        uint NextUInt();
        int  Range(int minInclusive, int maxExclusive);
        float Value01();          // [0, 1)
        bool  Chance(float p);    // p in [0,1]
        void  Reseed(ulong seed);
        ulong CurrentState { get; }
    }
}
